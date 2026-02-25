"use client";

import { Toaster } from "sonner";

/**
 * Notification toast wrapper — configured for dark mode.
 * Placed in the root layout/providers.
 */
export function NotificationToaster() {
  return (
    <Toaster
      position="top-right"
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        className: "border-border bg-card text-foreground",
        duration: 5000,
      }}
    />
  );
}
