"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import RGL from "react-grid-layout";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Pencil, Check, RotateCcw, Plus } from "lucide-react";
import type { Role } from "@prisma/client";

import { MODULE_MAP, MODULE_REGISTRY } from "@/lib/dashboard-modules";
import { getDefaultLayout, type DashboardLayoutItem, type DashboardLayoutData } from "@/lib/dashboard-defaults";
import { ModuleWrapper } from "./module-wrapper";
import { ModulePicker } from "./module-picker";

// Module component imports
import { StatOverviewModule } from "./modules/stat-overview";
import { RecentAlertsModule } from "./modules/recent-alerts";
import { RecentTicketsModule } from "./modules/recent-tickets";
import { SystemHealthModule } from "./modules/system-health";
import { NetworkHealthModule } from "./modules/network-health";

// ─── Component Map ──────────────────────────────────────────────
// Maps module IDs to their React components.
// When adding a new module: import it above, add the mapping here.

const MODULE_COMPONENTS: Record<string, React.ComponentType> = {
  "stat-overview": StatOverviewModule,
  "recent-alerts": RecentAlertsModule,
  "recent-tickets": RecentTicketsModule,
  "system-health": SystemHealthModule,
  "network-health": NetworkHealthModule,
};

const ResponsiveGridLayout = RGL.WidthProvider(RGL.Responsive);

// Row height in pixels for grid calculations
const ROW_HEIGHT = 80;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 1 };

// ─── Dashboard Grid ─────────────────────────────────────────────

