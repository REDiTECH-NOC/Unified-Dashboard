"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import RGL from "react-grid-layout";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Pencil, Check, RotateCcw, Plus } from "lucide-react";
import type { Role } from "@prisma/client";

import { MODULE_MAP, getModuleType, generateInstanceId } from "@/lib/dashboard-modules";
import { getDefaultLayout, LAYOUT_VERSION, type DashboardLayoutItem, type DashboardLayoutData } from "@/lib/dashboard-defaults";
import { ModuleWrapper } from "./module-wrapper";
import { ModulePicker } from "./module-picker";

// Module component imports
import { StatOverviewModule } from "./modules/stat-overview";
import { RecentAlertsModule } from "./modules/recent-alerts";
import { RecentTicketsModule } from "./modules/recent-tickets";
import { SystemHealthModule } from "./modules/system-health";
import { NetworkHealthModule } from "./modules/network-health";
import { MyTicketsModule } from "./modules/my-tickets";
import { UptimeStatusModule } from "./modules/uptime-status";
import { SecurityPostureModule } from "./modules/security-posture";
import { BackupStatusModule } from "./modules/backup-status";
import { CallActivityModule } from "./modules/call-activity";
import { PatchComplianceModule } from "./modules/patch-compliance";
import { RecentActivityModule } from "./modules/recent-activity";
import { ClientQuickAccessModule } from "./modules/client-quick-access";
import { TicketBoardModule } from "./modules/ticket-board";

// ─── Module Props Interface ─────────────────────────────────────

export interface ModuleComponentProps {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  isConfigOpen: boolean;
  onConfigClose: () => void;
  editing?: boolean;
}

// ─── Component Map ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODULE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "stat-overview": StatOverviewModule,
  "recent-alerts": RecentAlertsModule,
  "recent-tickets": RecentTicketsModule,
  "system-health": SystemHealthModule,
  "network-health": NetworkHealthModule,
  "my-tickets": MyTicketsModule,
  "uptime-status": UptimeStatusModule,
  "security-posture": SecurityPostureModule,
  "backup-status": BackupStatusModule,
  "call-activity": CallActivityModule,
  "patch-compliance": PatchComplianceModule,
  "recent-activity": RecentActivityModule,
  "client-quick-access": ClientQuickAccessModule,
  "ticket-board": TicketBoardModule,
};

const ResponsiveGridLayout = RGL.WidthProvider(RGL.Responsive);

const ROW_HEIGHT = 40;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 1 };

// ─── Dashboard Grid ─────────────────────────────────────────────

