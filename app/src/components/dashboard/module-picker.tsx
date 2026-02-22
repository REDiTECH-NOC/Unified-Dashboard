"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  MODULE_REGISTRY,
  CATEGORY_LABELS,
  type DashboardModuleDef,
  type ModuleCategory,
} from "@/lib/dashboard-modules";

interface ModulePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Module IDs already on the dashboard */
  activeModuleIds: Set<string>;
  /** Permission keys the current user has */
  userPermissions: Set<string>;
  /** Called when a module is selected to add */
  onAddModule: (moduleId: string) => void;
}

export function ModulePicker({
  open,
  onOpenChange,
  activeModuleIds,
  userPermissions,
  onAddModule,
}: ModulePickerProps) {
  // Filter to modules the user has permission for and hasn't already added
  const available = MODULE_REGISTRY.filter((m) => {
    if (activeModuleIds.has(m.id)) return false;
    if (m.requiredPermission && !userPermissions.has(m.requiredPermission)) return false;
    return true;
  });

  // Group by category
  const grouped = available.reduce<Record<ModuleCategory, DashboardModuleDef[]>>(
    (acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    },
    {} as Record<ModuleCategory, DashboardModuleDef[]>
  );

  const categories = Object.keys(grouped) as ModuleCategory[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" onClose={() => onOpenChange(false)}>
        <SheetHeader>
          <SheetTitle>Add Module</SheetTitle>
          <SheetDescription>
            Choose a module to add to your dashboard.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                All available modules are already on your dashboard.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => (
                <div key={cat}>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {CATEGORY_LABELS[cat]}
                  </h4>
                  <div className="space-y-2">
                    {grouped[cat].map((m) => (
                      <ModuleCard
                        key={m.id}
                        module={m}
                        onAdd={() => {
                          onAddModule(m.id);
                          onOpenChange(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ModuleCard({ module, onAdd }: { module: DashboardModuleDef; onAdd: () => void }) {
  const Icon = module.icon;

  return (
    <button
      onClick={onAdd}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg border border-border",
        "bg-card hover:bg-muted/50 transition-colors text-left group"
      )}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 flex-shrink-0">
        <Icon className="h-4 w-4 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{module.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {module.description}
        </p>
      </div>
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        <Plus className="h-3.5 w-3.5 text-foreground" />
      </div>
    </button>
  );
}
