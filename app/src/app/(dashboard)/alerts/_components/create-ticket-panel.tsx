"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Ticket,
  X,
  Loader2,
  Building2,
  AlertTriangle,
  User,
  ChevronDown,
} from "lucide-react";
import { useTicketBubbles } from "@/contexts/ticket-bubble-context";

/* ─── Types ──────────────────────────────────────────────── */

interface AlertInfo {
  id: string;
  source: string;
  title: string;
  severity: string;
  deviceHostname?: string;
  organizationName?: string;
  detectedAt: Date;
}

interface AlertStateInfo {
  matchedCompanyId?: string | null;
  matchedCompanyName?: string | null;
}

interface CreateTicketPanelProps {
  alerts: AlertInfo[];
  alertStates: Record<string, AlertStateInfo>;
  onClose: () => void;
  onSuccess: () => void;
}

/* ─── Source Label Map ───────────────────────────────────── */

const SOURCE_LABEL: Record<string, string> = {
  sentinelone: "S1",
  blackpoint: "BP",
  ninjaone: "Ninja",
  uptime: "Uptime",
  cove: "Cove",
  dropsuite: "DropSuite",
  dnsfilter: "DNS",
};

/* ─── Priority Map ───────────────────────────────────────── */

function mapSeverityToPriority(severity: string): "critical" | "high" | "medium" | "low" {
  switch (severity) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    default: return "low";
  }
}

/* ─── Component ──────────────────────────────────────────── */

export function CreateTicketPanel({
  alerts,
  alertStates,
  onClose,
  onSuccess,
}: CreateTicketPanelProps) {
  const { openTicket } = useTicketBubbles();
  const isBulk = alerts.length > 1;

  // Resolve company from alert states or alert data
  const companyInfo = useMemo(() => {
    for (const a of alerts) {
      const state = alertStates[a.id];
      if (state?.matchedCompanyId && state?.matchedCompanyName) {
        return { id: state.matchedCompanyId, name: state.matchedCompanyName };
      }
    }
    // Fall back to organization name (but no CW ID)
    for (const a of alerts) {
      if (a.organizationName) {
        return { id: null, name: a.organizationName };
      }
    }
    return { id: null, name: null };
  }, [alerts, alertStates]);

  // Try to find company ID if we only have a name
  const companySearch = trpc.psa.findRelatedTickets.useQuery(
    {
      organizationName: companyInfo.name || undefined,
      hostname: alerts[0]?.deviceHostname || undefined,
    },
    {
      enabled: !companyInfo.id && !!companyInfo.name,
      staleTime: 60_000,
    }
  );

  const resolvedCompanyId = companyInfo.id || companySearch.data?.matchedCompanyId || null;
  const resolvedCompanyName = companyInfo.name || companySearch.data?.matchedCompanyName || null;

  // Highest severity across all alerts
  const highestSeverity = useMemo(() => {
    const order = ["critical", "high", "medium", "low", "informational"];
    let best = "low";
    for (const a of alerts) {
      if (order.indexOf(a.severity) < order.indexOf(best)) {
        best = a.severity;
      }
    }
    return best;
  }, [alerts]);

  // Auto-fill values
  const defaultSummary = useMemo(() => {
    if (isBulk) {
      const sources = [...new Set(alerts.map((a) => SOURCE_LABEL[a.source] || a.source))];
      return `[${sources.join("/")}] ${alerts.length} alerts${resolvedCompanyName ? ` — ${resolvedCompanyName}` : ""}`;
    }
    const a = alerts[0];
    const label = SOURCE_LABEL[a.source] || a.source;
    return `[${label}] ${a.title}`.substring(0, 100);
  }, [alerts, isBulk, resolvedCompanyName]);

  const defaultDescription = useMemo(() => {
    if (isBulk) {
      const lines = [
        `Bundled alert ticket — ${alerts.length} alerts:`,
        "",
      ];
      for (let i = 0; i < alerts.length; i++) {
        const a = alerts[i];
        const label = SOURCE_LABEL[a.source] || a.source;
        lines.push(
          `${i + 1}. [${label}] ${a.title}${a.deviceHostname ? ` — ${a.deviceHostname}` : ""} — ${a.severity} — ${new Date(a.detectedAt).toLocaleString()}`
        );
      }
      return lines.join("\n");
    }
    const a = alerts[0];
    return [
      `Alert detected${a.deviceHostname ? ` on ${a.deviceHostname}` : ""}`,
      `Severity: ${a.severity}`,
      `Source: ${a.source}`,
      `Detected: ${new Date(a.detectedAt).toLocaleString()}`,
      "",
      `Original alert: ${a.title}`,
    ].join("\n");
  }, [alerts, isBulk]);

  // Form state
  const [summary, setSummary] = useState(defaultSummary);
  const [description, setDescription] = useState(defaultDescription);
  const [priority, setPriority] = useState(mapSeverityToPriority(highestSeverity));
  const [boardId, setBoardId] = useState<string>("");

  // Data queries
  const boards = trpc.psa.getBoards.useQuery(undefined, { staleTime: 300_000 });
  const myMemberId = trpc.psa.getMyMemberId.useQuery(undefined, { staleTime: 300_000 });

  // Create + link mutation
  const createAndLink = trpc.alertAction.createAndLink.useMutation({
    onSuccess: (data) => {
      openTicket(data.ticket.sourceId);
      onSuccess();
    },
  });

  function handleSubmit() {
    if (!resolvedCompanyId || !summary.trim()) return;
    createAndLink.mutate({
      alertIds: alerts.map((a) => a.id),
      source: alerts[0].source,
      summary: summary.trim(),
      description: description.trim() || undefined,
      companyId: resolvedCompanyId,
      priority,
      boardId: boardId || undefined,
    });
  }

  const hasCompany = !!resolvedCompanyId;

  return (
    <div className="rounded-xl bg-card border border-primary/20 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Create Ticket{isBulk ? ` (${alerts.length} alerts)` : ""}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Company display */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {hasCompany ? (
            <span className="text-sm text-foreground font-medium">
              {resolvedCompanyName}
            </span>
          ) : companySearch.isLoading ? (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Matching company...
            </span>
          ) : (
            <span className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              No matching company found — cannot create ticket
            </span>
          )}
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Assigned to: <span className="text-foreground font-medium">You</span>
            {myMemberId.data && (
              <span className="text-[10px] text-muted-foreground ml-1">
                (CW #{myMemberId.data})
              </span>
            )}
          </span>
        </div>

        {/* Summary */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Summary
          </label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            className="w-full h-9 rounded-lg bg-background border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Description / Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={isBulk ? Math.min(alerts.length + 3, 8) : 4}
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none font-mono text-xs leading-relaxed"
          />
        </div>

        {/* Priority + Board row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Priority
            </label>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full h-9 rounded-lg bg-background border border-border px-3 pr-8 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Board */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Board
            </label>
            <div className="relative">
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full h-9 rounded-lg bg-background border border-border px-3 pr-8 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                disabled={boards.isLoading}
              >
                <option value="">
                  {boards.isLoading ? "Loading..." : "Default"}
                </option>
                {boards.data?.map((b) => (
                  <option key={b.id ?? b.name} value={String(b.id ?? "")}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!hasCompany || !summary.trim() || createAndLink.isPending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createAndLink.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ticket className="h-4 w-4" />
            )}
            Create Ticket
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          {createAndLink.error && (
            <span className="text-xs text-red-400 ml-2">
              {createAndLink.error.message.substring(0, 80)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
