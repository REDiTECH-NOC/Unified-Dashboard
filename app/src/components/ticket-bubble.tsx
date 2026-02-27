"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Minus,
  X,
  Maximize2,
  Building2,
  User,
  LayoutGrid,
  Clock,
  ExternalLink,
  Loader2,
  ChevronUp,
} from "lucide-react";
import { PriorityDot, PRIORITY_CONFIG, PRIORITY_TO_CW, type Priority } from "@/app/(dashboard)/tickets/_components/priority-badge";
import { TicketStopwatch } from "@/app/(dashboard)/tickets/_components/ticket-stopwatch";
import { TicketNotesThread } from "@/app/(dashboard)/tickets/_components/ticket-notes-thread";
import { TicketTimeEntry } from "@/app/(dashboard)/tickets/_components/ticket-time-entry";
import { useTicketHub, type TicketHub } from "@/app/(dashboard)/tickets/_components/use-ticket-hub";

/* ─── Props ──────────────────────────────────────────────── */

interface TicketBubbleProps {
  ticketId: string;
  minimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
}

/* ─── Collapsed Chip ─────────────────────────────────────── */

function BubbleChip({
  ticketId,
  summary,
  priority,
  companyName,
  loading,
  onExpand,
  onClose,
}: {
  ticketId: string;
  summary?: string;
  priority?: string;
  companyName?: string;
  loading?: boolean;
  onExpand: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 h-10 px-3 bg-card border border-border rounded-lg shadow-lg cursor-pointer hover:border-muted-foreground/40 transition-colors max-w-[260px]"
      onClick={onExpand}
    >
      <PriorityDot priority={priority ?? "none"} className="h-2 w-2 flex-shrink-0" />
      <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">#{ticketId}</span>
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <span className="text-xs text-foreground truncate flex-1 min-w-0">
          {summary ?? "Loading..."}
        </span>
      )}
      {companyName && (
        <span className="text-[9px] text-muted-foreground truncate max-w-[60px] flex-shrink-0">
          {companyName}
        </span>
      )}
      <TicketStopwatch ticketId={ticketId} compact />
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="flex-shrink-0 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ─── Expanded Panel ─────────────────────────────────────── */

function BubbleExpanded({
  ticketId,
  hub,
  onMinimize,
  onClose,
}: {
  ticketId: string;
  hub: TicketHub;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [showTimeEntry, setShowTimeEntry] = useState(false);

  const ticket = trpc.psa.getTicketById.useQuery(
    { id: ticketId },
    { retry: 1, staleTime: 15_000 }
  );

  const notes = trpc.psa.getTicketNotes.useQuery(
    { ticketId },
    { retry: 1 }
  );

  const boardId = useMemo(() => {
    if (!ticket.data?.board || !hub.boards.data) return null;
    const match = hub.boards.data.find((b) => b.name === ticket.data!.board);
    return match?.id ?? null;
  }, [ticket.data?.board, hub.boards.data]);

  const boardStatuses = trpc.psa.getBoardStatuses.useQuery(
    { boardId: boardId! },
    { enabled: !!boardId, staleTime: 5 * 60_000, retry: 1 }
  );

  const t = ticket.data;

  return (
    <div className="w-[400px] max-h-[520px] bg-card border border-border rounded-t-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card flex-shrink-0">
        {t && <PriorityDot priority={t.priority} className="h-2.5 w-2.5 flex-shrink-0" />}
        <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">#{ticketId}</span>
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {t?.summary ?? "Loading..."}
        </span>
        <button
          onClick={onMinimize}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { router.push(`/tickets?detail=${ticketId}`); onClose(); }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Open full view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {ticket.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ticket.error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-xs font-medium">Failed to load ticket</p>
            <p className="text-[10px] mt-1">{ticket.error.message.substring(0, 80)}</p>
          </div>
        ) : t ? (
          <>
            {/* Meta */}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {t.companyName && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {t.companyName}</span>
              )}
              {t.contactName && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {t.contactName}</span>
              )}
              {t.board && (
                <span className="flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> {t.board}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {hub.relative(t.createdAt)}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-1.5">
              {boardStatuses.data && boardStatuses.data.length > 0 && (
                <select
                  className="h-6 rounded border border-border bg-background px-1.5 text-[10px]"
                  value={t.status}
                  onChange={(e) => hub.updateTicket.mutate({ id: t.sourceId, status: e.target.value })}
                  disabled={hub.updateTicket.isPending}
                >
                  {boardStatuses.data.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
              <select
                className="h-6 rounded border border-border bg-background px-1.5 text-[10px]"
                value={t.priority}
                onChange={(e) => hub.updateTicket.mutate({
                  id: t.sourceId,
                  priority: PRIORITY_TO_CW[e.target.value as Priority] ?? e.target.value,
                })}
                disabled={hub.updateTicket.isPending}
              >
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
              {hub.members.data && hub.members.data.length > 0 && (
                <select
                  className="h-6 rounded border border-border bg-background px-1.5 text-[10px]"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) hub.updateTicket.mutate({ id: t.sourceId, assignTo: e.target.value });
                  }}
                  disabled={hub.updateTicket.isPending}
                >
                  <option value="">Assign{t.assignedTo ? ` (${t.assignedTo})` : ""}...</option>
                  {hub.members.data.map((m) => (
                    <option key={m.id} value={m.identifier}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Stopwatch */}
            <TicketStopwatch
              ticketId={t.sourceId}
              onLogTime={(hours) => {
                hub.addTime.mutate({ ticketId: t.sourceId, hoursWorked: hours });
              }}
            />

            {/* Time Entry toggle */}
            <button
              onClick={() => setShowTimeEntry(!showTimeEntry)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className={cn("h-3 w-3 transition-transform", showTimeEntry && "rotate-180")} />
              Log Time Entry
            </button>
            {showTimeEntry && <TicketTimeEntry ticketId={t.sourceId} hub={hub} />}

            {/* Notes */}
            <TicketNotesThread
              ticketId={t.sourceId}
              notes={notes.data}
              isLoading={notes.isLoading}
              hub={hub}
              contactName={t.contactName ?? undefined}
              contactEmail={t.contactEmail ?? undefined}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Main Bubble Component ──────────────────────────────── */

export function TicketBubble({ ticketId, minimized, onClose, onToggleMinimize }: TicketBubbleProps) {
  const hub = useTicketHub();

  // Prefetch ticket data for the chip
  const ticket = trpc.psa.getTicketById.useQuery(
    { id: ticketId },
    { retry: 1, staleTime: 15_000 }
  );

  if (minimized) {
    return (
      <BubbleChip
        ticketId={ticketId}
        summary={ticket.data?.summary}
        priority={ticket.data?.priority}
        companyName={ticket.data?.companyName ?? undefined}
        loading={ticket.isLoading}
        onExpand={onToggleMinimize}
        onClose={onClose}
      />
    );
  }

  return (
    <BubbleExpanded
      ticketId={ticketId}
      hub={hub}
      onMinimize={onToggleMinimize}
      onClose={onClose}
    />
  );
}
