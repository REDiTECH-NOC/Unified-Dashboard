"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2, BarChart3, Cpu, HardDrive, MemoryStick } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TabTelemetryProps {
  instanceId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTime(time: string): string {
  const d = new Date(time);
  if (isNaN(d.getTime())) return time;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/* Custom tooltip for charts */
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Chart Card ─── */
function TelemetryChart({
  title,
  icon: Icon,
  data,
  dataKey,
  color,
  formatter,
  domain,
  unit,
}: {
  title: string;
  icon: React.ElementType;
  data: any[];
  dataKey: string;
  color: string;
  formatter?: (v: number) => string;
  domain?: [number, number];
  unit?: string;
}) {
  const latestVal = data.length > 0 ? data[data.length - 1][dataKey] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </div>
        {latestVal !== null && (
          <span className="text-xs font-mono font-medium" style={{ color }}>
            {formatter ? formatter(latestVal) : `${latestVal}${unit || ""}`}
          </span>
        )}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={domain || ["auto", "auto"]}
              tickFormatter={formatter}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<ChartTooltip formatter={formatter} />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Compact Telemetry Charts (embedded in Overview via dynamic import) ─── */
/* Uses 90s refetch to avoid blocking UI — the CSS gauges handle real-time display */
export function TelemetryCharts({ instanceId }: { instanceId: string }) {
  const { data: telemetry, isLoading } = trpc.threecx.getSystemTelemetry.useQuery(
    { instanceId },
    { refetchInterval: 90000, staleTime: 85000 }
  );

  const chartData = (telemetry ?? []).slice(-30).map((point) => ({
    time: point.time,
    cpuUsage: Math.round(point.cpuUsage * 10) / 10,
    memoryUsedPct: point.totalPhysicalMemory > 0
      ? Math.round(((point.totalPhysicalMemory - point.freePhysicalMemory) / point.totalPhysicalMemory) * 1000) / 10
      : 0,
    diskUsedPct: point.totalDiskSpace > 0
      ? Math.round(((point.totalDiskSpace - point.freeDiskSpace) / point.totalDiskSpace) * 1000) / 10
      : 0,
  }));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 h-[220px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  if (chartData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <TelemetryChart title="CPU Usage" icon={Cpu} data={chartData} dataKey="cpuUsage" color="#3b82f6" domain={[0, 100]} formatter={(v) => `${v}%`} />
      <TelemetryChart title="Memory Usage" icon={MemoryStick} data={chartData} dataKey="memoryUsedPct" color="#a855f7" domain={[0, 100]} formatter={(v) => `${v}%`} />
      <TelemetryChart title="Disk Usage" icon={HardDrive} data={chartData} dataKey="diskUsedPct" color="#f97316" domain={[0, 100]} formatter={(v) => `${v}%`} />
    </div>
  );
}

export function TabTelemetry({ instanceId }: TabTelemetryProps) {
  const { data: telemetry, isLoading } = trpc.threecx.getSystemTelemetry.useQuery(
    { instanceId },
    { refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!telemetry || telemetry.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No telemetry data available</p>
          <p className="text-xs mt-1 opacity-60">
            Telemetry data will appear here once the PBX reports system metrics
          </p>
        </div>
      </div>
    );
  }

  // Transform telemetry data for charts
  const chartData = telemetry.map((point) => ({
    time: point.time,
    cpuUsage: Math.round(point.cpuUsage * 10) / 10,
    memoryUsedPct: point.totalPhysicalMemory > 0
      ? Math.round(((point.totalPhysicalMemory - point.freePhysicalMemory) / point.totalPhysicalMemory) * 1000) / 10
      : 0,
    memoryUsed: point.totalPhysicalMemory - point.freePhysicalMemory,
    memoryTotal: point.totalPhysicalMemory,
    diskUsedPct: point.totalDiskSpace > 0
      ? Math.round(((point.totalDiskSpace - point.freeDiskSpace) / point.totalDiskSpace) * 1000) / 10
      : 0,
    diskUsed: point.totalDiskSpace - point.freeDiskSpace,
    diskTotal: point.totalDiskSpace,
  }));

  // Get latest values for summary
  const latest = chartData[chartData.length - 1];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
            <Cpu className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPU Usage</p>
            <p className={cn("text-lg font-semibold",
              latest.cpuUsage >= 90 ? "text-red-500" :
              latest.cpuUsage >= 70 ? "text-yellow-500" : "text-foreground"
            )}>
              {latest.cpuUsage}%
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
            <MemoryStick className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Memory</p>
            <p className={cn("text-lg font-semibold",
              latest.memoryUsedPct >= 90 ? "text-red-500" :
              latest.memoryUsedPct >= 70 ? "text-yellow-500" : "text-foreground"
            )}>
              {latest.memoryUsedPct}%
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/10">
            <HardDrive className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disk</p>
            <p className={cn("text-lg font-semibold",
              latest.diskUsedPct >= 90 ? "text-red-500" :
              latest.diskUsedPct >= 70 ? "text-yellow-500" : "text-foreground"
            )}>
              {latest.diskUsedPct}%
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TelemetryChart
          title="CPU Usage"
          icon={Cpu}
          data={chartData}
          dataKey="cpuUsage"
          color="#3b82f6"
          domain={[0, 100]}
          formatter={(v) => `${v}%`}
        />
        <TelemetryChart
          title="Memory Usage"
          icon={MemoryStick}
          data={chartData}
          dataKey="memoryUsedPct"
          color="#a855f7"
          domain={[0, 100]}
          formatter={(v) => `${v}%`}
        />
      </div>
      <TelemetryChart
        title="Disk Usage"
        icon={HardDrive}
        data={chartData}
        dataKey="diskUsedPct"
        color="#f97316"
        domain={[0, 100]}
        formatter={(v) => `${v}%`}
      />
    </div>
  );
}