export function DashboardGrid() {
  const { data: session } = useSession();
  const role = (session?.user?.role as Role) ?? "USER";
  const utils = trpc.useUtils();

  const layoutQuery = trpc.user.getDashboardLayout.useQuery(undefined, {
    staleTime: 60_000,
  });

  const permissionsQuery = trpc.user.myPermissions.useQuery(undefined, {
    staleTime: 60_000,
  });

  const saveMutation = trpc.user.saveDashboardLayout.useMutation({
    onSuccess: (_data, variables) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      utils.user.getDashboardLayout.setData(undefined, variables as any);
    },
  });

  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configOpenId, setConfigOpenId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<DashboardLayoutItem[] | null>(null);

  const userPermissions = useMemo(
    () => new Set(permissionsQuery.data ?? []),
    [permissionsQuery.data]
  );

  const serverLayout = useMemo((): DashboardLayoutData => {
    if (layoutQuery.data) {
      const data = layoutQuery.data as unknown as DashboardLayoutData;
      const savedVersion = data.version || 2;
      let items = (data.items || []).map((item) => ({
        ...item,
        config: item.config ?? MODULE_MAP.get(getModuleType(item.i))?.defaultConfig,
      }));

      // Migrate v2 → v3: ROW_HEIGHT halved from 80→40, so double h and y values
      if (savedVersion < 3) {
        items = items.map((item) => ({
          ...item,
          h: item.h * 2,
          y: item.y * 2,
        }));
      }

      return { ...data, version: LAYOUT_VERSION, items };
    }
    return getDefaultLayout(role);
  }, [layoutQuery.data, role]);

  const activeItems = localItems ?? serverLayout.items;

  useEffect(() => {
    if (editing) {
      setLocalItems([...serverLayout.items]);
    } else {
      setLocalItems(null);
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = useMemo(() => {
    return activeItems.filter((item) => {
      const moduleType = getModuleType(item.i);
      const mod = MODULE_MAP.get(moduleType);
      if (!mod) return false;
      if (!MODULE_COMPONENTS[moduleType]) return false;
      if (mod.requiredPermission && !userPermissions.has(mod.requiredPermission)) return false;
      return true;
    });
  }, [activeItems, userPermissions]);

  const gridLayout = useMemo((): RGL.Layout[] => {
    return visibleItems.map((item) => {
      const moduleType = getModuleType(item.i);
      const mod = MODULE_MAP.get(moduleType)!;
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

  const activeModuleTypes = useMemo(
    () => new Set(activeItems.map((item) => getModuleType(item.i))),
    [activeItems]
  );

  const saveItems = useCallback(
    (items: DashboardLayoutItem[]) => {
      saveMutation.mutate({ version: LAYOUT_VERSION, items });
    },
    [saveMutation]
  );

  const handleLayoutChange = useCallback(
    (newLayout: RGL.Layout[]) => {
      if (!editing) return;
      const configMap = new Map(activeItems.map((item) => [item.i, item.config]));
      const items: DashboardLayoutItem[] = newLayout.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        config: configMap.get(l.i),
      }));
      setLocalItems(items);
    },
    [editing, activeItems]
  );

  const handleDone = useCallback(() => {
    if (localItems) saveItems(localItems);
    setEditing(false);
  }, [localItems, saveItems]);

  const handleRemove = useCallback(
    (instanceId: string) => {
      const items = activeItems.filter((item) => item.i !== instanceId);
      setLocalItems(items);
      saveItems(items);
    },
    [activeItems, saveItems]
  );

  const handleAddModule = useCallback(
    (moduleType: string) => {
      const mod = MODULE_MAP.get(moduleType);
      if (!mod) return;

      const existing = activeItems.some((item) => getModuleType(item.i) === moduleType);
      const instanceId = existing ? generateInstanceId(moduleType) : moduleType;
      const maxY = activeItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);

      const newItem: DashboardLayoutItem = {
        i: instanceId,
        x: 0,
        y: maxY,
        w: mod.defaultSize.w,
        h: mod.defaultSize.h,
        config: mod.defaultConfig ? { ...mod.defaultConfig } : undefined,
      };

      const items = [...activeItems, newItem];
      setLocalItems(items);
      saveItems(items);
    },
    [activeItems, saveItems]
  );

  const handleConfigChange = useCallback(
    (instanceId: string, newConfig: Record<string, unknown>) => {
      const items = activeItems.map((item) =>
        item.i === instanceId ? { ...item, config: newConfig } : item
      );
      setLocalItems(items);
      saveItems(items);
    },
    [activeItems, saveItems]
  );

  const handleReset = useCallback(() => {
    const defaults = getDefaultLayout(role);
    setLocalItems([...defaults.items]);
    saveItems(defaults.items);
  }, [role, saveItems]);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById("header-actions"));
  }, []);

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
              <><Check className="h-3 w-3" />Done</>
            ) : (
              <><Pencil className="h-3 w-3" />Customize</>
            )}
          </button>
        </>,
        portalTarget
      )
    : null;

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
    <div className={editing ? "dashboard-editing" : undefined}>
      {toolbarContent}

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
          const moduleType = getModuleType(item.i);
          const mod = MODULE_MAP.get(moduleType);
          const Component = MODULE_COMPONENTS[moduleType];
          if (!mod || !Component) return null;

          const itemConfig = item.config ?? mod.defaultConfig ?? {};
          const isConfigOpen = configOpenId === item.i;

          return (
            <div key={item.i}>
              <ModuleWrapper
                module={mod}
                editing={editing}
                onRemove={() => handleRemove(item.i)}
                onOpenConfig={mod.configurable ? () => setConfigOpenId(item.i) : undefined}
              >
                <Component
                  config={itemConfig}
                  onConfigChange={(newConfig: Record<string, unknown>) => handleConfigChange(item.i, newConfig)}
                  isConfigOpen={isConfigOpen}
                  onConfigClose={() => setConfigOpenId(null)}
                  editing={editing}
                />
              </ModuleWrapper>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      <ModulePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        activeModuleTypes={activeModuleTypes}
        userPermissions={userPermissions}
        onAddModule={handleAddModule}
      />
    </div>
  );
}
