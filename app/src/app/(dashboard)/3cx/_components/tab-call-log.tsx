"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Loader2,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ArrowRightLeft,
  Voicemail,
  Phone,
  Search,
  ChevronRight,
  ChevronDown,
  Calendar,
  Filter,
  X,
} from "lucide-react";

interface TabCallLogProps {
  instanceId: string;
}

// ─── Helpers ────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 1) return "< 1s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getPresetRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const today = toDateStr(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: toDateStr(y), to: toDateStr(y) };
    }
    case "7days": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: toDateStr(d), to: today };
    }
    case "30days": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: toDateStr(d), to: today };
    }
    default:
      return null;
  }
}

// ─── Sub-components ─────────────────────────────────────────

function DirectionIcon({ direction, answered }: { direction: string; answered: boolean }) {
  if (!answered) return <PhoneMissed className="h-4 w-4 text-red-500" />;
  switch (direction) {
    case "inbound":
      return <PhoneIncoming className="h-4 w-4 text-green-500" />;
    case "outbound":
      return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
    default:
      return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />;
  }
}

function DstTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    extension: "bg-blue-500/10 text-blue-400",
    voicemail: "bg-purple-500/10 text-purple-400",
    ivr: "bg-yellow-500/10 text-yellow-400",
    queue: "bg-green-500/10 text-green-400",
    trunk: "bg-orange-500/10 text-orange-400",
    other: "bg-zinc-500/10 text-zinc-400",
  };
  const icons: Record<string, React.ReactNode> = {
    voicemail: <Voicemail className="h-3 w-3 mr-1" />,
  };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium", styles[type] || styles.other)}>
      {icons[type]}
      {type}
    </span>
  );
}

// ─── Types for grouped calls ────────────────────────────────

type CallRecord = {
  segmentId: number;
  callId: string;
  callIdNumeric: number;
  startTime: string;
  endTime: string;
  direction: "inbound" | "outbound" | "internal";
  srcName: string;
  srcNumber: string;
  srcExtension: string;
  dstName: string;
  dstNumber: string;
  dstExtension: string;
  dstType: string;
  durationSeconds: number;
  answered: boolean;
  actionId: number;
};

interface CallChain {
  callId: string;
  segments: CallRecord[];
  startTime: string;
  direction: "inbound" | "outbound" | "internal";
  srcName: string;
  srcNumber: string;
  dstName: string;
  dstNumber: string;
  totalDuration: number;
  answered: boolean;
}

function groupIntoChains(records: CallRecord[]): CallChain[] {
  const groups: Record<string, CallRecord[]> = {};

  for (const r of records) {
    if (groups[r.callId]) {
      groups[r.callId].push(r);
    } else {
      groups[r.callId] = [r];
    }
  }

  const chains: CallChain[] = [];
  for (const callId of Object.keys(groups)) {
    const segments = groups[callId];
    segments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const first = segments[0];
    const meaningful = segments.filter((s) => s.dstType !== "other");
    const primary = meaningful.length > 0 ? meaningful[0] : first;

    chains.push({
      callId,
      segments,
      startTime: first.startTime,
      direction: first.direction,
      srcName: first.srcName,
      srcNumber: first.srcNumber,
      dstName: primary.dstName || primary.dstExtension,
      dstNumber: primary.dstNumber,
      totalDuration: Math.max(...segments.map((s) => s.durationSeconds)),
      answered: segments.some((s) => s.answered),
    });
  }

  chains.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  return chains;
}

// ─── Main Component ─────────────────────────────────────────

