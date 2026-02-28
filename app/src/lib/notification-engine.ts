/**
 * Notification Engine — core functions for creating, publishing, and routing
 * in-app notifications via Redis Pub/Sub.
 *
 * Used by: CW webhook handler, future integrations (NinjaOne, S1, etc.)
 */

import { prisma } from "./prisma";
import { redis } from "./redis";
import { auditLog } from "./audit";
import type { Prisma } from "@prisma/client";

export type NotificationType =
  | "ticket_assigned"
  | "ticket_reply"
  | "ticket_status_changed"
  | "ticket_created"
  | "alert_security"
  | "alert_monitoring"
  | "alert_backup";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an in-app notification and publish it via Redis Pub/Sub.
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.inAppNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  await publishToUser(input.userId, {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    linkUrl: notification.linkUrl,
    sourceType: notification.sourceType,
    sourceId: notification.sourceId,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}

/**
 * Publish a notification event to a user's Redis Pub/Sub channel.
 * SSE endpoints subscribe to these channels for real-time push.
 */
export async function publishToUser(userId: string, payload: Record<string, unknown>) {
  try {
    await redis.publish(`notifications:${userId}`, JSON.stringify(payload));
  } catch (err) {
    console.error("[notification-engine] Failed to publish to Redis:", err);
  }
}

/**
 * Resolve which app userId owns a ticket by CW member identifier.
 * Uses UserIntegrationMapping to look up CW member → app user.
 *
 * Accepts the display name (ticket.owner.name) plus optional CW member
 * numeric ID and identifier for more reliable matching.
 */
export async function resolveTicketOwner(
  cwMemberIdentifier: string,
  opts?: { memberId?: string; memberIdentifier?: string }
): Promise<string | null> {
  if (!cwMemberIdentifier && !opts?.memberId && !opts?.memberIdentifier) return null;

  // Build OR conditions — try numeric ID first (most reliable), then identifier, then name/email
  const orConditions: Array<Record<string, unknown>> = [];

  if (opts?.memberId) {
    orConditions.push({ externalId: opts.memberId });
  }
  if (opts?.memberIdentifier) {
    orConditions.push({ externalId: opts.memberIdentifier });
    orConditions.push({ externalName: { equals: opts.memberIdentifier, mode: "insensitive" } });
  }
  if (cwMemberIdentifier) {
    orConditions.push({ externalId: cwMemberIdentifier });
    orConditions.push({ externalName: { equals: cwMemberIdentifier, mode: "insensitive" } });
    orConditions.push({ externalEmail: { equals: cwMemberIdentifier, mode: "insensitive" } });
  }

  if (orConditions.length === 0) return null;

  const mapping = await prisma.userIntegrationMapping.findFirst({
    where: {
      toolId: "connectwise",
      OR: orConditions,
    },
  });

  return mapping?.userId ?? null;
}

/**
 * Get all app userIds that have a CW integration mapping.
 * Used for broadcasting "new ticket" notifications to all techs.
 */
export async function getAllCwMappedUserIds(): Promise<string[]> {
  const mappings = await prisma.userIntegrationMapping.findMany({
    where: { toolId: "connectwise" },
    select: { userId: true },
  });
  return mappings.map((m) => m.userId);
}

/**
 * Resolve the app userId of the CW member who triggered a webhook event.
 * Used to suppress self-notifications (don't notify a tech about their own actions).
 *
 * @param memberId - CW numeric member ID from the callback payload's MemberID field
 * @param cwMembers - Cached CW member list for ID → full member lookup
 */
export async function resolveActorUserId(
  memberId: number | undefined,
  cwMembers: Array<{ id: string; identifier: string; name: string; email: string }>
): Promise<string | null> {
  if (!memberId) return null;

  const memberIdStr = String(memberId);
  const member = cwMembers.find((m) => String(m.id) === memberIdStr);

  if (member) {
    return resolveTicketOwner(member.name, {
      memberId: member.id,
      memberIdentifier: member.identifier,
    });
  }

  // Fallback: try resolving the numeric ID directly
  return resolveTicketOwner("", { memberId: memberIdStr });
}

/**
 * Resolve ALL app userIds who should be notified about a ticket.
 * Checks both the owner and the resources field.
 *
 * CW tickets have an `owner` (single member) and `resources` (comma-separated
 * member identifiers like "Andrew, Dave, DylanE"). CW sends "assigned"
 * notifications to all resources, so we should too.
 *
 * @param cwMembers - Cached CW member list for identifier → full member lookup
 */
export async function resolveAllTicketRecipients(
  rawTicket: Record<string, any> | undefined,
  cwMembers: Array<{ id: string; identifier: string; name: string; email: string }>
): Promise<string[]> {
  const resolvedUserIds = new Set<string>();

  // 1. Resolve owner
  if (rawTicket?.owner) {
    const ownerLookup = {
      memberId: rawTicket.owner.id ? String(rawTicket.owner.id) : undefined,
      memberIdentifier: rawTicket.owner.identifier as string | undefined,
    };
    const ownerId = await resolveTicketOwner(
      rawTicket.owner.name ?? "",
      ownerLookup
    );
    if (ownerId) resolvedUserIds.add(ownerId);
  }

  // 2. Resolve resources (comma-separated CW member identifiers)
  const resourcesStr = rawTicket?.resources as string | undefined;
  if (resourcesStr) {
    const identifiers = resourcesStr.split(",").map((s) => s.trim()).filter(Boolean);
    for (const identifier of identifiers) {
      // Look up the CW member by identifier to get their full details
      const member = cwMembers.find(
        (m) => m.identifier.toLowerCase() === identifier.toLowerCase()
      );
      if (member) {
        const userId = await resolveTicketOwner(member.name, {
          memberId: member.id,
          memberIdentifier: member.identifier,
        });
        if (userId) resolvedUserIds.add(userId);
      } else {
        // Fallback: try resolving the identifier directly
        const userId = await resolveTicketOwner(identifier);
        if (userId) resolvedUserIds.add(userId);
      }
    }
  }

  return Array.from(resolvedUserIds);
}

/**
 * Detect what changed between old and new ticket state.
 * Returns an array of change types for notification routing.
 */
export function detectTicketChanges(
  prev: { status?: string; assignedTo?: string } | null,
  current: { status?: string; assignedTo?: string }
): { type: NotificationType; description: string }[] {
  const changes: { type: NotificationType; description: string }[] = [];

  if (!prev) {
    // No previous state cached — treat current values as changes so the
    // webhook handler's existing "ticket_assigned" / "ticket_status_changed"
    // handlers will fire instead of the unhandled "ticket_created" type.
    if (current.assignedTo) {
      changes.push({
        type: "ticket_assigned",
        description: `Assigned to ${current.assignedTo}`,
      });
    }
    return changes;
  }

  if (prev.status !== current.status) {
    changes.push({
      type: "ticket_status_changed",
      description: `Status: "${prev.status}" → "${current.status}"`,
    });
  }

  if (prev.assignedTo !== current.assignedTo && current.assignedTo) {
    changes.push({
      type: "ticket_assigned",
      description: `Assigned to ${current.assignedTo}`,
    });
  }

  return changes;
}

/**
 * Check if there's a new external note (client reply) on a ticket.
 * Compares latest note ID with cached value in Redis.
 */
export async function detectNewReply(
  ticketId: string,
  notes: Array<{ id: string; internal: boolean; createdBy?: string }>
): Promise<{ isNew: boolean; noteId?: string; createdBy?: string }> {
  const cacheKey = `cw:ticket:lastnote:${ticketId}`;
  const lastKnownNoteId = await redis.get(cacheKey);

  // Find the latest external (non-internal) note
  const externalNotes = notes.filter((n) => !n.internal);
  if (externalNotes.length === 0) {
    return { isNew: false };
  }

  const latestNote = externalNotes[externalNotes.length - 1];

  if (lastKnownNoteId !== latestNote.id) {
    // Cache the new latest note ID (TTL 24h)
    await redis.set(cacheKey, latestNote.id, "EX", 86400);

    if (lastKnownNoteId !== null) {
      // Only flag as "new" if we had a previous value (not first check)
      return { isNew: true, noteId: latestNote.id, createdBy: latestNote.createdBy };
    }
  }

  return { isNew: false };
}

/**
 * Cache a ticket's state in Redis for diff detection on next webhook.
 */
export async function cacheTicketState(
  ticketId: string,
  state: { status: string; assignedTo?: string }
) {
  const cacheKey = `cw:ticket:prev:${ticketId}`;
  await redis.set(cacheKey, JSON.stringify(state), "EX", 86400); // 24h TTL
}

/**
 * Get the cached previous ticket state from Redis.
 */
export async function getCachedTicketState(
  ticketId: string
): Promise<{ status: string; assignedTo?: string } | null> {
  const cacheKey = `cw:ticket:prev:${ticketId}`;
  const cached = await redis.get(cacheKey);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

/* ─── EMAIL VIA MICROSOFT GRAPH API ─────────────────────────── */

/**
 * Get an app-only access token for Microsoft Graph using client credentials flow.
 * Reuses the same Entra app registration (AZURE_AD_*) env vars.
 */
async function getGraphAppToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Entra ID SSO not configured. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET.");
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!tokenRes.ok) {
    throw new Error("Failed to get Microsoft Graph token. Check Entra app registration credentials.");
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

/**
 * Send an email via Microsoft Graph API using application permissions.
 *
 * Requires `Mail.Send` application permission with admin consent on the Entra app registration.
 * The senderEmail must be a valid mailbox in the tenant (shared mailbox, distribution group, or user).
 */
export async function sendEmailViaGraph(opts: {
  senderEmail: string;
  toRecipients: string[];
  subject: string;
  bodyHtml: string;
  ccRecipients?: string[];
  saveToSentItems?: boolean;
  /** Context for the email log: "test" | "alert" | "report" | "system" */
  trigger?: string;
  /** userId who initiated (null for automated sends) */
  triggeredBy?: string | null;
  /** Extra metadata to attach to the log entry */
  logMetadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getGraphAppToken();

    const message: Record<string, unknown> = {
      subject: opts.subject,
      body: { contentType: "HTML", content: opts.bodyHtml },
      toRecipients: opts.toRecipients.map((addr) => ({
        emailAddress: { address: addr },
      })),
    };

    if (opts.ccRecipients && opts.ccRecipients.length > 0) {
      message.ccRecipients = opts.ccRecipients.map((addr) => ({
        emailAddress: { address: addr },
      }));
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(opts.senderEmail)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          saveToSentItems: opts.saveToSentItems ?? false,
        }),
      }
    );

    // Strip HTML tags for body preview (first 500 chars)
    const bodyPreview = opts.bodyHtml.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 500);

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg: string;
      if (errText.includes("Authorization_RequestDenied") || errText.includes("MailboxNotEnabledForRESTAPI")) {
        errorMsg = "Missing Mail.Send permission or mailbox not accessible. Ensure Mail.Send (Application) is granted with admin consent in Azure Portal.";
      } else if (errText.includes("ResourceNotFound") || errText.includes("MailboxNotFound")) {
        errorMsg = `Mailbox "${opts.senderEmail}" not found. Ensure it's a valid mailbox, shared mailbox, or distribution group in your Microsoft 365 tenant.`;
      } else {
        errorMsg = `Graph API error ${res.status}: ${errText.substring(0, 300)}`;
      }

      // Log the failed send
      await logEmailSend(opts, bodyPreview, "failed", errorMsg);
      return { success: false, error: errorMsg };
    }

    // 202 Accepted = success (sendMail returns no body)
    await logEmailSend(opts, bodyPreview, "sent", undefined);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notification-engine] sendEmailViaGraph failed:", msg);
    // Log the error
    try {
      const bodyPreview = opts.bodyHtml.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 500);
      await logEmailSend(opts, bodyPreview, "failed", msg);
    } catch { /* don't let logging errors mask the real error */ }
    return { success: false, error: msg };
  }
}

