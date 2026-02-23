"use client";

import { cn } from "@/lib/utils";
import { Plus, Check } from "lucide-react";
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
  activeModuleTypes: Set<string>;
  userPermissions: Set<string>;
  onAddModule: (moduleId: string) => void;
}

export function ModulePicker({
  open,
  onOpenChange,
  activeModuleTypes,
  userPermissions,
  onAddModule,
}: ModulePickerProps) {
  const available = MODULE_REGISTRY.filter((m) => {
    if (m.requiredPermission && !userPermissions.has(m.requiredPermission)) return false;
    return true;
  });

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
            Choose a module to add to your dashboard. Modules marked MULTI can be added multiple times with different settings.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No modules available.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => (
                <div key={cat}>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {CATEGORY_LABELS[cat]}
                  </h4>
                  <div className="space-y-2">
                    {grouped[cat].map((m) => {
                      const isAdded = activeModuleTypes.has(m.id);
                      const canAdd = m.allowDuplicates || !isAdded;

                      return (
                        <ModuleCard
                          key={m.id}
                          module={m}
                          isAdded={isAdded}
                          canAdd={canAdd}
                          onAdd={() => {
                            if (!canAdd) return;
                            onAddModule(m.id);
                            onOpenChange(false);
                          }}
                        />
                      );
                    })}
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

function ModuleCard({ module, isAdded, canAdd, onAdd }: {
  module: DashboardModuleDef;
  isAdded: boolean;
  canAdd: boolean;
  onAdd: () => void;
}) {
  const Icon = module.icon;

  return (
    <button
      onClick={onAdd}
      disabled={!canAdd}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg border border-border",
        "text-left group transition-colors",
        canAdd ? "bg-card hover:bg-muted/50" : "bg-muted/20 opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 flex-shrink-0">
        <Icon className="h-4 w-4 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{module.name}</p>
          {module.allowDuplicates && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-accent text-muted-foreground font-medium">MULTI</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{module.description}</p>
      </div>
      <div className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 mt-0.5">
        {isAdded && !module.allowDuplicates ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <div className="bg-muted rounded-md w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="h-3.5 w-3.5 text-foreground" />
          </div>
        )}
      </div>
    </button>
  );
}
