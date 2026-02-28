"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { AlertCardsModule } from "./modules/alert-cards";
import { PhoneQuickAccessModule } from "./modules/phone-quick-access";
import { CallActivityModule } from "./modules/call-activity";
import { PatchComplianceModule } from "./modules/patch-compliance";
import { RecentActivityModule } from "./modules/recent-activity";
import { ClientQuickAccessModule } from "./modules/client-quick-access";
import { TicketBoardModule } from "./modules/ticket-board";
import { TicketDistributionChartModule } from "./modules/ticket-distribution-chart";
import { AlertTrendChartModule } from "./modules/alert-trend-chart";
import { UptimeLatencyChartModule } from "./modules/uptime-latency-chart";
import { TicketVolumeChartModule } from "./modules/ticket-volume-chart";

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
  "alert-cards": AlertCardsModule,
  "phone-quick-access": PhoneQuickAccessModule,
  "call-activity": CallActivityModule,
  "patch-compliance": PatchComplianceModule,
  "recent-activity": RecentActivityModule,
  "client-quick-access": ClientQuickAccessModule,
  "ticket-board": TicketBoardModule,
  "ticket-distribution-chart": TicketDistributionChartModule,
  "alert-trend-chart": AlertTrendChartModule,
  "uptime-latency-chart": UptimeLatencyChartModule,
  "ticket-volume-chart": TicketVolumeChartModule,
};

const ResponsiveGridLayout = RGL.WidthProvider(RGL.Responsive);

const ROW_HEIGHT = 40;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_COLS = { lg: 48, md: 48, sm: 24, xs: 1 };

