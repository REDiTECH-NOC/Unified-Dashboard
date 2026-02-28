"use client";

import { Fragment, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mail, Send, Check, AlertTriangle, Loader2, ChevronDown, ChevronUp,
  Clock, ArrowRight, XCircle, CheckCircle2, Info,
} from "lucide-react";

type EmailLog = {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyPreview: string | null;
  bodyHtml: string | null;
  status: string;
  errorMessage: string | null;
  trigger: string;
  triggeredBy: string | null;
  createdAt: Date;
};

export function EmailTestSection() {
  const [senderEmail, setSenderEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const sendTest = trpc.notification.sendTestEmail.useMutation();
  const { data: logData, isLoading: logsLoading, refetch: refetchLogs } = trpc.notification.emailLogs.useQuery(
    { limit: 20 },
    { enabled: showLogs }
  );

  function handleSend() {
    if (!senderEmail || !recipientEmail) return;
    sendTest.mutate(
      { senderEmail, recipientEmail },
      {
        onSuccess: () => {
          if (showLogs) refetchLogs();
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Email Configuration</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Test email delivery via Microsoft Graph API. Requires <code className="text-xs bg-muted px-1 py-0.5 rounded">Mail.Send</code> application
          permission with admin consent.
        </p>
      </div>

      {/* Test Email Card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Mail className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Send Test Email</p>
              <p className="text-[10px] text-muted-foreground">
                Verify that Graph API email sending works from a specific mailbox
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2.5">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300/80 space-y-1">
                <p>
                  The sender must be a <strong>shared mailbox</strong>, <strong>distribution group</strong>, or{" "}
                  <strong>user mailbox</strong> in your Microsoft 365 tenant. The Entra app registration
                  needs <code className="bg-blue-500/10 px-1 rounded">Mail.Send</code> (Application) permission
                  with admin consent.
                </p>
                <p>
                  To restrict which mailboxes the app can send from, create an{" "}
                  <strong>Application Access Policy</strong> in Exchange Online PowerShell.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Send From (Mailbox)
              </label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="alerts@yourdomain.com"
                className="text-sm"
                type="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Send To (Recipient)
              </label>
              <Input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                className="text-sm"
                type="email"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSend}
              disabled={!senderEmail || !recipientEmail || sendTest.isPending}
              size="sm"
              className="gap-1.5"
            >
              {sendTest.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {sendTest.isPending ? "Sending..." : "Send Test Email"}
            </Button>

            {sendTest.isSuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                {sendTest.data.message}
              </p>
            )}
            {sendTest.isError && (
              <p className="text-xs text-red-400 flex items-center gap-1 max-w-md">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="line-clamp-2">{sendTest.error.message}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Send Log */}
      <div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Email Send Log
          {logData?.logs && logData.logs.length > 0 && (
            <Badge variant="outline" className="text-[10px] ml-1">
              {logData.logs.length}
            </Badge>
          )}
        </button>

        {showLogs && (
          <div className="mt-3">
            {logsLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading logs...
              </div>
            ) : !logData?.logs || logData.logs.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No emails sent yet. Send a test email to see logs here.
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">From</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">To</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Subject</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Trigger</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logData.logs.map((log: EmailLog) => (
                      <Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          className={cn(
                            "border-b border-border last:border-0 cursor-pointer hover:bg-muted/20 transition-colors",
                            log.status === "failed" && "bg-red-500/5",
                            expandedLogId === log.id && "bg-muted/10"
                          )}
                        >
                          <td className="px-3 py-2">
                            {log.status === "sent" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <span title={log.errorMessage || "Failed"}>
                                <XCircle className="h-4 w-4 text-red-400" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono truncate max-w-[160px]">
                            {log.senderEmail}
                          </td>
                          <td className="px-3 py-2 text-xs truncate max-w-[160px]">
                            <span className="flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              {log.recipientEmail}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs truncate max-w-[200px] text-muted-foreground">
                            {log.subject}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[9px]",
                                log.trigger === "test" && "bg-blue-500/10 text-blue-400",
                                log.trigger === "alert" && "bg-amber-500/10 text-amber-400",
                                log.trigger === "report" && "bg-purple-500/10 text-purple-400",
                                log.trigger === "system" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {log.trigger}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                        {expandedLogId === log.id && (
                          <tr className="border-b border-border bg-muted/5">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="space-y-2">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Message Preview</p>
                                {log.bodyHtml ? (
                                  <div
                                    className="rounded border border-border bg-background p-3 text-xs max-h-[300px] overflow-auto"
                                    dangerouslySetInnerHTML={{ __html: log.bodyHtml }}
                                  />
                                ) : log.bodyPreview ? (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-background rounded border border-border p-3">
                                    {log.bodyPreview}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No message body recorded</p>
                                )}
                                {log.errorMessage && (
                                  <div className="mt-2">
                                    <p className="text-[11px] font-medium text-red-400 uppercase tracking-wider mb-1">Error</p>
                                    <p className="text-xs text-red-300/70 font-mono bg-red-500/5 rounded border border-red-500/20 p-2">
                                      {log.errorMessage}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                {logData.logs.some((l: EmailLog) => l.status === "failed") && (
                  <div className="px-3 py-2 bg-red-500/5 border-t border-border">
                    <details>
                      <summary className="text-xs text-red-400 cursor-pointer">View error details</summary>
                      <div className="mt-2 space-y-1">
                        {logData.logs
                          .filter((l: EmailLog) => l.status === "failed" && l.errorMessage)
                          .map((l: EmailLog) => (
                            <p key={l.id} className="text-[11px] text-red-300/70 font-mono">
                              [{new Date(l.createdAt).toLocaleTimeString()}] {l.errorMessage}
                            </p>
                          ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
