"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Bell, AlertTriangle, Ticket, FileText, Activity,
  Mail, MessageSquare, Smartphone, Check, Settings,
} from "lucide-react";

const groupIcons: Record<string, typeof Bell> = {
  alerts: AlertTriangle,
  tickets: Ticket,
  reports: FileText,
  system: Activity,
};

const groupLabels: Record<string, string> = {
  alerts: "Alerts",
  tickets: "Tickets",
  reports: "Reports",
  system: "System",
};

type NotificationType = {
  type: string;
  displayName: string;
  description: string;
  group: string;
  defaultSender: string;
  emailEnabled: boolean;
  emailSender: string;
  emailRecipients: string[];
  teamsEnabled: boolean;
  teamsWebhookUrl: string;
  smsEnabled: boolean;
  smsRecipients: string[];
  configured: boolean;
  id: string | null;
};

export default function NotificationSettingsPage() {
  const { data: notifications, isLoading, refetch } = trpc.notification.list.useQuery();
  const updateNotification = trpc.notification.update.useMutation({
    onSuccess: () => {
      refetch();
      setDialogOpen(false);
    },
  });
  const testNotification = trpc.notification.test.useMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationType | null>(null);

  // Form state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailSender, setEmailSender] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(false);

  function openConfigure(nt: NotificationType) {
    setEditing(nt);
    setEmailEnabled(nt.emailEnabled);
    setEmailSender(nt.emailSender || nt.defaultSender);
    setEmailRecipients(nt.emailRecipients.join(", "));
    setTeamsEnabled(nt.teamsEnabled);
    setTeamsWebhookUrl(nt.teamsWebhookUrl || "");
    setSmsEnabled(false); // SMS not available yet
    setDialogOpen(true);
  }

  function handleSave() {
    if (!editing) return;
    updateNotification.mutate({
      type: editing.type,
      emailEnabled,
      emailSender: emailSender || undefined,
      emailRecipients: emailRecipients
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
      teamsEnabled,
      teamsWebhookUrl: teamsWebhookUrl || undefined,
      smsEnabled: false,
      smsRecipients: [],
    });
  }

  function handleTest() {
    if (!editing) return;
    testNotification.mutate({ type: editing.type });
  }

  // Group notifications by group
  const grouped = notifications?.reduce(
    (acc, nt) => {
      if (!acc[nt.group]) acc[nt.group] = [];
      acc[nt.group].push(nt);
      return acc;
    },
    {} as Record<string, NotificationType[]>
  );

  const configuredCount = notifications?.filter((n) => n.configured).length ?? 0;
  const totalCount = notifications?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Configure notification channels and sender emails for each event type
          </p>
        </div>
        {notifications && (
          <Badge variant="outline" className="text-sm">
            {configuredCount} / {totalCount} configured
          </Badge>
        )}
      </div>

      {/* Channel overview */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Mail className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground">Microsoft 365 Graph API</p>
            </div>
            <Badge variant="success" className="ml-auto text-[10px]">Available</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <MessageSquare className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Microsoft Teams</p>
              <p className="text-xs text-muted-foreground">Incoming Webhooks</p>
            </div>
            <Badge variant="success" className="ml-auto text-[10px]">Available</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <Smartphone className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium">SMS</p>
              <p className="text-xs text-muted-foreground">Via 3CX Integration</p>
            </div>
            <Badge variant="secondary" className="ml-auto text-[10px]">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Notification types grouped */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notification settings...</p>
      ) : (
        Object.entries(grouped || {}).map(([group, items]) => {
          const Icon = groupIcons[group] || Bell;
          return (
            <div key={group} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Icon className="h-4 w-4" />
                {groupLabels[group] || group}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((nt) => (
                  <Card key={nt.type} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={
                              "mt-1.5 h-2 w-2 rounded-full flex-shrink-0 " +
                              (nt.configured ? "bg-success" : "bg-muted-foreground/30")
                            }
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{nt.displayName}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                              {nt.description}
                            </p>
                            {/* Channel badges */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {nt.emailEnabled && (
                                <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0">
                                  <Mail className="h-2.5 w-2.5" />
                                  {nt.emailSender || "Email"}
                                </Badge>
                              )}
                              {nt.teamsEnabled && (
                                <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  Teams
                                </Badge>
                              )}
                              {!nt.configured && (
                                <span className="text-[10px] text-muted-foreground">Not configured</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0 ml-2"
                          onClick={() => openConfigure(nt)}
                        >
                          <Settings className="h-3.5 w-3.5 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Configure Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure {editing?.displayName}</DialogTitle>
            <DialogDescription>
              {editing?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Email Channel */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEnabled(!emailEnabled)}
                  className={
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
                    (emailEnabled ? "bg-blue-500" : "bg-muted-foreground/30")
                  }
                >
                  <span
                    className={
                      "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform " +
                      (emailEnabled ? "translate-x-4.5" : "translate-x-0.5")
                    }
                  />
                </button>
              </div>
              {emailEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Sender Email Address
                    </label>
                    <Input
                      value={emailSender}
                      onChange={(e) => setEmailSender(e.target.value)}
                      placeholder="alerts@yourdomain.com"
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Must be a mailbox with Send As permission in your Microsoft 365 tenant
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Recipients (comma-separated)
                    </label>
                    <Input
                      value={emailRecipients}
                      onChange={(e) => setEmailRecipients(e.target.value)}
                      placeholder="admin@yourdomain.com, noc@yourdomain.com"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Teams Channel */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium">Microsoft Teams</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamsEnabled(!teamsEnabled)}
                  className={
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
                    (teamsEnabled ? "bg-purple-500" : "bg-muted-foreground/30")
                  }
                >
                  <span
                    className={
                      "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform " +
                      (teamsEnabled ? "translate-x-4.5" : "translate-x-0.5")
                    }
                  />
                </button>
              </div>
              {teamsEnabled && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Incoming Webhook URL
                  </label>
                  <Input
                    value={teamsWebhookUrl}
                    onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                    placeholder="https://outlook.office.com/webhook/..."
                    className="text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Create an Incoming Webhook connector in your Teams channel
                  </p>
                </div>
              )}
            </div>

            {/* SMS Channel — Coming Soon */}
            <div className="rounded-md border border-border p-4 opacity-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium">SMS</span>
                  <Badge variant="secondary" className="text-[9px]">Coming Soon</Badge>
                </div>
                <button
                  type="button"
                  disabled
                  className="relative inline-flex h-5 w-9 items-center rounded-full bg-muted-foreground/30 cursor-not-allowed"
                >
                  <span className="inline-block h-3.5 w-3.5 rounded-full bg-white translate-x-0.5" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                SMS notifications will be available after 3CX integration is configured.
              </p>
            </div>
          </div>

          {updateNotification.error && (
            <p className="text-sm text-red-400">{updateNotification.error.message}</p>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testNotification.isPending || (!emailEnabled && !teamsEnabled)}
              className="gap-1.5"
            >
              <Bell className="h-3.5 w-3.5" />
              {testNotification.isPending ? "Sending..." : "Test Notification"}
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={updateNotification.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateNotification.isPending}>
                {updateNotification.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </DialogFooter>

          {testNotification.isSuccess && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Test notification sent (placeholder)
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