export function TabCallLog({ instanceId }: TabCallLogProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "inbound" | "outbound" | "missed">("all");
  const [timePreset, setTimePreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  // Build server-side filter params
  const serverFilter = useMemo(() => {
    const f: Record<string, string | boolean | number | undefined> = {
      instanceId,
      top: 500,
    };

    if (timePreset !== "all" && timePreset !== "custom") {
      const range = getPresetRange(timePreset);
      if (range) {
        f.dateFrom = range.from;
        f.dateTo = range.to;
      }
    } else if (timePreset === "custom") {
      if (dateFrom) f.dateFrom = dateFrom;
      if (dateTo) f.dateTo = dateTo;
    }

    if (fromNumber.trim()) f.fromNumber = fromNumber.trim();
    if (toNumber.trim()) f.toNumber = toNumber.trim();
    if (statusFilter === "missed") f.answered = false;

    return f;
  }, [instanceId, timePreset, dateFrom, dateTo, fromNumber, toNumber, statusFilter]);

  const { data: calls, isLoading } = trpc.threecx.getCallHistory.useQuery(
    serverFilter as Parameters<typeof trpc.threecx.getCallHistory.useQuery>[0],
    { refetchInterval: 60000 }
  );

  // Client-side filtering (search + direction that aren't server-filtered)
  const filtered = useMemo(() => {
    if (!calls) return [];
    return (calls as CallRecord[]).filter((c) => {
      if (statusFilter === "inbound" && c.direction !== "inbound") return false;
      if (statusFilter === "outbound" && c.direction !== "outbound") return false;
      if (statusFilter === "missed" && c.answered) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.srcName.toLowerCase().includes(q) ||
          c.srcNumber.toLowerCase().includes(q) ||
          c.dstName.toLowerCase().includes(q) ||
          c.dstNumber.toLowerCase().includes(q) ||
          c.callId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [calls, statusFilter, search]);

  const chains = useMemo(() => groupIntoChains(filtered), [filtered]);

  const totalInbound = (calls as CallRecord[] | undefined)?.filter((c) => c.direction === "inbound").length ?? 0;
  const totalOutbound = (calls as CallRecord[] | undefined)?.filter((c) => c.direction === "outbound").length ?? 0;
  const totalMissed = (calls as CallRecord[] | undefined)?.filter((c) => !c.answered).length ?? 0;
  const totalChains = chains.length;

  const toggleExpand = (callId: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const hasActiveFilters = timePreset !== "all" || !!fromNumber || !!toNumber;

  const clearFilters = () => {
    setTimePreset("all");
    setDateFrom("");
    setDateTo("");
    setFromNumber("");
    setToNumber("");
    setSearch("");
    setStatusFilter("all");
    setShowAdvanced(false);
  };

  if (isLoading && !calls) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{calls?.length ?? 0} segments</span>
        <span>{totalChains} calls</span>
        <span className="text-green-500">{totalInbound} inbound</span>
        <span className="text-blue-500">{totalOutbound} outbound</span>
        <span className="text-red-500">{totalMissed} missed</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {/* Filter Row 1: Search + Direction + Time Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calls..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-accent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5 border border-border">
          {(["all", "inbound", "outbound", "missed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize",
                statusFilter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={timePreset}
            onChange={(e) => setTimePreset(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border bg-accent text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
            showAdvanced || hasActiveFilters
              ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <Filter className="h-3 w-3" />
          Filters
          {hasActiveFilters && (
            <button
              onClick={(e) => { e.stopPropagation(); clearFilters(); }}
              className="ml-1 p-0.5 rounded-full hover:bg-blue-500/20"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </button>
      </div>

      {/* Filter Row 2: Advanced */}
      {showAdvanced && (
        <div className="flex items-end gap-3 flex-wrap p-3 rounded-lg border border-border bg-accent/50">
          {timePreset === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">From</label>
            <input
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="Name or number..."
              className="w-40 px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">To</label>
            <input
              type="text"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="Name or number..."
              className="w-40 px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <button
            onClick={clearFilters}
            className="px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-accent transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* No results */}
      {!calls || calls.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Phone className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No call history available</p>
            <p className="text-xs mt-1 opacity-60">
              {hasActiveFilters
                ? "Try adjusting your filters"
                : "Call records will appear here as calls are made and received"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground w-8"></th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground w-8"></th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Time</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground whitespace-nowrap">Call ID</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground">From</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground">To</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Handled By</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground">Duration</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {chains.map((chain) => (
                  <CallChainRows
                    key={chain.callId}
                    chain={chain}
                    isExpanded={expandedChains.has(chain.callId)}
                    hasMultiple={chain.segments.length > 1}
                    onToggle={() => toggleExpand(chain.callId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {chains.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No calls match your filters
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Call Chain Row Group ────────────────────────────────────

function CallChainRows({
  chain,
  isExpanded,
  hasMultiple,
  onToggle,
}: {
  chain: CallChain;
  isExpanded: boolean;
  hasMultiple: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Primary row */}
      <tr
        className={cn(
          "border-b border-border/50 transition-colors",
          hasMultiple ? "cursor-pointer hover:bg-accent/40" : "hover:bg-accent/30",
          isExpanded && "bg-accent/20"
        )}
        onClick={hasMultiple ? onToggle : undefined}
      >
        <td className="px-3 py-2.5 w-8">
          {hasMultiple && (
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          )}
        </td>

        <td className="px-3 py-2.5 w-8">
          <DirectionIcon direction={chain.direction} answered={chain.answered} />
        </td>

        <td className="px-3 py-2.5">
          <span className="text-xs text-foreground whitespace-nowrap">
            {formatDateTime(chain.startTime)}
          </span>
        </td>

        <td className="px-3 py-2.5">
          <span className="text-[11px] font-mono text-muted-foreground">{chain.callId}</span>
          {hasMultiple && (
            <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-accent text-muted-foreground">
              {chain.segments.length}
            </span>
          )}
        </td>

        <td className="px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{chain.srcName}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{chain.srcNumber}</p>
          </div>
        </td>

        <td className="px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{chain.dstName}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{chain.dstNumber}</p>
          </div>
        </td>

        <td className="px-3 py-2.5">
          {chain.segments.length === 1 ? (
            <DstTypeBadge type={chain.segments[0].dstType} />
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {chain.segments
                .map((s) => s.dstType)
                .filter((t, i, a) => a.indexOf(t) === i && t !== "other")
                .join(", ") || "—"}
            </span>
          )}
        </td>

        <td className="px-3 py-2.5 text-right">
          <span className={cn("text-xs font-mono", chain.totalDuration > 0 ? "text-foreground" : "text-muted-foreground")}>
            {formatDuration(chain.totalDuration)}
          </span>
        </td>

        <td className="px-3 py-2.5 text-center">
          <span className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
            chain.answered ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          )}>
            {chain.answered ? "Answered" : "Missed"}
          </span>
        </td>
      </tr>

      {/* Expanded segment rows */}
      {isExpanded && hasMultiple && chain.segments.map((seg, idx) => (
        <tr key={seg.segmentId} className="border-b border-border/30 bg-accent/10">
          <td className="px-3 py-1.5 w-8">
            <div className="flex items-center justify-center">
              <div className={cn("w-px bg-border", idx === chain.segments.length - 1 ? "h-3" : "h-full")} />
            </div>
          </td>

          <td className="px-3 py-1.5 w-8">
            <DirectionIcon direction={seg.direction} answered={seg.answered} />
          </td>

          <td className="px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatTime(seg.startTime)}</span>
          </td>

          <td className="px-3 py-1.5">
            <span className="text-[10px] font-mono text-muted-foreground/60">seg {idx + 1}</span>
          </td>

          <td className="px-3 py-1.5">
            <div>
              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{seg.srcName}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono">{seg.srcNumber}</p>
            </div>
          </td>

          <td className="px-3 py-1.5">
            <div>
              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{seg.dstName || seg.dstExtension}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono">{seg.dstNumber}</p>
            </div>
          </td>

          <td className="px-3 py-1.5">
            <DstTypeBadge type={seg.dstType} />
          </td>

          <td className="px-3 py-1.5 text-right">
            <span className="text-[11px] font-mono text-muted-foreground">{formatDuration(seg.durationSeconds)}</span>
          </td>

          <td className="px-3 py-1.5 text-center">
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
              seg.answered ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            )}>
              {seg.answered ? "Answered" : "Missed"}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
