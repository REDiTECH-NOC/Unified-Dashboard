"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowUpCircle,
  ArrowDownCircle,
  PauseCircle,
  Plus,
  Trash2,
  Play,
  Pause,
  Globe,
  Server,
  Wifi,
  X,
  Loader2,
  Pencil,
  Zap,
  ShieldCheck,
  Clock,
  Search,
  RefreshCw,
  ChevronDown,
  FileText,
  Database,
  Container,
  HardDrive,
  Building2,
  Tag,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/hooks/use-timezone";

/* ─── STATUS HELPERS ────────────────────────────────────────── */

function statusColor(status: string | undefined | null) {
  switch (status) {
    case "UP":      return "text-green-500";
    case "DOWN":    return "text-red-500";
    case "PENDING": return "text-yellow-500";
    default:        return "text-muted-foreground";
  }
}

function statusDot(status: string | undefined | null) {
  switch (status) {
    case "UP":      return "bg-green-500";
    case "DOWN":    return "bg-red-500";
    case "PENDING": return "bg-yellow-500";
    default:        return "bg-muted-foreground";
  }
}

function statusLabel(status: string | undefined | null) {
  switch (status) {
    case "UP":      return "Up";
    case "DOWN":    return "Down";
    case "PENDING": return "Pending";
    default:        return "Unknown";
  }
}

const typeIcon: Record<string, React.ElementType> = {
  HTTP: Globe,
  TCP: Server,
  PING: Wifi,
  DNS: Globe,
  REDIS: HardDrive,
  MYSQL: Database,
  POSTGRESQL: Database,
  SQLSERVER: Database,
  MONGODB: Database,
  DOCKER: Container,
};

function getTarget(type: string, config: Record<string, unknown>): string {
  switch (type) {
    case "HTTP":       return (config.url as string) || "";
    case "TCP":        return `${config.hostname}:${config.port}`;
    case "PING":       return (config.hostname as string) || "";
    case "DNS":        return `${config.hostname} (${config.recordType || "A"})`;
    case "REDIS":      return (config.connectionString as string)?.replace(/\/\/[^@]*@/, "//***@") || "";
    case "MYSQL":      return `${config.host}:${config.port || 3306}${config.database ? `/${config.database}` : ""}`;
    case "POSTGRESQL":  return `${config.host}:${config.port || 5432}${config.database ? `/${config.database}` : ""}`;
    case "SQLSERVER":  return `${config.host}:${config.port || 1433}${config.database ? `/${config.database}` : ""}`;
    case "MONGODB":    return (config.connectionString as string)?.replace(/\/\/[^@]*@/, "//***@") || "";
    case "DOCKER":     return `${config.containerId}`;
    default:           return "";
  }
}

/* ─── FORM INPUT HELPERS ─────────────────────────────────────── */

const inputClass = "w-full h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50";
const selectClass = "w-full h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-red-500/50";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/* ─── STAT CARD ──────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="relative rounded-xl p-5 bg-card border border-border shadow-card-light dark:shadow-card overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/20 to-transparent" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* ─── UPTIME BAR ─────────────────────────────────────────────── */

function UptimeBar({ monitorId }: { monitorId: string }) {
  const { time } = useTimezone();
  const { data: bars } = trpc.uptime.uptimeBars.useQuery(
    { monitorId, segments: 45 },
    { refetchInterval: 60000 }
  );

  if (!bars) return <div className="flex gap-px h-6 items-end">{Array.from({ length: 45 }).map((_, i) => <div key={i} className="flex-1 h-full rounded-sm bg-muted/30" />)}</div>;

  return (
    <div className="flex gap-px h-6 items-end group/bar">
      {bars.map((bar, i) => {
        const bg = bar.status === "UP" ? "bg-green-500" : bar.status === "DOWN" ? "bg-red-500" : bar.status === "PENDING" ? "bg-yellow-500" : "bg-muted/30";
        return (
          <div
            key={i}
            className={cn("flex-1 rounded-sm transition-all relative", bg, bar.status ? "h-full hover:opacity-80" : "h-full")}
            title={bar.status ? `${time(bar.timestamp)} — ${bar.status}${bar.latencyMs ? ` (${bar.latencyMs}ms)` : ""}` : "No data"}
          />
        );
      })}
    </div>
  );
}

/* ─── RESPONSE TIME CHART ────────────────────────────────────── */

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
] as const;

