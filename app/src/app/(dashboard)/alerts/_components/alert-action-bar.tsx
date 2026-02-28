"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  UserCheck,
  XCircle,
  Ticket,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */

interface AlertInfo {
  id: string;
  source: string;
  title: string;
  severity: string;
  deviceHostname?: string;
  organizationName?: string;
}

interface AlertActionBarProps {
  selectedAlerts: AlertInfo[];
  onClearSelection: () => void;
  onOpenCreateTicket: () => void;
}

/* ─── Component ──────────────────────────────────────────── */

export function AlertActionBar({
  selectedAlerts,
  onClearSelection,
  onOpenCreateTicket,
}: AlertActionBarProps) {
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const utils = trpc.useUtils();

  const takeOwnership = trpc.alertAction.takeOwnership.useMutation({
    onSuccess: () => {
      utils.alertAction.getStates.invalidate();
      onClearSelection();
    },
  });

  const closeAlerts = trpc.alertAction.close.useMutation({
    onSuccess: () => {
      utils.alertAction.getStates.invalidate();
      setShowCloseForm(false);
      setCloseNote("");
      onClearSelection();
    },
  });

  const count = selectedAlerts.length;
  if (count === 0) return null;

  // Determine the primary source for the batch (use first alert's source)
  const primarySource = selectedAlerts[0].source;

  function handleAssign() {
    takeOwnership.mutate({
      alertIds: selectedAlerts.map((a) => a.id),
      source: primarySource,
    });
  }

  function handleClose() {
    if (!closeNote.trim()) return;
    closeAlerts.mutate({
      alertIds: selectedAlerts.map((a) => a.id),
      source: primarySource,
      note: closeNote.trim(),
    });
  }

  const isPending = takeOwnership.isPending || closeAlerts.isPending;

  return (
    <div className="sticky bottom-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
      {/* Close form (expandable) */}
      {showCloseForm && (
        <div className="px-4 py-3 border-b border-border/50 bg-accent/30">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Close note (required)
          </label>
          <textarea
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            placeholder="Describe resolution or reason for closing..."
            rows={2}
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            autoFocus
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleClose}
              disabled={!closeNote.trim() || closeAlerts.isPending}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {closeAlerts.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Close {count} {count === 1 ? "Alert" : "Alerts"}
            </button>
            <button
              onClick={() => {
                setShowCloseForm(false);
                setCloseNote("");
              }}
              className="h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Count */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-primary/15 text-primary text-xs font-bold">
            {count}
          </span>
          <span className="text-sm text-muted-foreground">
            {count === 1 ? "alert" : "alerts"} selected
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Assign to Me */}
        <button
          onClick={handleAssign}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          {takeOwnership.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          Assign to Me
        </button>

        {/* Close */}
        <button
          onClick={() => setShowCloseForm(!showCloseForm)}
          disabled={isPending}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50",
            showCloseForm
              ? "bg-red-500/20 text-red-400 border-red-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
          )}
        >
          <XCircle className="h-3.5 w-3.5" />
          Close
          {showCloseForm ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronUp className="h-3 w-3" />
          )}
        </button>

        {/* Create Ticket */}
        <button
          onClick={onOpenCreateTicket}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Ticket className="h-3.5 w-3.5" />
          Create Ticket
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {/* Error messages */}
      {takeOwnership.error && (
        <div className="px-4 pb-2 text-xs text-red-400">
          {takeOwnership.error.message.substring(0, 100)}
        </div>
      )}
      {closeAlerts.error && (
        <div className="px-4 pb-2 text-xs text-red-400">
          {closeAlerts.error.message.substring(0, 100)}
        </div>
      )}
    </div>
  );
}