// ─── Row Packing ─────────────────────────────────────────────────
// Ensures multi-item rows fill the full 48 columns with no gaps.
// Groups items by vertical overlap, scales widths proportionally.
function packRows(items: DashboardLayoutItem[]): DashboardLayoutItem[] {
  const COLS = 48;
  const result = items.map((item) => ({ ...item }));
  const assigned = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    if (assigned.has(i)) continue;

    // Find all items that overlap vertically with this one (same visual row)
    const rowIndices = [i];
    assigned.add(i);

    for (let j = i + 1; j < result.length; j++) {
      if (assigned.has(j)) continue;
      const overlaps = rowIndices.some((ri) => {
        const a = result[ri];
        const b = result[j];
        return b.y < a.y + a.h && b.y + b.h > a.y;
      });
      if (overlaps) {
        rowIndices.push(j);
        assigned.add(j);
      }
    }

    if (rowIndices.length < 2) continue; // Single-item rows keep their manual size

    // Sort by x position
    rowIndices.sort((a, b) => result[a].x - result[b].x);

    const totalW = rowIndices.reduce((sum, idx) => sum + result[idx].w, 0);

    if (totalW === COLS) {
      // Correct total width — just close gaps (pack left-to-right)
      let x = 0;
      for (const idx of rowIndices) {
        result[idx] = { ...result[idx], x };
        x += result[idx].w;
      }
    } else {
      // Scale widths proportionally to fill COLS
      const ratio = COLS / totalW;
      let x = 0;
      let remaining = COLS;

      for (let k = 0; k < rowIndices.length; k++) {
        const idx = rowIndices[k];
        const item = result[idx];
        const mod = MODULE_MAP.get(getModuleType(item.i));
        const minW = mod?.minSize.w ?? 8;

        let newW: number;
        if (k === rowIndices.length - 1) {
          newW = Math.max(1, remaining); // Last item gets remaining
        } else {
          newW = Math.max(minW, Math.round(item.w * ratio));
        }

        result[idx] = { ...result[idx], x, w: newW };
        x += newW;
        remaining -= newW;
      }
    }
  }

  return result;
}

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
  const skipLayoutChangeRef = useRef(0);
  const preResizeItemsRef = useRef<DashboardLayoutItem[] | null>(null);
  const preDragItemsRef = useRef<DashboardLayoutItem[] | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

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

      // Migrate v3 → v4: Grid doubled from 12→24 columns, so double x and w values
      if (savedVersion < 4) {
        items = items.map((item) => ({
          ...item,
          x: item.x * 2,
          w: item.w * 2,
        }));
      }

      // Migrate v4 → v5: Grid doubled from 24→48 columns, so double x and w values
      if (savedVersion < 5) {
        items = items.map((item) => ({
          ...item,
          x: item.x * 2,
          w: item.w * 2,
        }));
      }

      // Migrate v5 → v6: Remove deprecated modules (security-posture, backup-status)
      if (savedVersion < 6) {
        const deprecated = new Set(["backup-status", "security-posture"]);
        items = items.filter((item) => !deprecated.has(getModuleType(item.i)));
      }

      return { ...data, version: LAYOUT_VERSION, items };
    }
    return getDefaultLayout(role);
  }, [layoutQuery.data, role]);

  const activeItems = localItems ?? serverLayout.items;

  useEffect(() => {
    if (editing) {
      setLocalItems(packRows([...serverLayout.items]));
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
      // Skip N layout changes after onResizeStop set our adjusted layout
      // (RGL fires onLayoutChange multiple times: once for resize, again after compaction)
      if (skipLayoutChangeRef.current > 0) {
        skipLayoutChangeRef.current--;
        return;
      }
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

  // ─── Reactive Resize: capture pre-resize layout + auto-adjust neighbors ───

  // Capture layout BEFORE react-grid-layout resolves collisions (pushes neighbors down)
  const handleResizeStart = useCallback(() => {
    if (!editing || !localItems) return;
    preResizeItemsRef.current = [...localItems];
  }, [editing, localItems]);

  const handleResizeStop = useCallback(
    (_layout: RGL.Layout[], oldItem: RGL.Layout, newItem: RGL.Layout) => {
      if (!editing) return;

      const preItems = preResizeItemsRef.current;
      preResizeItemsRef.current = null;
      if (!preItems) return;

      const oldRight = oldItem.x + oldItem.w;
      const newRight = newItem.x + newItem.w;
      const rightDelta = newRight - oldRight;
      const leftDelta = newItem.x - oldItem.x;

      // Build result from PRE-RESIZE items (clean positions, no collision artifacts).
      // During resize, onLayoutChange continuously updates localItems with RGL's
      // collision-resolved layout (neighbors pushed down). We must ignore all of that
      // and start from the snapshot captured at onResizeStart.
      let result = preItems.map((item) => ({ ...item }));

      // Apply the resize to the target item
      result = result.map((item) =>
        item.i === newItem.i
          ? { ...item, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
          : item
      );

      // Find row peers using pre-resize positions (before collision pushed them down)
      const isRowPeer = (item: DashboardLayoutItem) => {
        if (item.i === newItem.i) return false;
        return item.y < oldItem.y + oldItem.h && item.y + item.h > oldItem.y;
      };

      // Right edge changed (SE/E resize) → shrink the right neighbor
      if (rightDelta !== 0) {
        const rightNeighbor = preItems
          .filter((item) => isRowPeer(item) && item.x >= oldRight - 2 && item.x <= oldRight + 2)
          .sort((a, b) => a.x - b.x)[0];

        if (rightNeighbor) {
          const mod = MODULE_MAP.get(getModuleType(rightNeighbor.i));
          const minW = mod?.minSize.w ?? 8;
          const neighborRightEdge = rightNeighbor.x + rightNeighbor.w;
          const newNeighborW = neighborRightEdge - newRight;

          if (newNeighborW >= minW && newRight >= 0 && newRight <= 48) {
            result = result.map((item) =>
              item.i === rightNeighbor.i ? { ...item, x: newRight, w: newNeighborW } : item
            );
          }
        }
      }

      // Left edge changed (SW/W resize) → shrink the left neighbor
      if (leftDelta !== 0) {
        const leftNeighbor = preItems
          .filter((item) => {
            if (!isRowPeer(item)) return false;
            const preRight = item.x + item.w;
            return preRight >= oldItem.x - 2 && preRight <= oldItem.x + 2;
          })
          .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];

        if (leftNeighbor) {
          const mod = MODULE_MAP.get(getModuleType(leftNeighbor.i));
          const minW = mod?.minSize.w ?? 8;
          const newNeighborW = newItem.x - leftNeighbor.x;

          if (newNeighborW >= minW) {
            result = result.map((item) =>
              item.i === leftNeighbor.i ? { ...item, w: newNeighborW } : item
            );
          }
        }
      }

      // Pack rows to ensure all multi-item rows fill 48 columns
      result = packRows(result);

      // Skip next few onLayoutChange calls — RGL fires multiple times after resize
      // (once for the resize itself, again after vertical compaction)
      skipLayoutChangeRef.current = 3;

      setLocalItems(result);
    },
    [editing]
  );

  // ─── Auto-fit on Drop: shrink modules to fit when dragged to occupied rows ───

  const handleDragStart = useCallback(() => {
    if (!editing || !localItems) return;
    preDragItemsRef.current = [...localItems];
  }, [editing, localItems]);

  const handleDragStop = useCallback(
    (layout: RGL.Layout[], _oldItem: RGL.Layout, newItem: RGL.Layout, _placeholder: RGL.Layout, event: MouseEvent) => {
      if (!editing) return;

      const preDragItems = preDragItemsRef.current;
      preDragItemsRef.current = null;
      if (!preDragItems) return;

      // Helper: apply RGL's result with packRows normalization (default path)
      const applyDefault = () => {
        const configMap = new Map(preDragItems.map((item) => [item.i, item.config]));
        const result = packRows(
          layout.map((l) => ({
            i: l.i, x: l.x, y: l.y, w: l.w, h: l.h,
            config: configMap.get(l.i),
          }))
        );
        skipLayoutChangeRef.current = 3;
        setLocalItems(result);
      };

      // Use mouse position to determine where the user ACTUALLY intended to drop
      // (RGL's newItem.y is collision-resolved — may be pushed below the target row)
      const gridEl = gridContainerRef.current?.querySelector(".react-grid-layout") as HTMLElement;
      if (!gridEl || typeof event?.clientY !== "number") { applyDefault(); return; }

      const rect = gridEl.getBoundingClientRect();
      const relY = event.clientY - rect.top - GRID_MARGIN[1]; // account for container padding
      const rowPx = ROW_HEIGHT + GRID_MARGIN[1]; // 56px per grid row
      const mouseRow = Math.max(0, Math.floor(relY / rowPx));

      // Find the existing item the mouse is hovering over (pre-drag positions)
      const targetItem = preDragItems.find((item) =>
        item.i !== newItem.i &&
        item.y <= mouseRow &&
        item.y + item.h > mouseRow
      );

      // No target item under mouse → just normalize with packRows
      if (!targetItem) { applyDefault(); return; }

      // If RGL already placed it on the target row → just normalize
      if (newItem.y >= targetItem.y && newItem.y < targetItem.y + targetItem.h) {
        applyDefault();
        return;
      }

      // ─── Auto-fit: try to place dragged item on the target row ───
      const intendedY = targetItem.y;
      const draggedH = newItem.h;

      // Find all items on the intended row (pre-drag positions)
      const rowItems = preDragItems.filter((item) => {
        if (item.i === newItem.i) return false;
        return item.y < intendedY + draggedH && item.y + item.h > intendedY;
      });

      if (rowItems.length === 0) { applyDefault(); return; }

      // Check if all modules can fit at their minimum widths
      const droppedMod = MODULE_MAP.get(getModuleType(newItem.i));
      const droppedMinW = droppedMod?.minSize.w ?? 8;
      const totalMinW = rowItems.reduce((sum, item) => {
        const m = MODULE_MAP.get(getModuleType(item.i));
        return sum + (m?.minSize.w ?? 8);
      }, droppedMinW);

      if (totalMinW > 48) { applyDefault(); return; } // Can't fit

      // Calculate new widths
      const existingTotalW = rowItems.reduce((sum, item) => sum + item.w, 0);
      const widthMap = new Map<string, number>();
      let droppedW: number;

      if (48 - existingTotalW >= droppedMinW) {
        // Enough room without shrinking
        droppedW = Math.min(newItem.w, 48 - existingTotalW);
        for (const item of rowItems) widthMap.set(item.i, item.w);
      } else {
        // Shrink existing items proportionally to make room
        droppedW = droppedMinW;
        const spaceForExisting = 48 - droppedW;
        const ratio = spaceForExisting / existingTotalW;

        for (const item of rowItems) {
          const m = MODULE_MAP.get(getModuleType(item.i));
          const minW = m?.minSize.w ?? 8;
          widthMap.set(item.i, Math.max(minW, Math.floor(item.w * ratio)));
        }

        // Fix rounding so widths sum exactly to spaceForExisting
        let sum = 0;
        widthMap.forEach((w) => { sum += w; });
        let remainder = spaceForExisting - sum;
        for (const item of rowItems) {
          if (remainder === 0) break;
          const step = remainder > 0 ? 1 : -1;
          const m = MODULE_MAP.get(getModuleType(item.i));
          const minW = m?.minSize.w ?? 8;
          const curW = widthMap.get(item.i)!;
          if (step < 0 && curW <= minW) continue;
          widthMap.set(item.i, curW + step);
          remainder -= step;
        }
      }
      widthMap.set(newItem.i, droppedW);

      // Determine insert position from mouse X
      const sortedExisting = [...rowItems].sort((a, b) => a.x - b.x);
      const colPx = rect.width / 48;
      const mouseCol = Math.floor((event.clientX - rect.left) / colPx);
      let insertIdx = sortedExisting.length;
      for (let i = 0; i < sortedExisting.length; i++) {
        const mid = sortedExisting[i].x + sortedExisting[i].w / 2;
        if (mouseCol < mid) { insertIdx = i; break; }
      }

      // Build ordered list and assign x positions left-to-right
      const draggedOrig = preDragItems.find((item) => item.i === newItem.i)!;
      const ordered = [...sortedExisting];
      ordered.splice(insertIdx, 0, draggedOrig);

      const posUpdates = new Map<string, { x: number; y: number; w: number; h: number }>();
      let x = 0;
      for (const item of ordered) {
        const w = widthMap.get(item.i)!;
        const h = item.i === newItem.i ? draggedH : item.h;
        const y = item.i === newItem.i ? intendedY : item.y;
        posUpdates.set(item.i, { x, y, w, h });
        x += w;
      }

      let result = preDragItems.map((item) => {
        const update = posUpdates.get(item.i);
        return update ? { ...item, ...update } : item;
      });

      result = packRows(result);
      skipLayoutChangeRef.current = 3;
      setLocalItems(result);
    },
    [editing]
  );

  const handleDone = useCallback(() => {
    if (localItems) {
      // Optimistically update the query cache so layout persists when editing clears localItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      utils.user.getDashboardLayout.setData(undefined, { version: LAYOUT_VERSION, items: localItems } as any);
      saveItems(localItems);
    }
    setEditing(false);
  }, [localItems, saveItems, utils]);

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

      <div ref={gridContainerRef}>
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
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
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
      </div>

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
