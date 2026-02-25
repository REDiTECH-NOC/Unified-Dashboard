"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Webhook,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

export function WebhookCallbacksCard() {
  const utils = trpc.useUtils();

  // Fetch existing callbacks
  const callbacks = trpc.notificationInbox.listCwCallbacks.useQuery(undefined, {
    staleTime: 30_000,
    retry: 1,
  });

  // Mutations
  const registerMutation =
    trpc.notificationInbox.registerCwCallback.useMutation({
      onSuccess: () => {
        utils.notificationInbox.listCwCallbacks.invalidate();
        setShowRegister(false);
        setWebhookUrl("");
        setSecret("");
      },
    });

  const deleteMutation = trpc.notificationInbox.deleteCwCallback.useMutation({
    onSuccess: () => {
      utils.notificationInbox.listCwCallbacks.invalidate();
    },
  });

  // Local state
  const [showRegister, setShowRegister] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Generate a random secret
  function generateSecret() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Auto-fill with current domain
  function autoFillUrl() {
    const base = window.location.origin;
    setWebhookUrl(`${base}/api/webhooks/connectwise`);
    if (!secret) setSecret(generateSecret());
  }

  // Copy to clipboard
  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  // Split into RCC vs other callbacks
  const rccCallbacks = (callbacks.data ?? []).filter(
    (cb: any) => cb.description === "RCC Ticket Notifications"
  );
  const otherCallbacks = (callbacks.data ?? []).filter(
    (cb: any) => cb.description !== "RCC Ticket Notifications"
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Webhook className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Webhook Callbacks</h3>
            <p className="text-xs text-muted-foreground">
              Real-time ticket notifications from ConnectWise
            </p>
          </div>
        </div>
        {!showRegister && (
          <button
            onClick={() => {
              setShowRegister(true);
              autoFillUrl();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Callback
          </button>
        )}
      </div>

      {/* Register Form */}
      {showRegister && (
        <div className="p-4 border-b border-border/50 bg-muted/10 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/api/webhooks/connectwise"
                className="flex-1 h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <button
                onClick={autoFillUrl}
                className="h-8 px-3 text-[10px] font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Auto-fill
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Webhook Secret
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Minimum 16 characters"
                className="flex-1 h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground font-mono outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <button
                onClick={() => setSecret(generateSecret())}
                className="h-8 px-3 text-[10px] font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Generate
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              This secret must also be set as the <code className="px-1 bg-muted rounded text-foreground">CW_WEBHOOK_SECRET</code> environment variable on your server.
            </p>
          </div>

          {registerMutation.error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {registerMutation.error.message}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                registerMutation.mutate({ webhookUrl, secret })
              }
              disabled={
                !webhookUrl ||
                secret.length < 16 ||
                registerMutation.isPending
              }
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {registerMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Webhook className="h-3.5 w-3.5" />
              )}
              Register with ConnectWise
            </button>
            <button
              onClick={() => {
                setShowRegister(false);
                registerMutation.reset();
              }}
              className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Callbacks List */}
      <div className="divide-y divide-border/30">
        {callbacks.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rccCallbacks.length === 0 && otherCallbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
            <Webhook className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs font-medium text-muted-foreground">
              No callbacks registered
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Register a callback to receive real-time ticket notifications.
            </p>
          </div>
        ) : (
          <>
            {/* RCC Callbacks */}
            {rccCallbacks.length > 0 && (
              <>
                {rccCallbacks.map((cb: any) => (
                  <div
                    key={cb.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">
                          {cb.description || "RCC Callback"}
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 flex-shrink-0">
                          Active
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground truncate font-mono">
                          {(cb.url ?? "").replace(/[?&]secret=[^&]+/, "?secret=***")}
                        </p>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              (cb.url ?? "").replace(/[?&]secret=[^&]+/, ""),
                              `url-${cb.id}`
                            )
                          }
                          className="flex-shrink-0"
                        >
                          {copiedField === `url-${cb.id}` ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Type: {cb.type ?? "Ticket"} · Level: {cb.level ?? "Owner"} · ID: {cb.id}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (deleteConfirm === cb.id) {
                          deleteMutation.mutate({ callbackId: cb.id });
                          setDeleteConfirm(null);
                        } else {
                          setDeleteConfirm(cb.id);
                          setTimeout(() => setDeleteConfirm(null), 3000);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors flex-shrink-0",
                        deleteConfirm === cb.id
                          ? "bg-red-500/20 text-red-400"
                          : "text-muted-foreground hover:text-red-400"
                      )}
                    >
                      <Trash2 className="h-3 w-3" />
                      {deleteConfirm === cb.id ? "Confirm" : "Remove"}
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* No RCC callback yet but others exist */}
            {rccCallbacks.length === 0 && otherCallbacks.length > 0 && (
              <div className="flex flex-col items-center justify-center py-6 px-6 text-center">
                <Webhook className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-xs font-medium text-muted-foreground">
                  No RCC callback registered yet
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Click &quot;Register Callback&quot; to enable real-time notifications.
                </p>
              </div>
            )}

            {/* Other CW Callbacks */}
            {otherCallbacks.length > 0 && (
              <>
                <div className="px-4 py-2 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Other CW Callbacks ({otherCallbacks.length})
                  </p>
                </div>
                {otherCallbacks.map((cb: any) => (
                  <div
                    key={cb.id}
                    className="flex items-center gap-3 px-4 py-2.5 opacity-60"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium truncate">
                        {cb.description || `Callback #${cb.id}`}
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate font-mono">
                        {(cb.url ?? "").replace(/[?&]secret=[^&]+/, "?secret=***")}
                      </p>
                    </div>
                    <span className="text-[9px] text-muted-foreground flex-shrink-0">
                      ID: {cb.id}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
