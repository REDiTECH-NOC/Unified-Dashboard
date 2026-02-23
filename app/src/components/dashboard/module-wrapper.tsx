"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { GripVertical, X, Settings } from "lucide-react";
import type { DashboardModuleDef } from "@/lib/dashboard-modules";

interface ModuleWrapperProps {
  module: DashboardModuleDef;
  editing: boolean;
  instanceName?: string;
  onRemove?: () => void;
  onOpenConfig?: () => void;
  children: React.ReactNode;
}

export function ModuleWrapper({ module, editing, instanceName, onRemove, onOpenConfig, children }: ModuleWrapperProps) {
  const Icon = module.icon;

  return (
    <div
      className={cn(
        "relative h-full flex flex-col rounded-xl bg-card border border-border",
        "shadow-card-light dark:shadow-card overflow-hidden",
        !editing && "hover:shadow-card-hover-light dark:hover:shadow-card-hover hover:-translate-y-px transition-all duration-150",
        editing && "ring-1 ring-muted-foreground/20"
      )}
    >
      {/* Red accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/20 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {editing && (
            <div className="module-drag-handle cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-muted transition-colors">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <Icon className="h-4 w-4 text-red-500 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">
            {instanceName || module.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {module.configurable && onOpenConfig && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenConfig(); }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={`Configure ${module.name}`}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
          {!editing && module.viewAllHref && (
            <Link
              href={module.viewAllHref}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          )}
          {editing && onRemove && (
            <button
              onClick={onRemove}
              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              aria-label={`Remove ${module.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
