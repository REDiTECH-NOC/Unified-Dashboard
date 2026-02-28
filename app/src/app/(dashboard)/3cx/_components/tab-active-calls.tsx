"use client";

import { trpc } from "@/lib/trpc";
import { Loader2, Phone, PhoneOff } from "lucide-react";

interface TabActiveCallsProps {
  instanceId: string;
}

function callDuration(startTime: string | undefined): string {
  if (!startTime) return "—";
  const start = new Date(startTime);
  if (isNaN(start.getTime())) return "—";
  const seconds = Math.floor((Date.now() - start.getTime()) / 1000);
  if (seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stateColor(state: string | undefined): string {
  if (!state) return "text-foreground";
  const s = state.toLowerCase();
  if (s.includes("talking") || s.includes("connected")) return "text-green-500";
  if (s.includes("ringing") || s.includes("dialing")) return "text-yellow-500";
  if (s.includes("hold")) return "text-orange-500";
  if (s.includes("transfer")) return "text-blue-500";
  return "text-foreground";
}

export function TabActiveCalls({ instanceId }: TabActiveCallsProps) {
  const { data: calls, isLoading, isError, error } = trpc.threecx.getActiveCalls.useQuery(
    { instanceId },
    { refetchInterval: 5000, retry: 2 } // Refresh every 5s for live calls
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        <p>Failed to load active calls.</p>
        <p className="text-xs mt-1 opacity-60">{error?.message ?? "The PBX may be offline."}</p>
      </div>
    );
  }

  if (!calls) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load active calls. The PBX may be offline.
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <PhoneOff className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No active calls</p>
          <p className="text-xs mt-1 opacity-60">Calls will appear here in real-time when active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Phone className="h-4 w-4 text-green-500" />
        <span className="text-xs text-muted-foreground">
          {calls.length} active call{calls.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">Auto-refreshing every 5s</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium">ID</th>
              <th className="text-left px-4 py-2.5 font-medium">Caller</th>
              <th className="text-left px-4 py-2.5 font-medium">Callee</th>
              <th className="text-left px-4 py-2.5 font-medium">State</th>
              <th className="text-left px-4 py-2.5 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 text-muted-foreground font-mono">{call.id}</td>
                <td className="px-4 py-3 text-foreground font-mono">{call.caller}</td>
                <td className="px-4 py-3 text-foreground font-mono">{call.callee}</td>
                <td className="px-4 py-3">
                  <span className={stateColor(call.state)}>{call.state}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono">{callDuration(call.startTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
