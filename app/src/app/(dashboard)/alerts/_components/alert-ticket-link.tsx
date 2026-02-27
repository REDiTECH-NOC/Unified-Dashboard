"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2, Ticket, Plus, Play, ExternalLink } from "lucide-react";
import { useTicketBubbles } from "@/contexts/ticket-bubble-context";
import { PriorityDot } from "@/app/(dashboard)/tickets/_components/priority-badge";

/* ─── Props ──────────────────────────────────────────────── */

interface AlertTicketLinkProps {
  hostname?: string;
  organizationName?: string;
  organizationSourceId?: string;
  toolId?: string;
  label?: string;
  alertContext: {
    title: string;
    severity: string;
    source: string;
    deviceHostname?: string;
    detectedAt: Date;
  };
}

/* ─── Component ──────────────────────────────────────────── */

export function AlertTicketLink({
  hostname,
  organizationName,
  organizationSourceId,
  toolId,
  label,
  alertContext,
}: AlertTicketLinkProps) {
  const { openTicket } = useTicketBubbles();
  const [creating, setCreating] = useState(false);

  const utils = trpc.useUtils();

  const related = trpc.psa.findRelatedTickets.useQuery(
    {
      hostname: hostname || undefined,
      organizationName: organizationName || undefined,
      toolId: toolId || undefined,
      organizationSourceId: organizationSourceId || undefined,
    },
    {
      enabled: !!(hostname || organizationName || organizationSourceId),
      staleTime: 60_000,
      retry: 1,
    }
  );

  const createTicket = trpc.psa.createTicket.useMutation({
    onSuccess: (ticket) => {
      setCreating(false);
      openTicket(ticket.sourceId);
      utils.psa.getTickets.invalidate();
      utils.psa.findRelatedTickets.invalidate();
    },
    onError: () => setCreating(false),
  });

  function handleCreateTicket() {
    if (!related.data?.matchedCompanyId) return;
    setCreating(true);

    const sourceLabel = alertContext.source === "sentinelone" ? "S1" :
      alertContext.source === "blackpoint" ? "BP" :
      alertContext.source === "ninjaone" ? "Ninja" :
      alertContext.source === "cove" ? "Cove" :
      alertContext.source === "uptime" ? "Uptime" :
      alertContext.source;

    const summary = `[${sourceLabel}] ${alertContext.title}`.substring(0, 100);
    const description = [
      `Alert detected${alertContext.deviceHostname ? ` on ${alertContext.deviceHostname}` : ""}`,
      `Severity: ${alertContext.severity}`,
      `Source: ${alertContext.source}`,
      `Detected: ${new Date(alertContext.detectedAt).toLocaleString()}`,
      "",
      `Original alert: ${alertContext.title}`,
    ].join("\n");

    createTicket.mutate({
      summary,
      description,
      companyId: related.data.matchedCompanyId,
      priority: alertContext.severity === "critical" ? "critical" :
        alertContext.severity === "high" ? "high" :
        alertContext.severity === "medium" ? "medium" : "low",
    });
  }

  // Don't render if no lookup criteria
  if (!hostname && !organizationName && !organizationSourceId) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/30">
      <Ticket className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      {label && <span className="text-[10px] font-medium text-muted-foreground">{label}:</span>}

      {related.isLoading ? (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Finding related tickets...
        </div>
      ) : related.data && related.data.tickets.length > 0 ? (
        <>
          {related.data.tickets.slice(0, 5).map((t) => (
            <button
              key={t.sourceId}
              onClick={() => openTicket(t.sourceId)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] bg-accent/50 border border-border/50 hover:border-muted-foreground/40 transition-colors group"
              title={`${t.summary} — ${t.status}`}
            >
              <PriorityDot priority={t.priority} className="h-2 w-2" />
              <span className="font-mono text-muted-foreground">#{t.sourceId}</span>
              <span className="text-foreground truncate max-w-[140px]">{t.summary}</span>
              <span className="text-[9px] text-muted-foreground px-1 py-0.5 rounded bg-muted/50">
                {t.status}
              </span>
            </button>
          ))}
          {related.data.tickets.length > 5 && (
            <span className="text-[10px] text-muted-foreground">
              +{related.data.tickets.length - 5} more
            </span>
          )}
        </>
      ) : related.data?.matchedCompanyName ? (
        <span className="text-[10px] text-muted-foreground">
          No open tickets for {related.data.matchedCompanyName}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">No matching company found</span>
      )}

      {/* Create Ticket button */}
      {related.data?.matchedCompanyId && (
        <button
          onClick={handleCreateTicket}
          disabled={creating || createTicket.isPending}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {creating || createTicket.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Create Ticket
        </button>
      )}

      {createTicket.error && (
        <span className="text-[10px] text-red-400">{createTicket.error.message.substring(0, 60)}</span>
      )}
    </div>
  );
}
