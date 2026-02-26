import { cn } from "@/lib/utils";
import {
  Wifi,
  Router,
  Server,
  HardDrive,
  Monitor,
  ArrowUp,
} from "lucide-react";

interface DeviceMeta {
  productLine?: string;
  shortname?: string;
  firmwareStatus?: string;
  isConsole?: boolean;
  isManaged?: boolean;
  updateAvailable?: string | null;
  hostId?: string;
  hostName?: string;
  [key: string]: unknown;
}

interface Device {
  sourceId: string;
  hostname: string;
  status: "online" | "offline" | "warning" | "unknown";
  model?: string;
  privateIp?: string;
  macAddress?: string;
  agentVersion?: string;
  metadata?: DeviceMeta;
}

function getDeviceIcon(meta?: DeviceMeta) {
  const pl = (meta?.productLine ?? "").toLowerCase();
  if (pl.includes("wireless") || pl.includes("uap")) return Wifi;
  if (pl.includes("switching") || pl.includes("usw")) return Server;
  if (pl.includes("security") || pl.includes("ugw") || meta?.isConsole)
    return Router;
  if (pl.includes("protect") || pl.includes("nvr")) return HardDrive;
  return Monitor;
}

const STATUS_DOT: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-red-500",
  warning: "bg-yellow-500",
  unknown: "bg-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  unknown: "Unknown",
};

export function DeviceRow({ device }: { device: Device }) {
  const meta = device.metadata as DeviceMeta | undefined;
  const Icon = getDeviceIcon(meta);
  const hasUpdate = !!meta?.updateAvailable;
  const firmware = device.agentVersion ?? meta?.firmwareStatus ?? "—";

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent/50 transition-colors rounded-md">
      {/* Icon */}
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0",
          device.status === "online"
            ? "text-muted-foreground"
            : device.status === "offline"
              ? "text-red-400/70"
              : "text-yellow-400/70"
        )}
      />

      {/* Name */}
      <span className="font-medium text-foreground truncate min-w-[120px] flex-1">
        {device.hostname}
      </span>

      {/* Model */}
      <span className="text-muted-foreground truncate w-[100px] hidden md:block">
        {device.model || meta?.shortname || "—"}
      </span>

      {/* IP */}
      <span className="text-muted-foreground font-mono text-xs truncate w-[110px] hidden lg:block">
        {device.privateIp || "—"}
      </span>

      {/* Status */}
      <div className="flex items-center gap-1.5 w-[80px]">
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", STATUS_DOT[device.status])} />
        <span
          className={cn(
            "text-xs",
            device.status === "online"
              ? "text-muted-foreground"
              : device.status === "offline"
                ? "text-red-400"
                : "text-yellow-400"
          )}
        >
          {STATUS_LABEL[device.status]}
        </span>
      </div>

      {/* Firmware */}
      <span className="text-muted-foreground text-xs w-[70px] truncate hidden sm:block">
        {firmware}
      </span>

      {/* Update badge */}
      <div className="w-[24px] flex justify-center">
        {hasUpdate && (
          <span title={`Update available: ${meta!.updateAvailable}`}>
            <ArrowUp className="h-3.5 w-3.5 text-amber-400" />
          </span>
        )}
      </div>
    </div>
  );
}
