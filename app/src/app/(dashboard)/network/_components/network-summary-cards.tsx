import { cn } from "@/lib/utils";
import { Globe, Router, Wifi, ArrowUp } from "lucide-react";

interface NetworkSummary {
  totalSites: number;
  totalHosts: number;
  totalDevices: number;
  devicesOnline: number;
  devicesOffline: number;
  devicesPendingUpdate: number;
}

interface Props {
  summary: NetworkSummary | undefined;
  isLoading: boolean;
}

export function NetworkSummaryCards({ summary, isLoading }: Props) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 animate-pulse"
          >
            <div className="h-3 w-16 bg-muted rounded mb-3" />
            <div className="h-7 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const onlinePct =
    summary.totalDevices > 0
      ? Math.round((summary.devicesOnline / summary.totalDevices) * 100)
      : 0;

  const cards = [
    {
      label: "Sites",
      value: summary.totalSites,
      icon: Globe,
      accent: "text-blue-400",
    },
    {
      label: "Devices",
      value: summary.totalDevices,
      icon: Router,
      accent: "text-purple-400",
    },
    {
      label: "Online",
      value: `${onlinePct}%`,
      icon: Wifi,
      accent:
        onlinePct >= 95
          ? "text-green-400"
          : onlinePct >= 80
            ? "text-yellow-400"
            : "text-red-400",
      sub:
        summary.devicesOffline > 0
          ? `${summary.devicesOffline} offline`
          : undefined,
      subColor: summary.devicesOffline > 0 ? "text-red-400" : undefined,
    },
    {
      label: "Updates",
      value: summary.devicesPendingUpdate,
      icon: ArrowUp,
      accent:
        summary.devicesPendingUpdate > 0
          ? "text-amber-400"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {card.label}
            </span>
            <card.icon className={cn("h-4 w-4", card.accent)} />
          </div>
          <p className="text-2xl font-semibold text-foreground">{card.value}</p>
          {card.sub && (
            <p className={cn("text-xs mt-0.5", card.subColor ?? "text-muted-foreground")}>
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
