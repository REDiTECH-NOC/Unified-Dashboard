"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, X, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";

const TYPE_LABELS: Record<string, string> = {
  ticket_assigned: "Assigned",
  ticket_reply: "Reply",
  ticket_status_changed: "Status",
  ticket_created: "New Ticket",
  alert_security: "Security Alert",
  alert_monitoring: "Monitoring Alert",
  alert_backup: "Backup Alert",
};

const TYPE_COLORS: Record<string, string> = {
  ticket_assigned: "bg-blue-500",
  ticket_reply: "bg-green-500",
  ticket_status_changed: "bg-yellow-500",
  ticket_created: "bg-purple-500",
  alert_security: "bg-red-500",
  alert_monitoring: "bg-orange-500",
  alert_backup: "bg-teal-500",
};

function timeAgo(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    unreadCount,
    notifications,
    markRead,
    markAllRead,
    dismiss,
    latestEvent,
    browserPushEnabled,
    toggleBrowserPush,
    browserPushSupported,
  } = useNotifications();

  // Show toast when new event arrives
  useEffect(() => {
    if (!latestEvent) return;
    toast(latestEvent.title, {
      description: latestEvent.body,
      action: latestEvent.linkUrl
        ? {
            label: "View",
            onClick: () => router.push(latestEvent.linkUrl!),
          }
        : undefined,
    });
  }, [latestEvent, router]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleNotificationClick = useCallback(
    (notification: { id: string; read: boolean; linkUrl: string | null }) => {
      if (!notification.read) {
        markRead.mutate({ id: notification.id });
      }
      if (notification.linkUrl) {
        setOpen(false);
        router.push(notification.linkUrl);
      }
    },
    [markRead, router]
  );

  const allNotifications =
    notifications.data?.pages.flatMap((p) => p.notifications) ?? [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[480px] rounded-lg border border-border bg-card shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-sm font-medium">Notifications</span>
            <div className="flex items-center gap-1">
              {/* Browser push toggle */}
              {browserPushSupported && (
                <button
                  onClick={toggleBrowserPush}
                  title={
                    browserPushEnabled
                      ? "Disable browser notifications"
                      : "Enable browser notifications"
                  }
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
                    browserPushEnabled
                      ? "text-green-400 hover:bg-green-500/10"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {browserPushEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {/* Mark all read */}
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  title="Mark all as read"
                  className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {allNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  You&apos;ll see ticket updates and alerts here
                </p>
              </div>
            ) : (
              allNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0",
                    !n.read && "bg-accent/20"
                  )}
                  onClick={() =>
                    handleNotificationClick({
                      id: n.id,
                      read: n.read,
                      linkUrl: n.linkUrl,
                    })
                  }
                >
                  {/* Type indicator */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        TYPE_COLORS[n.type] ?? "bg-zinc-500"
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs font-medium mt-0.5 truncate">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate({ id: n.id });
                        }}
                        title="Mark as read"
                        className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss.mutate({ id: n.id });
                      }}
                      title="Dismiss"
                      className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-red-400 hover:bg-accent transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Load more */}
            {notifications.hasNextPage && (
              <button
                onClick={() => notifications.fetchNextPage()}
                disabled={notifications.isFetchingNextPage}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                {notifications.isFetchingNextPage
                  ? "Loading..."
                  : "Load more"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
