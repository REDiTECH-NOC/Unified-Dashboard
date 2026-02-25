"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Building2, User, LayoutGrid, Clock, ExternalLink } from "lucide-react";
import { PriorityDot, PRIORITY_CONFIG, PRIORITY_TO_CW, type Priority } from "./priority-badge";
import { TicketNotesThread } from "./ticket-notes-thread";
import { TicketTimeEntry } from "./ticket-time-entry";
import type { TicketHub } from "./use-ticket-hub";

interface TicketDetailSheetProps {
  ticketId: string | null;
  onClose: () => void;
  hub: TicketHub;
}

export function TicketDetailSheet({ ticketId, onClose, hub }: TicketDetailSheetProps) {
  const open = !!ticketId;

  const ticket = trpc.psa.getTicketById.useQuery(
    { id: ticketId! },
    { enabled: open, retry: 1, staleTime: 15_000 }
  );

  const notes = trpc.psa.getTicketNotes.useQuery(
    { ticketId: ticketId! },
    { enabled: open, retry: 1 }
  );

  // Resolve boardId from ticket's board name so we can load statuses
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
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="max-w-xl overflow-y-auto" side="right" onClose={onClose}>
        {ticket.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : ticket.error ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm font-medium">Failed to load ticket</p>
            <p className="text-xs mt-1">
              {/not valid JSON|Unexpected token|fetch failed/i.test(ticket.error.message)
                ? "Connection error \u2014 try again."
                : ticket.error.message}
            </p>
          </div>
        ) : t ? (
          <div className="space-y-5">
            {/* Header */}
            <SheetHeader className="p-0 pb-0">
              <div className="flex items-center gap-2 mb-1">
                <PriorityDot priority={t.priority} className="h-3 w-3" />
                <span className="text-xs font-mono text-muted-foreground">#{t.sourceId}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  PRIORITY_CONFIG[t.priority as Priority]?.bg,
                  PRIORITY_CONFIG[t.priority as Priority]?.color
                )}>
                  {PRIORITY_CONFIG[t.priority as Priority]?.label ?? t.priority}
                </span>
              </div>
              <SheetTitle className="text-base leading-snug">{t.summary}</SheetTitle>
            </SheetHeader>

            {/* Meta */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                <Clock className="h-3 w-3" /> Created {hub.dateTime(t.createdAt)}
              </span>
              {t.updatedAt && (
                <span className="text-[10px]">Updated {hub.relative(t.updatedAt)}</span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {boardStatuses.data && boardStatuses.data.length > 0 && (
                <select
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs"
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
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
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
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) hub.updateTicket.mutate({ id: t.sourceId, assignTo: e.target.value });
                  }}
                  disabled={hub.updateTicket.isPending}
                >
                  <option value="">Reassign{t.assignedTo ? ` (${t.assignedTo})` : ""}...</option>
                  {hub.members.data.map((m) => (
                    <option key={m.id} value={m.identifier}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Description */}
            {t.description && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                  Description
                </label>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed rounded-md border border-border/30 bg-muted/10 p-3">
                  {t.description}
                </p>
              </div>
            )}

            {/* Time Entry */}
            <TicketTimeEntry ticketId={t.sourceId} hub={hub} />

            {/* Notes Thread */}
            <TicketNotesThread
              ticketId={t.sourceId}
              notes={notes.data}
              isLoading={notes.isLoading}
              hub={hub}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