/** Internal: write a row to EmailSendLog for every email attempt */
async function logEmailSend(
  opts: { senderEmail: string; toRecipients: string[]; subject: string; bodyHtml?: string; trigger?: string; triggeredBy?: string | null; logMetadata?: Record<string, unknown> },
  bodyPreview: string,
  status: "sent" | "failed",
  errorMessage: string | undefined,
) {
  try {
    // Log one row per recipient for easy querying
    for (const recipient of opts.toRecipients) {
      await prisma.emailSendLog.create({
        data: {
          senderEmail: opts.senderEmail,
          recipientEmail: recipient,
          subject: opts.subject,
          bodyPreview,
          bodyHtml: opts.bodyHtml || null,
          status,
          errorMessage: errorMessage || null,
          trigger: opts.trigger || "system",
          triggeredBy: opts.triggeredBy || null,
          metadata: (opts.logMetadata as Prisma.InputJsonValue) ?? undefined,
        },
      });
    }
  } catch (err) {
    console.error("[notification-engine] Failed to log email send:", err);
  }
}

/**
 * Dispatch an email notification for an alert to a specific user.
 * Looks up the user's email and the system email config to determine sender.
 */
export async function dispatchEmailNotification(
  userId: string,
  alert: { source: string; severity: string; title: string; description?: string; deviceHostname?: string; organizationName?: string }
) {
  try {
    // Get the user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) return;

    // Get the alert email config (e.g. alert_critical, alert_warning)
    const configType = alert.severity === "critical" ? "alert_critical" : alert.severity === "high" ? "alert_warning" : "alert_info";
    const config = await prisma.notificationConfig.findUnique({
      where: { type: configType },
    });

    // Need a sender — fall back to app-level sender if configured
    const sender = config?.emailSender;
    if (!sender) {
      console.warn("[notification-engine] No email sender configured for", configType);
      return;
    }

    const facts = [`Source: ${alert.source}`, `Severity: ${alert.severity.toUpperCase()}`];
    if (alert.deviceHostname) facts.push(`Device: ${alert.deviceHostname}`);
    if (alert.organizationName) facts.push(`Client: ${alert.organizationName}`);

    const severityColor = alert.severity === "critical" ? "#DC2626" : alert.severity === "high" ? "#EA580C" : "#EAB308";

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
        <div style="border-left: 4px solid ${severityColor}; padding: 12px 16px; background: #1a1a2e; border-radius: 4px;">
          <h2 style="margin: 0 0 8px; color: #f1f1f1; font-size: 16px;">[${alert.severity.toUpperCase()}] ${alert.title}</h2>
          ${alert.description ? `<p style="margin: 0 0 12px; color: #a0a0b0; font-size: 14px;">${alert.description}</p>` : ""}
          <table style="font-size: 13px; color: #c0c0d0;">
            ${facts.map((f) => `<tr><td style="padding: 2px 0;">${f}</td></tr>`).join("")}
          </table>
        </div>
        <p style="margin-top: 16px; font-size: 12px; color: #666;">
          This is an automated alert from REDiTECH Command Center.
        </p>
      </div>
    `;

    await sendEmailViaGraph({
      senderEmail: sender,
      toRecipients: [user.email],
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      bodyHtml,
      trigger: "alert",
      triggeredBy: null,
      logMetadata: { alertSource: alert.source, alertSeverity: alert.severity, userId },
    });
  } catch (err) {
    console.error(`[notification-engine] Email dispatch failed for user ${userId}:`, err);
  }
}

/* ─── ALERT NOTIFICATION HELPERS ─────────────────────────────── */

import { hasPermissions } from "./permissions";

const SOURCE_CATEGORY: Record<string, "security" | "monitoring" | "backup"> = {
  sentinelone: "security",
  blackpoint: "security",
  ninjaone: "monitoring",
  uptime: "monitoring",
  cove: "backup",
};

const ALERT_NOTIFICATION_TYPE: Record<string, NotificationType> = {
  security: "alert_security",
  monitoring: "alert_monitoring",
  backup: "alert_backup",
};

const DEFAULT_SEVERITIES = ["critical", "high"];
const DEFAULT_CHANNELS = ["push"];

/**
 * Check if an alert has already been seen (prevents duplicate notifications).
 */
export async function isAlertSeen(alertId: string): Promise<boolean> {
  const key = `alert:seen:${alertId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Mark an alert as seen so we don't notify again.
 */
export async function markAlertSeen(alertId: string): Promise<void> {
  const key = `alert:seen:${alertId}`;
  await redis.set(key, "1", "EX", 86400); // 24h TTL
}

/**
 * Get users who should be notified for a given alert.
 * 1. Checks permission: only users with `notifications.<source>` permission
 * 2. Checks UserNotificationPref: source enabled + severity in multi-select list
 * 3. Returns userIds + their chosen delivery channels
 */
export async function getUsersForAlert(
  source: string,
  severity: string
): Promise<{ userId: string; channels: string[] }[]> {
  const permKey = `notifications.${source}`;

  // Get all users + check permission in batch
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  if (allUsers.length === 0) return [];

  // Check permissions for all users at once
  const permResults = await Promise.all(
    allUsers.map(async (u) => {
      const perms = await hasPermissions(u.id, [permKey]);
      return { userId: u.id, allowed: perms[permKey] };
    })
  );

  const allowedUserIds = permResults
    .filter((p) => p.allowed)
    .map((p) => p.userId);

  if (allowedUserIds.length === 0) return [];

  // Get preferences for allowed users
  const prefs = await prisma.userNotificationPref.findMany({
    where: { source, userId: { in: allowedUserIds }, enabled: true },
  });

  const prefMap = new Map(prefs.map((p) => [p.userId, p]));
  const recipients: { userId: string; channels: string[] }[] = [];

  for (const uid of allowedUserIds) {
    const pref = prefMap.get(uid);
    if (pref) {
      // User has explicit preference — check if severity is in their multi-select list
      if (pref.severities.includes(severity)) {
        recipients.push({ userId: uid, channels: pref.channels });
      }
    } else {
      // No saved preference — use defaults (critical + high, push only)
      if (DEFAULT_SEVERITIES.includes(severity)) {
        recipients.push({ userId: uid, channels: DEFAULT_CHANNELS });
      }
    }
  }

  return recipients;
}

/**
 * Dispatch a notification to a Teams webhook channel.
 */
async function dispatchTeamsNotification(
  channelId: string,
  alert: { source: string; severity: string; title: string; description?: string; deviceHostname?: string; organizationName?: string }
) {
  try {
    const channel = await prisma.notificationChannel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.enabled || channel.type !== "teams") return;
    const config = channel.config as { webhookUrl?: string };
    if (!config.webhookUrl) return;

    const facts = [
      { name: "Source", value: alert.source },
      { name: "Severity", value: alert.severity.toUpperCase() },
    ];
    if (alert.deviceHostname) facts.push({ name: "Device", value: alert.deviceHostname });
    if (alert.organizationName) facts.push({ name: "Client", value: alert.organizationName });

    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: alert.severity === "critical" ? "DC2626" : alert.severity === "high" ? "EA580C" : "EAB308",
        summary: alert.title,
        sections: [{
          activityTitle: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          activitySubtitle: alert.description,
          facts,
        }],
      }),
    });
  } catch (err) {
    console.error(`[notification-engine] Teams dispatch failed for channel ${channelId}:`, err);
  }
}

