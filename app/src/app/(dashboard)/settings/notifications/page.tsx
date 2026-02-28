"use client";

import { useSession } from "next-auth/react";
import { AlertPreferencesSection } from "./_components/alert-preferences-section";
import { DeliveryChannelsSection } from "./_components/delivery-channels-section";
import { OutboundNotificationsSection } from "./_components/outbound-notifications-section";
import { EmailTestSection } from "./_components/email-test-section";

export default function NotificationSettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Manage delivery channels, alert routing, and outbound notification rules"
            : "Configure your alert notification preferences"}
        </p>
      </div>

      {/* Section 1: Personal alert preferences (all users) */}
      <AlertPreferencesSection />

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          <div className="border-t border-border" />
          <DeliveryChannelsSection />

          <div className="border-t border-border" />
          <EmailTestSection />

          <div className="border-t border-border" />
          <OutboundNotificationsSection />
        </>
      )}
    </div>
  );
}
