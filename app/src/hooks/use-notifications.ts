"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "next-auth/react";

interface SSENotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
}

/**
 * Hook that manages SSE connection for real-time notifications
 * and provides notification data via tRPC queries.
 *
 * Features:
 * - Auto-connects when authenticated
 * - Reconnects with exponential backoff on disconnect
 * - Fires browser Notification API if user has opted in
 * - Invalidates tRPC notification queries on new events
 */
export function useNotifications() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCountRef = useRef(0);
  const [latestEvent, setLatestEvent] = useState<SSENotification | null>(null);

  // Browser push preference (persisted in localStorage)
  const [browserPushEnabled, setBrowserPushEnabled] = useState(false);

  // Load browser push preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("rcc-browser-notifications");
    if (stored === "true") {
      setBrowserPushEnabled(true);
    }
  }, []);

  const toggleBrowserPush = useCallback(async () => {
    if (!browserPushEnabled) {
      // Request permission if not yet granted
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        const result = await Notification.requestPermission();
        if (result !== "granted") return;
      }
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        return; // Permission denied
      }
      setBrowserPushEnabled(true);
      localStorage.setItem("rcc-browser-notifications", "true");
    } else {
      setBrowserPushEnabled(false);
      localStorage.setItem("rcc-browser-notifications", "false");
    }
  }, [browserPushEnabled]);

  // Ticket poll — triggers server-side CW ticket change detection every 2 minutes
  const pollTickets = trpc.notificationInbox.pollTickets.useMutation({
    onSuccess: (data) => {
      if (data.notifications && data.notifications > 0) {
        utils.notificationInbox.unreadCount.invalidate();
        utils.notificationInbox.list.invalidate();
      }
    },
  });
  const pollTicketsRef = useRef(pollTickets);
  pollTicketsRef.current = pollTickets;

  useEffect(() => {
    if (!session?.user) return;
    // Initial poll after short delay to let the page load
    const initialTimer = setTimeout(() => pollTicketsRef.current.mutate(), 5_000);
    // Then poll every 2 minutes
    const interval = setInterval(() => pollTicketsRef.current.mutate(), 120_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [session?.user]);

  // tRPC queries
  const unreadCount = trpc.notificationInbox.unreadCount.useQuery(undefined, {
    enabled: !!session?.user,
    refetchInterval: 60_000, // Fallback polling every 60s
    staleTime: 10_000,
  });

  const notifications = trpc.notificationInbox.list.useInfiniteQuery(
    { limit: 20 },
    {
      enabled: !!session?.user,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 15_000,
    }
  );

  const markRead = trpc.notificationInbox.markRead.useMutation({
    onSuccess: () => {
      utils.notificationInbox.unreadCount.invalidate();
      utils.notificationInbox.list.invalidate();
    },
  });

  const markAllRead = trpc.notificationInbox.markAllRead.useMutation({
    onSuccess: () => {
      utils.notificationInbox.unreadCount.invalidate();
      utils.notificationInbox.list.invalidate();
    },
  });

  const dismiss = trpc.notificationInbox.dismiss.useMutation({
    onSuccess: () => {
      utils.notificationInbox.unreadCount.invalidate();
      utils.notificationInbox.list.invalidate();
    },
  });

  // Fire browser notification
  const fireBrowserNotification = useCallback(
    (notification: SSENotification) => {
      if (
        !browserPushEnabled ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const n = new Notification(notification.title, {
        body: notification.body || undefined,
        icon: "/favicon.ico",
        tag: notification.id, // Deduplicate
      });

      if (notification.linkUrl) {
        n.onclick = () => {
          window.focus();
          const url = notification.linkUrl!;
          if (url.startsWith("/")) {
            window.location.assign(new URL(url, window.location.origin).href);
          } else {
            try {
              const parsed = new URL(url);
              if (parsed.protocol === "https:") {
                window.location.assign(parsed.href);
              }
            } catch {
              // Invalid URL — ignore
            }
          }
          n.close();
        };
      }
    },
    [browserPushEnabled]
  );

  // Connect SSE
  const connect = useCallback(() => {
    if (!session?.user || typeof EventSource === "undefined") return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/notifications/sse");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSENotification = JSON.parse(event.data);
        setLatestEvent(data);

        // Invalidate tRPC queries to refresh UI
        utils.notificationInbox.unreadCount.invalidate();
        utils.notificationInbox.list.invalidate();

        // Fire browser notification
        fireBrowserNotification(data);
      } catch {
        // Invalid JSON — ignore (might be keep-alive)
      }
    };

    es.onopen = () => {
      retryCountRef.current = 0; // Reset backoff on successful connection
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30_000);
      retryCountRef.current++;

      retryTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [session?.user, utils, fireBrowserNotification]);

  // Start/stop SSE connection based on session
  useEffect(() => {
    if (session?.user) {
      connect();
    }

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [session?.user, connect]);

  return {
    unreadCount: unreadCount.data?.count ?? 0,
    notifications,
    markRead,
    markAllRead,
    dismiss,
    latestEvent,
    browserPushEnabled,
    toggleBrowserPush,
    browserPushSupported:
      typeof Notification !== "undefined" && Notification.permission !== "denied",
  };
}
