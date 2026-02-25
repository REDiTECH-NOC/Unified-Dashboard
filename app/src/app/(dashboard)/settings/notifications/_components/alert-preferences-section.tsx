"use client";

import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Bell, ShieldAlert, Shield, Monitor, Activity, HardDrive,
  Loader2, Mail, MessageSquare, Smartphone,
} from "lucide-react";

const SEVERITY_OPTIONS = [
  { id: "critical", label: "Critical", color: "bg-red-500", textColor: "text-red-400" },
  { id: "high", label: "High", color: "bg-orange-500", textColor: "text-orange-400" },
  { id: "medium", label: "Medium", color: "bg-yellow-500", textColor: "text-yellow-400" },
  { id: "low", label: "Low", color: "bg-blue-400", textColor: "text-blue-400" },
  { id: "informational", label: "Info", color: "bg-zinc-400", textColor: "text-zinc-400" },
];

const SOURCE_ICONS: Record<string, typeof Bell> = {
  sentinelone: ShieldAlert,
  blackpoint: Shield,
  ninjaone: Monitor,
  uptime: Activity,
  cove: HardDrive,
};

const SOURCE_COLORS: Record<string, string> = {
  sentinelone: "bg-purple-500/10 text-purple-400",
  blackpoint: "bg-blue-500/10 text-blue-400",
  ninjaone: "bg-emerald-500/10 text-emerald-400",
  uptime: "bg-rose-500/10 text-rose-400",
  cove: "bg-teal-500/10 text-teal-400",
};

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  push: Bell,
  email: Mail,
  teams: MessageSquare,
  sms: Smartphone,
};

export function AlertPreferencesSection() {
  const { data, isLoading } = trpc.notificationPreferences.getMyPrefs.useQuery();
  const utils = trpc.useUtils();
  const upsertPref = trpc.notificationPreferences.upsertPref.useMutation({
    onSuccess: () => utils.notificationPreferences.getMyPrefs.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">My Alert Preferences</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure which alerts you receive and how they are delivered.
          </p>
        </div>
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading preferences...</span>
        </div>
      </div>
    );
  }

  if (!data || data.sources.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">My Alert Preferences</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure which alerts you receive and how they are delivered.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No alert sources assigned</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Your administrator has not granted you access to any alert notification sources.
              Contact your admin to enable alert notifications for your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { sources, channels } = data;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">My Alert Preferences</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose which alerts you receive and how they are delivered. Toggle severity levels and delivery channels per source.
        </p>
      </div>

      <div className="grid gap-3">
        {sources.map((pref) => {
          const Icon = SOURCE_ICONS[pref.source] ?? Bell;
          const iconColor = SOURCE_COLORS[pref.source] ?? "bg-muted text-muted-foreground";

          return (
            <Card key={pref.source}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Source icon */}
                  <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 mt-0.5", iconColor)}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{pref.label}</p>
                      <span className="text-[10px] text-muted-foreground capitalize">{pref.category}</span>
                    </div>

                    {/* Severity multi-select */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground mr-0.5">Severities:</span>
                      {SEVERITY_OPTIONS.map((sev) => {
                        const isSelected = pref.severities.includes(sev.id);
                        return (
                          <button
                            key={sev.id}
                            disabled={!pref.enabled}
                            onClick={() => {
                              const newSeverities = isSelected
                                ? pref.severities.filter((s) => s !== sev.id)
                                : [...pref.severities, sev.id];
                              upsertPref.mutate({
                                source: pref.source,
                                enabled: pref.enabled,
                                severities: newSeverities as ("critical" | "high" | "medium" | "low" | "informational")[],
                                channels: pref.channels,
                              });
                            }}
                            className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors",
                              !pref.enabled && "opacity-40 cursor-not-allowed",
                              isSelected && pref.enabled
                                ? `${sev.textColor} border-current bg-current/10`
                                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", isSelected && pref.enabled ? sev.color : "bg-muted-foreground/20")} />
                            {sev.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Channel picker */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground mr-0.5">Deliver via:</span>
                      {channels.map((ch) => {
                        const isSelected = pref.channels.includes(ch.channelKey);
                        const ChIcon = CHANNEL_ICONS[ch.type] ?? Bell;
                        return (
                          <button
                            key={ch.channelKey}
                            disabled={!pref.enabled}
                            onClick={() => {
                              const newChannels = isSelected
                                ? pref.channels.filter((c) => c !== ch.channelKey)
                                : [...pref.channels, ch.channelKey];
                              upsertPref.mutate({
                                source: pref.source,
                                enabled: pref.enabled,
                                severities: pref.severities as ("critical" | "high" | "medium" | "low" | "informational")[],
                                channels: newChannels,
                              });
                            }}
                            className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors",
                              !pref.enabled && "opacity-40 cursor-not-allowed",
                              isSelected && pref.enabled
                                ? "text-emerald-400 border-emerald-400/50 bg-emerald-400/10"
                                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                          >
                            <ChIcon className="h-2.5 w-2.5" />
                            {ch.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enable/disable toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      upsertPref.mutate({
                        source: pref.source,
                        enabled: !pref.enabled,
                        severities: pref.severities as ("critical" | "high" | "medium" | "low" | "informational")[],
                        channels: pref.channels,
                      });
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-1",
                      pref.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                        pref.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Alert sources are assigned by your administrator via permission roles.
        The alert check runs every 2-5 minutes. Matching alerts appear as toasts, in the bell dropdown,
        and via your selected delivery channels.
      </p>
    </div>
  );
}
