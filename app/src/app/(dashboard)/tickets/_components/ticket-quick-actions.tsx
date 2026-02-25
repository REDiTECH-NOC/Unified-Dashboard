"use client";

import { useState } from "react";
import { Loader2, Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, PRIORITY_TO_CW, type Priority } from "./priority-badge";
import type { TicketHub } from "./use-ticket-hub";

/* ─── Inline quick-action bar for My Tickets rows ─── */

interface TicketQuickActionsProps {
  ticketId: string;
  currentStatus: string;
  currentPriority: string;
  boardStatuses?: Array<{ id: string; name: string }>;
  hub: TicketHub;
}

export function TicketQuickActions({
  ticketId,
  currentStatus,
  currentPriority,
  boardStatuses,
  hub,
}: TicketQuickActionsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status dropdown */}
      {boardStatuses && boardStatuses.length > 0 && (
        <select
          className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          value={currentStatus}
          onChange={(e) => hub.updateTicket.mutate({ id: ticketId, status: e.target.value })}
          disabled={hub.updateTicket.isPending}
        >
          {boardStatuses.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      )}

      {/* Priority dropdown */}
      <select
        className="h-7 rounded-md border border-border bg-background px-2 text-xs"
        value={currentPriority}
        onChange={(e) => hub.updateTicket.mutate({ id: ticketId, priority: PRIORITY_TO_CW[e.target.value as Priority] ?? e.target.value })}
        disabled={hub.updateTicket.isPending}
      >
        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
          <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
        ))}
      </select>

      {/* Reassign */}
      {hub.members.data && hub.members.data.length > 0 && (
        <select
          className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          value=""
          onChange={(e) => {
            if (e.target.value) hub.updateTicket.mutate({ id: ticketId, assignTo: e.target.value });
          }}
          disabled={hub.updateTicket.isPending}
        >
          <option value="">Reassign...</option>
          {hub.members.data.map((m) => (
            <option key={m.id} value={m.identifier}>{m.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ─── Inline quick note (expands under a row) ─── */

interface QuickNoteFormProps {
  ticketId: string;
  hub: TicketHub;
  onClose: () => void;
}

export function QuickNoteForm({ ticketId, hub, onClose }: QuickNoteFormProps) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(true);

  function submit() {
    if (!text.trim()) return;
    hub.addNote.mutate(
      { ticketId, text: text.trim(), internal },
      { onSuccess: () => { setText(""); onClose(); } }
    );
  }

  return (
    <div className="flex items-start gap-2 px-4 py-2 bg-muted/10 border-t border-border/20">
      <textarea
        autoFocus
        placeholder="Add a note..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 h-14 rounded-md border border-border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); if (e.key === "Escape") onClose(); }}
      />
      <div className="flex flex-col gap-1">
        <button
          onClick={submit}
          disabled={hub.addNote.isPending || !text.trim()}
          className="h-7 w-7 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {hub.addNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setInternal(!internal)}
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors",
            internal
              ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
              : "border-blue-500/30 text-blue-500 bg-blue-500/10"
          )}
        >
          {internal ? "Int" : "Ext"}
        </button>
      </div>
    </div>
  );
}

/* ─── Inline quick time entry ─── */

interface QuickTimeFormProps {
  ticketId: string;
  hub: TicketHub;
  onClose: () => void;
}

export function QuickTimeForm({ ticketId, hub, onClose }: QuickTimeFormProps) {
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    hub.addTime.mutate(
      { ticketId, hoursWorked: h, notes: notes.trim() || undefined },
      { onSuccess: () => { setHours(""); setNotes(""); onClose(); } }
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-t border-border/20">
      <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <input
        autoFocus
        type="number"
        placeholder="Hours"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-20 h-7 rounded-md border border-border bg-background px-2 text-xs"
        min="0.01"
        max="24"
        step="0.25"
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
      />
      <input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="flex-1 h-7 rounded-md border border-border bg-background px-2 text-xs"
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
      />
      <button
        onClick={submit}
        disabled={hub.addTime.isPending || !hours}
        className="h-7 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-50"
      >
        {hub.addTime.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
      </button>
      <button onClick={onClose} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}
