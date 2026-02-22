"use client";

import {
  Shield, Monitor, FileText, Key, HardDrive, Wifi, Phone, Package, Activity,
} from "lucide-react";
import { IntegrationCard } from "./integration-card";

const categoryIcons: Record<string, typeof Shield> = {
  security: Shield,
  rmm: Monitor,
  psa: FileText,
  identity: Key,
  documentation: FileText,
  backup: HardDrive,
  network: Wifi,
  phone: Phone,
  licensing: Package,
  monitoring: Activity,
};

const categoryLabels: Record<string, string> = {
  rmm: "Remote Monitoring",
  psa: "Ticketing / PSA",
  security: "Security",
  identity: "Identity & Access",
  documentation: "Documentation",
  backup: "Backup",
  network: "Network",
  phone: "Phone",
  licensing: "Licensing",
  monitoring: "Uptime Monitoring",
};

interface ToolInfo {
  toolId: string;
  displayName: string;
  status: string;
}

interface IntegrationCategoryProps {
  category: string;
  tools: ToolInfo[];
  onConfigure: (toolId: string) => void;
}

export function IntegrationCategory({ category, tools, onConfigure }: IntegrationCategoryProps) {
  const Icon = categoryIcons[category] || Shield;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" />
        {categoryLabels[category] || category}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <IntegrationCard
            key={tool.toolId}
            tool={tool}
            onConfigure={onConfigure}
          />
        ))}
      </div>
    </div>
  );
}