/**
 * Create alert notifications for all qualifying users.
 * Called by the alert-check cron job when new alerts are detected.
 *
 * Always creates in-app notification (bell icon). Additionally dispatches
 * to per-user selected channels (Teams, email, etc.).
 */
export async function notifyUsersForAlert(alert: {
  id: string;
  source: string;
  severity: string;
  title: string;
  description?: string;
  deviceHostname?: string;
  organizationName?: string;
}): Promise<number> {
  // Skip if already notified for this alert
  if (await isAlertSeen(alert.id)) {
    return 0;
  }

  const recipients = await getUsersForAlert(alert.source, alert.severity);
  if (recipients.length === 0) {
    await markAlertSeen(alert.id);
    return 0;
  }

  const category = SOURCE_CATEGORY[alert.source] ?? "monitoring";
  const notifType = ALERT_NOTIFICATION_TYPE[category] ?? "alert_monitoring";

  const bodyParts = [alert.description, alert.deviceHostname, alert.organizationName]
    .filter(Boolean)
    .join(" · ");

  // Create in-app notifications + dispatch to channels for each user
  await Promise.all(
    recipients.map(async ({ userId, channels }) => {
      // Always create in-app notification (push handled via SSE/Redis Pub/Sub)
      await createNotification({
        userId,
        type: notifType,
        title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        body: bodyParts || undefined,
        linkUrl: "/alerts",
        sourceType: `${alert.source}_alert`,
        sourceId: alert.id,
        metadata: {
          source: alert.source,
          severity: alert.severity,
          deviceHostname: alert.deviceHostname,
          organizationName: alert.organizationName,
        },
      });

      // Dispatch to additional channels
      for (const ch of channels) {
        if (ch === "push") continue; // push handled by SSE/Redis Pub/Sub above
        if (ch === "email") {
          await dispatchEmailNotification(userId, alert);
          continue;
        }
        if (ch.startsWith("teams:")) {
          const channelId = ch.substring(6);
          await dispatchTeamsNotification(channelId, alert);
        }
        // future: sms
      }
    })
  );

  await markAlertSeen(alert.id);
  return recipients.length;
}