export function DashboardGrid() {
  const { data: session } = useSession();
  const role = (session?.user?.role as Role) ?? "USER";
  const utils = trpc.useUtils();

  // Fetch saved layout from DB
  const layoutQuery = trpc.user.getDashboardLayout.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Fetch user permissions for module filtering
  const permissionsQuery = trpc.user.myPermissions.useQuery(undefined, {
    staleTime: 60_000,
  });

  const saveMutation = trpc.user.saveDashboardLayout.useMutation({
    onSuccess: (_data, variables) => {
      // Update the query cache immediately so the UI stays in sync
      utils.user.getDashboardLayout.setData(undefined, variables);
    },
  });

  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Local layout state — tracks user changes during editing.
  // This is the source of truth while editing; server data is source of truth otherwise.
  const [localItems, setLocalItems] = useState<DashboardLayoutItem[] | null>(null);

  // Permission set for quick lookups
  const userPermissions = useMemo(
    () => new Set(permissionsQuery.data ?? []),
    [permissionsQuery.data]
  );

  // Server layout: saved preference → role default
  const serverLayout = useMemo((): DashboardLayoutData => {
    if (layoutQuery.data) return layoutQuery.data as unknown as DashboardLayoutData;
    return getDefaultLayout(role);
  }, [layoutQuery.data, role]);

  // The active items: local edits when editing, server data otherwise
  const activeItems = localItems ?? serverLayout.items;

  // When entering edit mode, snapshot the current layout into local state
  // When exiting, clear local state (server cache is already updated)
  useEffect(() => {
    if (editing) {
      setLocalItems([...serverLayout.items]);
    } else {
      setLocalItems(null);
    }
  }, [editing]); // intentionally only depend on editing toggle

  // Filter layout items to only modules the user has permission for
  const visibleItems = useMemo(() => {
    return activeItems.filter((item) => {
      const mod = MODULE_MAP.get(item.i);
      if (!mod) return false;
      if (!MODULE_COMPONENTS[item.i]) return false;
      if (mod.requiredPermission && !userPermissions.has(mod.requiredPermission)) return false;
      return true;
    });
  }, [activeItems, userPermissions]);

  // Convert to react-grid-layout format
  const gridLayout = useMemo((): RGL.Layout[] => {
    return visibleItems.map((item) => {
      const mod = MODULE_MAP.get(item.i)!;
      return {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: mod.minSize.w,
        minH: mod.minSize.h,
        maxW: mod.maxSize?.w,
        maxH: mod.maxSize?.h,
        static: !editing,
      };
    });
  }, [visibleItems, editing]);

  // Active module IDs for the picker
  const activeModuleIds = useMemo(
    () => new Set(activeItems.map((item) => item.i)),
    [activeItems]
  );

  // Save layout to server (immediate, no debounce)
  const saveItems = useCallback(
    (items: DashboardLayoutItem[]) => {
      saveMutation.mutate({ version: 1, items });
    },
    [saveMutation]
  );

  // Handle layout change from react-grid-layout (drag/resize)
  const handleLayoutChange = useCallback(
    (newLayout: RGL.Layout[]) => {
      if (!editing) return;

      const items: DashboardLayoutItem[] = newLayout.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      }));

      // Update local state immediately so the UI stays in sync
      setLocalItems(items);
    },
    [editing]
  );

  // Done button: save current local state and exit edit mode
  const handleDone = useCallback(() => {
    if (localItems) {
      saveItems(localItems);
    }
    setEditing(false);
  }, [localItems, saveItems]);

  // Remove a module
  const handleRemove = useCallback(
    (moduleId: string) => {
      const items = activeItems.filter((item) => item.i !== moduleId);
      setLocalItems(items);
      saveItems(items);
    },
    [activeItems, saveItems]
  );

  // Add a module
  const handleAddModule = useCallback(
    (moduleId: string) => {
      const mod = MODULE_MAP.get(moduleId);
      if (!mod) return;

      const maxY = activeItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);

      const newItem: DashboardLayoutItem = {
        i: moduleId,
        x: 0,
        y: maxY,
        w: mod.defaultSize.w,
        h: mod.defaultSize.h,
      };

      const items = [...activeItems, newItem];
      setLocalItems(items);
      saveItems(items);
    },
    [activeItems, saveItems]
  );

  // Reset to role defaults
  const handleReset = useCallback(() => {
    const defaults = getDefaultLayout(role);
    setLocalItems([...defaults.items]);
    saveItems(defaults.items);
  }, [role, saveItems]);

  // Portal target for header actions
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById("header-actions"));
  }, []);

  // Header toolbar buttons (portaled into the header)
  const toolbarContent = portalTarget
    ? createPortal(
        <>
          {editing && (
            <>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-400 rounded-md border border-red-500/30 hover:border-red-500/50 hover:bg-red-500/5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Module
              </button>
            </>
          )}
          <button
            onClick={editing ? handleDone : () => setEditing(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              editing
                ? "bg-red-500 text-white hover:bg-red-600"
                : "text-muted-foreground hover:text-foreground border border-border hover:bg-muted"
            )}
          >
            {editing ? (
              <>
                <Check className="h-3 w-3" />
                Done
              </>
            ) : (
              <>
                <Pencil className="h-3 w-3" />
                Customize
              </>
            )}
          </button>
        </>,
        portalTarget
      )
    : null;

  // Loading state
  if (layoutQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        {toolbarContent}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {toolbarContent}

      {/* Grid */}
      <ResponsiveGridLayout
        layouts={{ lg: gridLayout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 0 }}
        cols={GRID_COLS}
        rowHeight={ROW_HEIGHT}
        margin={GRID_MARGIN}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".module-drag-handle"
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        useCSSTransforms
      >
        {visibleItems.map((item) => {
          const mod = MODULE_MAP.get(item.i);
          const Component = MODULE_COMPONENTS[item.i];
          if (!mod || !Component) return null;

          return (
            <div key={item.i}>
              <ModuleWrapper
                module={mod}
                editing={editing}
                onRemove={() => handleRemove(item.i)}
              >
                <Component />
              </ModuleWrapper>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      {/* Module Picker */}
      <ModulePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        activeModuleIds={activeModuleIds}
        userPermissions={userPermissions}
        onAddModule={handleAddModule}
      />
    </div>
  );
}
