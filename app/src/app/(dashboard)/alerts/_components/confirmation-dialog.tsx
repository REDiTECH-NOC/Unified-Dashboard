"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "danger" | "warning";
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  variant = "danger",
}: ConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isDanger = variant === "danger";

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
              isDanger ? "bg-red-500/10" : "bg-orange-500/10"
            )}
          >
            <AlertTriangle
              className={cn("h-5 w-5", isDanger ? "text-red-500" : "text-orange-500")}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-8 px-4 rounded-lg bg-accent hover:bg-accent/80 text-sm font-medium text-foreground transition-colors border border-border disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "h-8 px-4 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2",
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-600 hover:bg-orange-700"
            )}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
