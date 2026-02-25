"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Bell, Mail, MessageSquare, Smartphone, Plus, Trash2, Settings, Loader2,
} from "lucide-react";
import { ChannelFormDialog } from "./channel-form-dialog";

const TYPE_ICONS: Record<string, typeof Bell> = {
  push: Bell,
  email: Mail,
  teams: MessageSquare,
  sms: Smartphone,
};

const TYPE_COLORS: Record<string, string> = {
  push: "bg-amber-500/10 text-amber-400",
  email: "bg-blue-500/10 text-blue-400",
  teams: "bg-purple-500/10 text-purple-400",
  sms: "bg-green-500/10 text-green-400",
};

const TYPE_LABELS: Record<string, string> = {
  push: "Browser Push",
  email: "Email",
  teams: "Microsoft Teams",
  sms: "SMS",
};

export function DeliveryChannelsSection() {
  const { data: channels, isLoading } = trpc.notificationChannel.list.useQuery();
  const utils = trpc.useUtils();
  const updateChannel = trpc.notificationChannel.update.useMutation({
    onSuccess: () => utils.notificationChannel.list.invalidate(),
  });
  const deleteChannel = trpc.notificationChannel.delete.useMutation({
    onSuccess: () => utils.notificationChannel.list.invalidate(),
  });
  const testChannel = trpc.notificationChannel.test.useMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<{ id: string; type: string; name: string; config: Record<string, unknown> } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Delivery Channels</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Loading channels...</p>
        </div>
        <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Delivery Channels</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage notification delivery methods. Users can select from these channels per alert source.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Channel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels?.map((ch) => {
          const Icon = TYPE_ICONS[ch.type] ?? Bell;
          const iconColor = TYPE_COLORS[ch.type] ?? "bg-muted text-muted-foreground";
          const config = ch.config as Record<string, unknown>;

          return (
            <Card key={ch.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0", iconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{ch.name}</p>
                        {ch.isBuiltIn && (
                          <Badge variant="secondary" className="text-[9px]">Built-in</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {TYPE_LABELS[ch.type] ?? ch.type}
                      </p>
                      {ch.type === "teams" && config.webhookUrl ? (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate max-w-[180px]">
                          {String(config.webhookUrl).substring(0, 40)}...
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Enable/disable toggle */}
                    <button
                      type="button"
                      onClick={() => updateChannel.mutate({ id: ch.id, enabled: !ch.enabled })}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        ch.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                          ch.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                        )}
                      />
                    </button>

                    {/* Configure (custom channels only) */}
                    {!ch.isBuiltIn && (
                      <button
                        onClick={() => setEditChannel({ id: ch.id, type: ch.type, name: ch.name, config })}
                        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title="Configure"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Test */}
                    {ch.type === "teams" && ch.enabled && (
                      <button
                        onClick={() => testChannel.mutate({ id: ch.id })}
                        disabled={testChannel.isPending}
                        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title="Send test message"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Delete (custom channels only) */}
                    {!ch.isBuiltIn && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${ch.name}"? This will remove it from all user preferences.`)) {
                            deleteChannel.mutate({ id: ch.id });
                          }
                        }}
                        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Delete channel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create dialog */}
      <ChannelFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
      />

      {/* Edit dialog */}
      {editChannel && (
        <ChannelFormDialog
          open={!!editChannel}
          onClose={() => setEditChannel(null)}
          mode="edit"
          channel={editChannel}
        />
      )}
    </div>
  );
}
