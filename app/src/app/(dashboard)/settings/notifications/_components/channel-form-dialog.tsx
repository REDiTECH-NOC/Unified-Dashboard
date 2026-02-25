"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  channel?: {
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
  };
}

export function ChannelFormDialog({ open, onClose, mode, channel }: ChannelFormDialogProps) {
  const utils = trpc.useUtils();
  const createChannel = trpc.notificationChannel.create.useMutation({
    onSuccess: () => {
      utils.notificationChannel.list.invalidate();
      onClose();
    },
  });
  const updateChannel = trpc.notificationChannel.update.useMutation({
    onSuccess: () => {
      utils.notificationChannel.list.invalidate();
      onClose();
    },
  });

  const [type, setType] = useState<"teams" | "sms">("teams");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (mode === "edit" && channel) {
      setType(channel.type as "teams" | "sms");
      setName(channel.name);
      setWebhookUrl((channel.config?.webhookUrl as string) ?? "");
    } else {
      setType("teams");
      setName("");
      setWebhookUrl("");
    }
  }, [mode, channel, open]);

  function handleSave() {
    if (mode === "create") {
      createChannel.mutate({
        type,
        name,
        config: type === "teams" ? { webhookUrl } : {},
      });
    } else if (channel) {
      updateChannel.mutate({
        id: channel.id,
        name,
        config: type === "teams" ? { webhookUrl } : {},
      });
    }
  }

  const isPending = createChannel.isPending || updateChannel.isPending;
  const error = createChannel.error || updateChannel.error;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClose={onClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Delivery Channel" : "Edit Channel"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new notification delivery endpoint."
              : `Update the "${channel?.name}" channel configuration.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector (create only) */}
          {mode === "create" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Channel Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType("teams")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm",
                    type === "teams"
                      ? "border-purple-400 bg-purple-400/10 text-purple-400"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Microsoft Teams
                </button>
                <button
                  onClick={() => setType("sms")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm",
                    type === "sms"
                      ? "border-green-400 bg-green-400/10 text-green-400"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <Smartphone className="h-4 w-4" />
                  SMS (Coming Soon)
                </button>
              </div>
            </div>
          )}

          {/* Channel name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Channel Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "teams" ? "NOC Alerts Channel" : "On-Call SMS"}
              className="text-sm"
            />
          </div>

          {/* Teams webhook URL */}
          {type === "teams" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Incoming Webhook URL
              </label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://outlook.office.com/webhook/..."
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Create an Incoming Webhook connector in your Teams channel to get this URL.
              </p>
            </div>
          )}

          {/* SMS config (coming soon) */}
          {type === "sms" && (
            <div className="rounded-md border border-border p-4 opacity-50">
              <p className="text-xs text-muted-foreground">
                SMS delivery via 3CX integration is coming soon. This channel type will be available
                after the 3CX phone integration is configured.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400">{error.message}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !name || (type === "teams" && !webhookUrl) || type === "sms"}
          >
            {isPending ? "Saving..." : mode === "create" ? "Add Channel" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