function ResponseTimeChart({ monitorId }: { monitorId: string }) {
  const { timeShort, dateShort, dateTime } = useTimezone();
  const [range, setRange] = useState<number>(24);
  const { data } = trpc.uptime.heartbeats.useQuery(
    { monitorId, hours: range, limit: 200 },
    { refetchInterval: 60000 }
  );

  const chartData = (data?.items || [])
    .filter((hb) => hb.latencyMs !== null)
    .map((hb) => ({
      time: new Date(hb.timestamp).getTime(),
      latency: hb.latencyMs,
      status: hb.status,
    }))
    .reverse();

  const avgLatency = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + (d.latency || 0), 0) / chartData.length)
    : null;
  const minLatency = chartData.length > 0
    ? Math.min(...chartData.map((d) => d.latency || Infinity))
    : null;
  const maxLatency = chartData.length > 0
    ? Math.max(...chartData.map((d) => d.latency || 0))
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Response Time</p>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setRange(r.hours)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded transition-colors",
                range === r.hours ? "bg-red-600 text-white" : "bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => range <= 24 ? timeShort(v) : dateShort(v)}
                  tick={{ fontSize: 9, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  tickFormatter={(v) => `${v}ms`}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#1c1c1e", border: "1px solid #27272a", borderRadius: "8px", fontSize: "11px" }}
                  labelFormatter={(v) => dateTime(v)}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}ms`, "Latency"]}
                />
                <Area type="monotone" dataKey="latency" stroke="#ef4444" fill="url(#latencyGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
            <span>Min: <span className="text-green-500 font-medium">{minLatency}ms</span></span>
            <span>Avg: <span className="text-foreground font-medium">{avgLatency}ms</span></span>
            <span>Max: <span className="text-red-500 font-medium">{maxLatency}ms</span></span>
          </div>
        </>
      ) : (
        <div className="h-36 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
      )}
    </div>
  );
}

/* ─── MONITOR DETAIL PANEL ───────────────────────────────────── */

function MonitorDetail({ monitorId, onClose }: { monitorId: string; onClose: () => void }) {
  const { dateTime, time } = useTimezone();
  const { data: monitor } = trpc.uptime.get.useQuery({ id: monitorId }, { refetchInterval: 15000 });
  const { data: stats } = trpc.uptime.stats.useQuery({ monitorId }, { refetchInterval: 30000 });
  const testNow = trpc.uptime.testNow.useMutation();
  const [testResult, setTestResult] = useState<{ status: string; latencyMs: number; message?: string } | null>(null);

  if (!monitor) return null;

  const config = (monitor.config as Record<string, unknown>) || {};
  const latestHb = monitor.heartbeats[0];
  const tlsInfo = latestHb?.tlsInfo as Record<string, unknown> | null;
  const dnsResult = latestHb?.dnsResult as Record<string, unknown> | null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", statusDot(monitor.status))} />
            <h2 className="text-lg font-semibold text-foreground">{monitor.name}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{monitor.type}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                setTestResult(null);
                const r = await testNow.mutateAsync({ id: monitorId });
                setTestResult(r);
              }}
              disabled={testNow.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent/80 text-foreground transition-colors disabled:opacity-50"
              title="Test Now"
            >
              {testNow.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Test
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Test Result Banner */}
          {testResult && (
            <div className={cn("rounded-lg border p-3 text-xs", testResult.status === "UP" ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10")}>
              <div className="flex items-center justify-between">
                <span className={cn("font-medium", testResult.status === "UP" ? "text-green-500" : "text-red-500")}>{testResult.status}</span>
                <span className="text-muted-foreground">{testResult.latencyMs}ms</span>
              </div>
              {testResult.message && <p className="text-muted-foreground mt-1">{testResult.message}</p>}
            </div>
          )}

          {/* Status + Target */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", statusColor(monitor.status))}>{statusLabel(monitor.status)}</span>
              {latestHb?.latencyMs && <span className="text-xs text-muted-foreground">{latestHb.latencyMs}ms</span>}
            </div>
            <p className="text-xs text-muted-foreground break-all">{getTarget(monitor.type, config)}</p>
            <p className="text-xs text-muted-foreground">
              Every {monitor.intervalSeconds}s | Timeout {monitor.timeoutMs}ms | {monitor.maxRetries} retries
              {monitor.description && <> — {monitor.description}</>}
            </p>
            {monitor.lastCheckedAt && (
              <p className="text-[10px] text-muted-foreground">
                Last checked: {dateTime(monitor.lastCheckedAt)}
                {monitor.lastStatusChange && <> | Status since: {dateTime(monitor.lastStatusChange)}</>}
              </p>
            )}
          </div>

          {/* Uptime Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "24h", value: stats.uptime24h },
                { label: "7d", value: stats.uptime7d },
                { label: "30d", value: stats.uptime30d },
                { label: "Avg Latency", value: stats.avgLatency24h, isLatency: true },
              ].map(({ label, value, isLatency }) => (
                <div key={label} className="rounded-lg bg-accent/50 p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  {isLatency ? (
                    <p className="text-sm font-bold mt-0.5 text-foreground">
                      {value !== null ? `${Math.round(value as number)}ms` : "—"}
                    </p>
                  ) : (
                    <p className={cn("text-sm font-bold mt-0.5", value !== null && (value as number) >= 99 ? "text-green-500" : value !== null && (value as number) >= 95 ? "text-yellow-500" : value !== null ? "text-red-500" : "text-muted-foreground")}>
                      {value !== null ? `${(value as number).toFixed(1)}%` : "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Uptime Bar */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Last 24 Hours</p>
            <UptimeBar monitorId={monitorId} />
          </div>

          {/* Response Time Chart */}
          <ResponseTimeChart monitorId={monitorId} />

          {/* SSL Certificate Info */}
          {tlsInfo && (
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-foreground">SSL Certificate</span>
              </div>
              <p className="text-xs text-muted-foreground">Issuer: {String(tlsInfo.issuer)}</p>
              <p className="text-xs text-muted-foreground">Subject: {String(tlsInfo.subject)}</p>
              <p className="text-xs text-muted-foreground">Valid: {String(tlsInfo.validFrom)} — {String(tlsInfo.validTo)}</p>
              <p className={cn("text-xs font-medium", Number(tlsInfo.daysUntilExpiry) > 30 ? "text-green-500" : Number(tlsInfo.daysUntilExpiry) > 7 ? "text-yellow-500" : "text-red-500")}>
                Expires in {Number(tlsInfo.daysUntilExpiry)} days
              </p>
            </div>
          )}

          {/* DNS Result */}
          {dnsResult && (
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-foreground">DNS Result</span>
              </div>
              {Array.isArray(dnsResult.records) && (
                <div className="space-y-0.5">
                  {(dnsResult.records as unknown[]).map((rec, i) => (
                    <p key={i} className="text-xs text-muted-foreground font-mono">{typeof rec === "string" ? rec : JSON.stringify(rec)}</p>
                  ))}
                </div>
              )}
              {typeof dnsResult.server === "string" && <p className="text-[10px] text-muted-foreground mt-1">Resolver: {dnsResult.server}</p>}
            </div>
          )}

          {/* Recent Heartbeats */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Checks</p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {monitor.heartbeats.slice(0, 30).map((hb) => (
                <div key={hb.id} className="flex items-center gap-2 text-xs py-1">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", statusDot(hb.status))} />
                  <span className="text-muted-foreground shrink-0">{time(hb.timestamp)}</span>
                  {hb.latencyMs && <span className="text-muted-foreground shrink-0">{hb.latencyMs}ms</span>}
                  <span className="text-muted-foreground truncate flex-1">{hb.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MONITOR FORM DIALOG ────────────────────────────────────── */

const MONITOR_TYPES = [
  { value: "HTTP" as const,       label: "HTTP(S)",     icon: Globe,     description: "Website & API" },
  { value: "TCP" as const,        label: "TCP Port",    icon: Server,    description: "Port check" },
  { value: "PING" as const,       label: "Ping",        icon: Wifi,      description: "ICMP ping" },
  { value: "DNS" as const,        label: "DNS",         icon: Globe,     description: "DNS resolve" },
  { value: "REDIS" as const,      label: "Redis",       icon: HardDrive, description: "Redis cache" },
  { value: "MYSQL" as const,      label: "MySQL",       icon: Database,  description: "MySQL DB" },
  { value: "POSTGRESQL" as const, label: "PostgreSQL",  icon: Database,  description: "PostgreSQL DB" },
  { value: "SQLSERVER" as const,  label: "SQL Server",  icon: Database,  description: "MSSQL DB" },
  { value: "MONGODB" as const,    label: "MongoDB",     icon: Database,  description: "MongoDB" },
  { value: "DOCKER" as const,     label: "Docker",      icon: Container, description: "Container" },
];

const DNS_RECORD_TYPES = ["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SOA", "SRV", "TXT"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

type MonitorTypeValue = "HTTP" | "TCP" | "PING" | "DNS" | "REDIS" | "MYSQL" | "POSTGRESQL" | "SQLSERVER" | "MONGODB" | "DOCKER";

interface FormState {
  name: string;
  type: MonitorTypeValue;
  description: string;
  intervalSeconds: number;
  retrySeconds: number;
  maxRetries: number;
  timeoutMs: number;
  sslExpiryDays: number;
  // HTTP
  url: string;
  method: string;
  expectedStatus: string;
  keyword: string;
  invertKeyword: boolean;
  followRedirects: boolean;
  ignoreTls: boolean;
  authType: string;
  authUser: string;
  authPass: string;
  headers: string;
  body: string;
  // TCP
  tcpHostname: string;
  tcpPort: string;
  // PING
  pingHostname: string;
  packetSize: string;
  // DNS
  dnsHostname: string;
  resolveServer: string;
  recordType: string;
  expectedValue: string;
  // Redis
  redisConnectionString: string;
  redisIgnoreTls: boolean;
  // MySQL / PostgreSQL / SQL Server (shared fields)
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  dbDatabase: string;
  // MongoDB
  mongoConnectionString: string;
  // Docker
  dockerContainerId: string;
  dockerHost: string;
  // Organization + Tags
  companyId: string;
  selectedTagIds: string[];
}

const defaultForm: FormState = {
  name: "", type: "HTTP", description: "",
  intervalSeconds: 60, retrySeconds: 60, maxRetries: 3, timeoutMs: 10000, sslExpiryDays: 30,
  url: "", method: "GET", expectedStatus: "200-299", keyword: "", invertKeyword: false,
  followRedirects: true, ignoreTls: false, authType: "none", authUser: "", authPass: "",
  headers: "", body: "",
  tcpHostname: "", tcpPort: "",
  pingHostname: "", packetSize: "56",
  dnsHostname: "", resolveServer: "1.1.1.1", recordType: "A", expectedValue: "",
  redisConnectionString: "", redisIgnoreTls: false,
  dbHost: "", dbPort: "", dbUsername: "", dbPassword: "", dbDatabase: "",
  mongoConnectionString: "",
  dockerContainerId: "", dockerHost: "http://localhost:2375",
  companyId: "", selectedTagIds: [],
};

function buildConfig(form: FormState): Record<string, unknown> {
  const defaultDbPort: Record<string, number> = { MYSQL: 3306, POSTGRESQL: 5432, SQLSERVER: 1433 };
  switch (form.type) {
    case "HTTP": return {
      url: form.url, method: form.method, expectedStatus: form.expectedStatus,
      keyword: form.keyword || undefined, invertKeyword: form.invertKeyword,
      followRedirects: form.followRedirects, ignoreTls: form.ignoreTls,
      authType: form.authType, authUser: form.authUser || undefined, authPass: form.authPass || undefined,
      headers: form.headers ? JSON.parse(form.headers) : undefined,
      body: form.body || undefined,
    };
    case "TCP": return { hostname: form.tcpHostname, port: parseInt(form.tcpPort, 10) };
    case "PING": return { hostname: form.pingHostname, packetSize: parseInt(form.packetSize, 10) || 56 };
    case "DNS": return {
      hostname: form.dnsHostname, resolveServer: form.resolveServer, recordType: form.recordType,
      expectedValue: form.expectedValue || undefined,
    };
    case "REDIS": return {
      connectionString: form.redisConnectionString, ignoreTls: form.redisIgnoreTls,
    };
    case "MYSQL":
    case "POSTGRESQL":
    case "SQLSERVER": return {
      host: form.dbHost,
      port: parseInt(form.dbPort, 10) || defaultDbPort[form.type],
      username: form.dbUsername || undefined,
      password: form.dbPassword || undefined,
      database: form.dbDatabase || undefined,
    };
    case "MONGODB": return {
      connectionString: form.mongoConnectionString,
    };
    case "DOCKER": return {
      containerId: form.dockerContainerId,
      dockerHost: form.dockerHost || "http://localhost:2375",
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formFromMonitor(monitor: any): FormState {
  const config = (monitor.config || {}) as Record<string, unknown>;
  const base = {
    ...defaultForm,
    name: monitor.name,
    type: monitor.type,
    description: monitor.description || "",
    intervalSeconds: monitor.intervalSeconds,
    retrySeconds: monitor.retrySeconds,
    maxRetries: monitor.maxRetries,
    timeoutMs: monitor.timeoutMs,
    sslExpiryDays: monitor.sslExpiryDays,
    companyId: monitor.company?.id || "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedTagIds: (monitor.tags || []).map((t: any) => t.id),
  };

  switch (monitor.type) {
    case "HTTP": return { ...base,
      url: (config.url as string) || "", method: (config.method as string) || "GET",
      expectedStatus: (config.expectedStatus as string) || "200-299",
      keyword: (config.keyword as string) || "", invertKeyword: !!config.invertKeyword,
      followRedirects: config.followRedirects !== false, ignoreTls: !!config.ignoreTls,
      authType: (config.authType as string) || "none", authUser: (config.authUser as string) || "",
      authPass: (config.authPass as string) || "",
      headers: config.headers ? JSON.stringify(config.headers, null, 2) : "",
      body: (config.body as string) || "",
    };
    case "TCP": return { ...base, tcpHostname: (config.hostname as string) || "", tcpPort: String(config.port || "") };
    case "PING": return { ...base, pingHostname: (config.hostname as string) || "", packetSize: String(config.packetSize || 56) };
    case "DNS": return { ...base,
      dnsHostname: (config.hostname as string) || "", resolveServer: (config.resolveServer as string) || "1.1.1.1",
      recordType: (config.recordType as string) || "A", expectedValue: (config.expectedValue as string) || "",
    };
    case "REDIS": return { ...base,
      redisConnectionString: (config.connectionString as string) || "",
      redisIgnoreTls: !!config.ignoreTls,
    };
    case "MYSQL":
    case "POSTGRESQL":
    case "SQLSERVER": return { ...base,
      dbHost: (config.host as string) || "",
      dbPort: String(config.port || ""),
      dbUsername: (config.username as string) || "",
      dbPassword: (config.password as string) || "",
      dbDatabase: (config.database as string) || "",
    };
    case "MONGODB": return { ...base,
      mongoConnectionString: (config.connectionString as string) || "",
    };
    case "DOCKER": return { ...base,
      dockerContainerId: (config.containerId as string) || "",
      dockerHost: (config.dockerHost as string) || "http://localhost:2375",
    };
    default: return base;
  }
}

function MonitorFormDialog({ open, onClose, onSuccess, editMonitor }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editMonitor?: any | null;
}) {
  const [form, setForm] = useState<FormState>(() => {
    return editMonitor ? formFromMonitor(editMonitor) : { ...defaultForm };
  });
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#ef4444");
  const companyDropdownRef = useRef<HTMLDivElement>(null);


  const addMutation = trpc.uptime.add.useMutation();
  const editMutation = trpc.uptime.edit.useMutation();
  const utils = trpc.useUtils();

  // Queries for companies and tags
  const { data: companies } = trpc.uptime.listCompanies.useQuery(
    { search: companySearch || undefined },
    { enabled: open }
  );
  const { data: allTags } = trpc.uptime.listTags.useQuery(undefined, { enabled: open });
  const createTagMutation = trpc.uptime.createTag.useMutation({
    onSuccess: () => utils.uptime.listTags.invalidate(),
  });
  const deleteTagMutation = trpc.uptime.deleteTag.useMutation({
    onSuccess: () => utils.uptime.listTags.invalidate(),
  });

  // Close company dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Find selected company name for display
  const selectedCompany = form.companyId
    ? companies?.find((c) => c.id === form.companyId) || (editMonitor?.company?.id === form.companyId ? editMonitor.company : null)
    : null;

  const isEdit = !!editMonitor;
  const isLoading = addMutation.isPending || editMutation.isPending;

  function updateForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit() {
    setError(null);
    try {
      const config = buildConfig(form);
      const shared = {
        name: form.name, type: form.type, description: form.description,
        intervalSeconds: form.intervalSeconds, retrySeconds: form.retrySeconds,
        maxRetries: form.maxRetries, timeoutMs: form.timeoutMs, sslExpiryDays: form.sslExpiryDays,
        config,
        companyId: form.companyId || null,
        tagIds: form.selectedTagIds,
      };
      if (isEdit) {
        await editMutation.mutateAsync({ id: editMonitor.id, ...shared });
      } else {
        await addMutation.mutateAsync(shared);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] bg-card border border-border rounded-xl shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b border-border">
          <h2 className="text-lg font-semibold">{isEdit ? "Edit Monitor" : "Add Monitor"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <FormField label="Name">
            <input className={inputClass} value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="My Website" />
          </FormField>

          {/* Type Selector */}
          {!isEdit && (
            <FormField label="Monitor Type">
              <div className="grid grid-cols-5 gap-1.5">
                {MONITOR_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.value} type="button" onClick={() => updateForm({ type: t.value })}
                      className={cn("flex flex-col items-center gap-1 p-2.5 rounded-lg border text-[11px] transition-all", form.type === t.value ? "border-red-500 bg-red-500/10 text-foreground" : "border-border bg-accent/50 text-muted-foreground hover:border-muted-foreground")}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="truncate w-full text-center">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </FormField>
          )}

          {/* Description */}
          <FormField label="Description" hint="Optional">
            <input className={inputClass} value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="Monitor description" />
          </FormField>

          {/* ── Type-specific Config ── */}

          {form.type === "HTTP" && (
            <>
              <FormField label="URL">
                <input className={inputClass} value={form.url} onChange={(e) => updateForm({ url: e.target.value })} placeholder="https://example.com" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Method">
                  <select className={selectClass} value={form.method} onChange={(e) => updateForm({ method: e.target.value })}>
                    {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label="Expected Status">
                  <input className={inputClass} value={form.expectedStatus} onChange={(e) => updateForm({ expectedStatus: e.target.value })} placeholder="200-299" />
                </FormField>
              </div>
              <FormField label="Keyword" hint="Check if response body contains this text">
                <input className={inputClass} value={form.keyword} onChange={(e) => updateForm({ keyword: e.target.value })} placeholder="OK" />
              </FormField>
              {form.keyword && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={form.invertKeyword} onChange={(e) => updateForm({ invertKeyword: e.target.checked })} />
                  Invert (fail if keyword IS found)
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Auth">
                  <select className={selectClass} value={form.authType} onChange={(e) => updateForm({ authType: e.target.value })}>
                    <option value="none">None</option>
                    <option value="basic">HTTP Basic</option>
                  </select>
                </FormField>
                {form.authType === "basic" && (
                  <FormField label="Username">
                    <input className={inputClass} value={form.authUser} onChange={(e) => updateForm({ authUser: e.target.value })} />
                  </FormField>
                )}
              </div>
              {form.authType === "basic" && (
                <FormField label="Password">
                  <input className={inputClass} type="password" value={form.authPass} onChange={(e) => updateForm({ authPass: e.target.value })} />
                </FormField>
              )}
              {/* Headers */}
              <FormField label="Custom Headers" hint="JSON object, e.g. {&quot;X-Api-Key&quot;: &quot;abc&quot;}">
                <textarea className={cn(inputClass, "h-16 py-2 resize-none font-mono text-[11px]")} value={form.headers} onChange={(e) => updateForm({ headers: e.target.value })} placeholder='{"Content-Type": "application/json"}' />
              </FormField>

              {/* Body */}
              {form.method && !["GET", "HEAD"].includes(form.method) && (
                <FormField label="Request Body" hint="Sent with POST/PUT/PATCH requests">
                  <textarea className={cn(inputClass, "h-20 py-2 resize-none font-mono text-[11px]")} value={form.body} onChange={(e) => updateForm({ body: e.target.value })} placeholder='{"key": "value"}' />
                </FormField>
              )}

              <div className="flex gap-4 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.followRedirects} onChange={(e) => updateForm({ followRedirects: e.target.checked })} />
                  Follow redirects
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.ignoreTls} onChange={(e) => updateForm({ ignoreTls: e.target.checked })} />
                  Ignore TLS errors
                </label>
              </div>
            </>
          )}

          {form.type === "TCP" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField label="Hostname">
                  <input className={inputClass} value={form.tcpHostname} onChange={(e) => updateForm({ tcpHostname: e.target.value })} placeholder="192.168.1.1" />
                </FormField>
              </div>
              <FormField label="Port">
                <input className={inputClass} type="number" value={form.tcpPort} onChange={(e) => updateForm({ tcpPort: e.target.value })} placeholder="443" />
              </FormField>
            </div>
          )}

          {form.type === "PING" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField label="Hostname / IP">
                  <input className={inputClass} value={form.pingHostname} onChange={(e) => updateForm({ pingHostname: e.target.value })} placeholder="8.8.8.8" />
                </FormField>
              </div>
              <FormField label="Packet Size" hint="bytes">
                <input className={inputClass} type="number" value={form.packetSize} onChange={(e) => updateForm({ packetSize: e.target.value })} placeholder="56" />
              </FormField>
            </div>
          )}

          {form.type === "DNS" && (
            <>
              <FormField label="Hostname">
                <input className={inputClass} value={form.dnsHostname} onChange={(e) => updateForm({ dnsHostname: e.target.value })} placeholder="example.com" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Record Type">
                  <select className={selectClass} value={form.recordType} onChange={(e) => updateForm({ recordType: e.target.value })}>
                    {DNS_RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="DNS Server">
                  <input className={inputClass} value={form.resolveServer} onChange={(e) => updateForm({ resolveServer: e.target.value })} placeholder="1.1.1.1" />
                </FormField>
              </div>
              <FormField label="Expected Value" hint="Optional — fail if result doesn't contain this">
                <input className={inputClass} value={form.expectedValue} onChange={(e) => updateForm({ expectedValue: e.target.value })} />
              </FormField>
            </>
          )}

          {form.type === "REDIS" && (
            <>
              <FormField label="Connection String" hint="redis://[user:pass@]host[:port][/db] — use rediss:// for TLS">
                <input className={inputClass} value={form.redisConnectionString} onChange={(e) => updateForm({ redisConnectionString: e.target.value })} placeholder="redis://localhost:6379" />
              </FormField>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.redisIgnoreTls} onChange={(e) => updateForm({ redisIgnoreTls: e.target.checked })} />
                Ignore TLS certificate errors
              </label>
            </>
          )}

          {(form.type === "MYSQL" || form.type === "POSTGRESQL" || form.type === "SQLSERVER") && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormField label="Host">
                    <input className={inputClass} value={form.dbHost} onChange={(e) => updateForm({ dbHost: e.target.value })} placeholder="db.example.com" />
                  </FormField>
                </div>
                <FormField label="Port">
                  <input className={inputClass} type="number" value={form.dbPort} onChange={(e) => updateForm({ dbPort: e.target.value })} placeholder={form.type === "MYSQL" ? "3306" : form.type === "POSTGRESQL" ? "5432" : "1433"} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Username" hint="Optional">
                  <input className={inputClass} value={form.dbUsername} onChange={(e) => updateForm({ dbUsername: e.target.value })} placeholder={form.type === "POSTGRESQL" ? "postgres" : "root"} />
                </FormField>
                <FormField label="Password" hint="Optional">
                  <input className={inputClass} type="password" value={form.dbPassword} onChange={(e) => updateForm({ dbPassword: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Database" hint="Optional — checks server-level connectivity if blank">
                <input className={inputClass} value={form.dbDatabase} onChange={(e) => updateForm({ dbDatabase: e.target.value })} placeholder="mydb" />
              </FormField>
            </>
          )}

          {form.type === "MONGODB" && (
            <FormField label="Connection String" hint="mongodb://user:pass@host:port/db or mongodb+srv://...">
              <input className={inputClass} value={form.mongoConnectionString} onChange={(e) => updateForm({ mongoConnectionString: e.target.value })} placeholder="mongodb://localhost:27017" />
            </FormField>
          )}

          {form.type === "DOCKER" && (
            <>
              <FormField label="Container ID or Name">
                <input className={inputClass} value={form.dockerContainerId} onChange={(e) => updateForm({ dockerContainerId: e.target.value })} placeholder="my-container or abc123def456" />
              </FormField>
              <FormField label="Docker Host" hint="Docker Engine API endpoint">
                <input className={inputClass} value={form.dockerHost} onChange={(e) => updateForm({ dockerHost: e.target.value })} placeholder="http://localhost:2375" />
              </FormField>
            </>
          )}

          {/* ── Organization & Tags ── */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-3">Organization & Tags</p>

            {/* Company Combobox */}
            <div className="mb-3">
              <label className={labelClass}>Assign to Organization</label>
              <div ref={companyDropdownRef} className="relative">
                <div
                  className={cn(inputClass, "flex items-center gap-2 cursor-pointer")}
                  onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                >
                  {selectedCompany ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{selectedCompany.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updateForm({ companyId: "" }); }}
                        className="p-0.5 rounded hover:bg-background/50"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None — select organization...</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                </div>
                {companyDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          className="w-full h-7 pl-7 pr-3 rounded bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                          placeholder="Search organizations..."
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent transition-colors"
                        onClick={() => { updateForm({ companyId: "" }); setCompanyDropdownOpen(false); setCompanySearch(""); }}
                      >
                        None (unassigned)
                      </button>
                      {(companies || []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors flex items-center justify-between",
                            form.companyId === c.id ? "text-red-500 bg-red-500/5" : "text-foreground"
                          )}
                          onClick={() => { updateForm({ companyId: c.id }); setCompanyDropdownOpen(false); setCompanySearch(""); }}
                        >
                          <span className="truncate">{c.name}</span>
                          {c.identifier && <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{c.identifier}</span>}
                        </button>
                      ))}
                      {companies && companies.length === 0 && (
                        <p className="px-3 py-4 text-xs text-muted-foreground text-center">No organizations found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass}>Tags</label>
                <button
                  type="button"
                  onClick={() => setShowTagManager(!showTagManager)}
                  className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                >
                  {showTagManager ? "Done" : "Manage Tags"}
                </button>
              </div>

              {/* Tag Manager (create / delete) */}
              {showTagManager && (
                <div className="mb-2 p-2.5 rounded-lg bg-accent/50 border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 h-7 px-2 rounded bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none"
                      placeholder="New tag name..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <button
                      type="button"
                      disabled={!newTagName.trim() || createTagMutation.isPending}
                      onClick={async () => {
                        if (!newTagName.trim()) return;
                        await createTagMutation.mutateAsync({ name: newTagName.trim(), color: newTagColor });
                        setNewTagName("");
                      }}
                      className="h-7 px-2.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[10px] font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {(allTags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(allTags || []).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                          style={{ borderColor: tag.color + "50", backgroundColor: tag.color + "15", color: tag.color }}
                        >
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete tag "${tag.name}"?`)) {
                                deleteTagMutation.mutate({ id: tag.id });
                                updateForm({ selectedTagIds: form.selectedTagIds.filter((id) => id !== tag.id) });
                              }
                            }}
                            className="hover:opacity-70"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tag Selection */}
              {(allTags || []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(allTags || []).map((tag) => {
                    const selected = form.selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          updateForm({
                            selectedTagIds: selected
                              ? form.selectedTagIds.filter((id) => id !== tag.id)
                              : [...form.selectedTagIds, tag.id],
                          });
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                          selected
                            ? "ring-1 ring-offset-1 ring-offset-card"
                            : "opacity-50 hover:opacity-80"
                        )}
                        style={{
                          borderColor: tag.color + (selected ? "80" : "40"),
                          backgroundColor: tag.color + (selected ? "25" : "10"),
                          color: tag.color,
                          ...(selected ? { ringColor: tag.color } : {}),
                        }}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">No tags created yet. Click &quot;Manage Tags&quot; to add some.</p>
              )}
            </div>
          </div>

          {/* ── Scheduling ── */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-3">Scheduling</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Check Interval (seconds)">
                <input className={inputClass} type="number" value={form.intervalSeconds} onChange={(e) => updateForm({ intervalSeconds: parseInt(e.target.value, 10) || 60 })} />
              </FormField>
              <FormField label="Timeout (ms)">
                <input className={inputClass} type="number" value={form.timeoutMs} onChange={(e) => updateForm({ timeoutMs: parseInt(e.target.value, 10) || 10000 })} />
              </FormField>
              <FormField label="Retry Interval (seconds)">
                <input className={inputClass} type="number" value={form.retrySeconds} onChange={(e) => updateForm({ retrySeconds: parseInt(e.target.value, 10) || 60 })} />
              </FormField>
              <FormField label="Max Retries">
                <input className={inputClass} type="number" value={form.maxRetries} onChange={(e) => updateForm({ maxRetries: parseInt(e.target.value, 10) || 3 })} />
              </FormField>
            </div>
            {form.type === "HTTP" && (
              <FormField label="SSL Expiry Warning (days)" hint="Alert when SSL cert expires within this many days">
                <input className={inputClass} type="number" value={form.sslExpiryDays} onChange={(e) => updateForm({ sslExpiryDays: parseInt(e.target.value, 10) || 30 })} />
              </FormField>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={isLoading || !form.name}
            className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Monitor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MONITOR ROW ────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MonitorRow({ monitor, onEdit, onDetail }: { monitor: any; onEdit: () => void; onDetail: () => void }) {
  const { time } = useTimezone();
  const utils = trpc.useUtils();
  const pauseMutation = trpc.uptime.pause.useMutation({ onSuccess: () => utils.uptime.list.invalidate() });
  const resumeMutation = trpc.uptime.resume.useMutation({ onSuccess: () => utils.uptime.list.invalidate() });
  const deleteMutation = trpc.uptime.delete.useMutation({ onSuccess: () => utils.uptime.list.invalidate() });

  const config = (monitor.config || {}) as Record<string, unknown>;
  const target = getTarget(monitor.type, config);
  const Icon = typeIcon[monitor.type as string] || Activity;
  const hb = monitor.latestHeartbeat;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/50 rounded-lg transition-colors cursor-pointer" onClick={onDetail}>
      {/* Status dot */}
      {monitor.active ? (
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusDot(monitor.status))} />
      ) : (
        <Pause className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      {/* Name + target + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{monitor.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground shrink-0">{monitor.type}</span>
          {monitor.company && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 flex items-center gap-1">
              <Building2 className="h-2.5 w-2.5" />
              {monitor.company.name}
            </span>
          )}
          {monitor.tags?.map((tag: { id: string; name: string; color: string }) => (
            <span
              key={tag.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0"
              style={{ borderColor: tag.color + "40", backgroundColor: tag.color + "15", color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground truncate">{target}</p>
      </div>

      {/* Uptime bar (hidden on small screens) */}
      <div className="hidden lg:block w-48 shrink-0">
        <UptimeBar monitorId={monitor.id} />
      </div>

      {/* Latency */}
      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground w-16 justify-end shrink-0">
        {hb?.latencyMs ? <><Clock className="h-3 w-3" />{hb.latencyMs}ms</> : "—"}
      </div>

      {/* Interval + Last Checked */}
      <div className="hidden md:flex flex-col items-end text-[10px] text-muted-foreground w-20 shrink-0">
        <span>{monitor.intervalSeconds}s interval</span>
        {monitor.lastCheckedAt && <span>{time(monitor.lastCheckedAt)}</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-accent" title="Edit">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {monitor.active ? (
          <button onClick={() => pauseMutation.mutate({ id: monitor.id })} className="p-1.5 rounded hover:bg-accent" title="Pause">
            <Pause className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <button onClick={() => resumeMutation.mutate({ id: monitor.id })} className="p-1.5 rounded hover:bg-accent" title="Resume">
            <Play className="h-3.5 w-3.5 text-green-500" />
          </button>
        )}
        <button onClick={() => { if (confirm(`Delete "${monitor.name}"?`)) deleteMutation.mutate({ id: monitor.id }); }} className="p-1.5 rounded hover:bg-accent" title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-red-500/70" />
        </button>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */

type StatusFilter = "all" | "UP" | "DOWN" | "PAUSED";

export default function MonitoringPage() {
  const [showForm, setShowForm] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editTarget, setEditTarget] = useState<any>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [filterCompanyOpen, setFilterCompanyOpen] = useState(false);
  const [filterCompanySearch, setFilterCompanySearch] = useState("");
  const filterCompanyRef = useRef<HTMLDivElement>(null);

  // Debounced search to avoid spamming server on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Build server-side filter params
  const filterInput = {
    ...(filterCompanyId ? { companyId: filterCompanyId } : {}),
    ...(filterTagIds.length ? { tagIds: filterTagIds } : {}),
    ...(filterType ? { type: filterType } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };
  const hasActiveFilters = filterCompanyId || filterTagIds.length > 0 || filterType || statusFilter !== "all" || debouncedSearch;

  const { data: monitors, isLoading } = trpc.uptime.list.useQuery(
    Object.keys(filterInput).length > 0 ? filterInput : undefined,
    { refetchInterval: 30000 }
  );
  // Unfiltered counts for the stat cards
  const { data: allMonitorsList } = trpc.uptime.list.useQuery(undefined, { refetchInterval: 30000 });
  const { data: health } = trpc.uptime.health.useQuery(undefined, { refetchInterval: 60000 });
  const { data: filterTags } = trpc.uptime.listTags.useQuery();
  const { data: filterCompanies } = trpc.uptime.listCompanies.useQuery(
    { search: filterCompanySearch || undefined }
  );
  const utils = trpc.useUtils();

  // Close company filter dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterCompanyRef.current && !filterCompanyRef.current.contains(e.target as Node)) {
        setFilterCompanyOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allMonitors = allMonitorsList || [];
  const upCount = allMonitors.filter((m) => m.status === "UP" && m.active).length;
  const downCount = allMonitors.filter((m) => m.status === "DOWN" && m.active).length;
  const pausedCount = allMonitors.filter((m) => !m.active).length;

  const list = monitors || [];

  // Find selected filter company name
  const filterCompanyName = filterCompanyId
    ? (filterCompanies?.find((c) => c.id === filterCompanyId)?.name || "Selected org")
    : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Uptime Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {health?.running ? (
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Engine running — {health.monitorCount} active</span>
            ) : (
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Engine not running</span>
            )}
          </p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" /> Add Monitor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Monitors" value={allMonitors.length} icon={Activity} color="bg-accent text-foreground" />
        <StatCard label="Up" value={upCount} icon={ArrowUpCircle} color="bg-green-500/10 text-green-500" />
        <StatCard label="Down" value={downCount} icon={ArrowDownCircle} color="bg-red-500/10 text-red-500" />
        <StatCard label="Paused" value={pausedCount} icon={PauseCircle} color="bg-yellow-500/10 text-yellow-500" />
      </div>

      {/* Status Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Status:</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Up — responding normally</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Down — unreachable or failed</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />Pending — retrying or initializing</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" />Unknown — no data yet</span>
      </div>

      {/* Monitor List */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Monitors</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearchQuery(""); setStatusFilter("all"); setFilterCompanyId(""); setFilterTagIds([]); setFilterType(""); }}
                  className="text-red-500 hover:text-red-400 transition-colors"
                >
                  Clear filters
                </button>
              )}
              <Zap className="h-3 w-3" />
              Auto-refreshes every 30s
            </div>
          </div>

          {/* Row 1: Search + Status */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                placeholder="Search monitors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {(["all", "UP", "DOWN", "PAUSED"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors",
                    statusFilter === f
                      ? f === "UP" ? "border-green-500/50 bg-green-500/10 text-green-500"
                        : f === "DOWN" ? "border-red-500/50 bg-red-500/10 text-red-500"
                        : f === "PAUSED" ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500"
                        : "border-red-500/50 bg-red-500/10 text-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "all" ? "All" : f === "PAUSED" ? "Paused" : f}
                  {f === "all" && ` (${allMonitors.length})`}
                  {f === "UP" && ` (${upCount})`}
                  {f === "DOWN" && ` (${downCount})`}
                  {f === "PAUSED" && ` (${pausedCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Company + Type + Tags filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Company Filter */}
            <div ref={filterCompanyRef} className="relative">
              <button
                onClick={() => setFilterCompanyOpen(!filterCompanyOpen)}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] transition-colors",
                  filterCompanyId
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Building2 className="h-3 w-3" />
                {filterCompanyId ? filterCompanyName : "Organization"}
                <ChevronDown className="h-3 w-3" />
              </button>
              {filterCompanyOpen && (
                <div className="absolute z-50 w-64 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        className="w-full h-7 pl-7 pr-3 rounded bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        placeholder="Search..."
                        value={filterCompanySearch}
                        onChange={(e) => setFilterCompanySearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent transition-colors"
                      onClick={() => { setFilterCompanyId(""); setFilterCompanyOpen(false); setFilterCompanySearch(""); }}
                    >
                      All Organizations
                    </button>
                    {(filterCompanies || []).map((c) => (
                      <button
                        key={c.id}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors",
                          filterCompanyId === c.id ? "text-blue-400 bg-blue-500/5" : "text-foreground"
                        )}
                        onClick={() => { setFilterCompanyId(c.id); setFilterCompanyOpen(false); setFilterCompanySearch(""); }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={cn(
                "h-7 px-2.5 rounded-lg border text-[11px] bg-transparent outline-none transition-colors cursor-pointer",
                filterType
                  ? "border-purple-500/50 bg-purple-500/10 text-purple-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <option value="">All Types</option>
              {MONITOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Tag Filter Buttons */}
            {(filterTags || []).length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {(filterTags || []).map((tag) => {
                  const active = filterTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setFilterTagIds(active ? filterTagIds.filter((id) => id !== tag.id) : [...filterTagIds, tag.id])}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all",
                        active ? "opacity-100" : "opacity-40 hover:opacity-70"
                      )}
                      style={{
                        borderColor: tag.color + (active ? "80" : "30"),
                        backgroundColor: tag.color + (active ? "20" : "08"),
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-30" />
            {allMonitors.length === 0 ? (
              <>
                <p className="text-sm">No monitors configured</p>
                <p className="text-xs mt-1">Add your first monitor to start tracking uptime</p>
              </>
            ) : (
              <>
                <p className="text-sm">No monitors match your filters</p>
                <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setFilterCompanyId(""); setFilterTagIds([]); setFilterType(""); }} className="text-xs mt-1 text-red-500 hover:underline">Clear filters</button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {list.map((monitor) => (
              <MonitorRow
                key={monitor.id}
                monitor={monitor}
                onEdit={() => { setEditTarget(monitor); setShowForm(true); }}
                onDetail={() => setDetailId(monitor.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog — key forces remount so useState initializer re-runs */}
      <MonitorFormDialog
        key={showForm ? (editTarget?.id || 'new') : 'closed'}
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSuccess={() => utils.uptime.list.invalidate()}
        editMonitor={editTarget}
      />

      {/* Detail Panel */}
      {detailId && (
        <MonitorDetail monitorId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
