import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { sendEmailViaGraph } from "@/lib/notification-engine";

// Static registry of notification types — mirrors TOOL_REGISTRY pattern
const NOTIFICATION_TYPES = [
  // Alerts
  { type: "alert_critical",    displayName: "Critical Alerts",          description: "P1/P2 alerts requiring immediate attention",          group: "alerts",  defaultSender: "alerts@" },
  { type: "alert_warning",     displayName: "Warning Alerts",           description: "P3 warnings and degraded service notices",           group: "alerts",  defaultSender: "alerts@" },
  { type: "alert_info",        displayName: "Info Notifications",       description: "Informational alerts and status updates",            group: "alerts",  defaultSender: "noc@" },

  // Tickets
  { type: "ticket_created",    displayName: "Ticket Created",           description: "Notification when a new ticket is created",          group: "tickets", defaultSender: "noc@" },
  { type: "ticket_escalated",  displayName: "Ticket Escalated",         description: "Notification when a ticket is escalated",            group: "tickets", defaultSender: "alerts@" },

  // Reports & System
  { type: "report_daily",      displayName: "Daily Report",             description: "Daily operations summary delivered each morning",    group: "reports", defaultSender: "reports@" },
  { type: "report_weekly",     displayName: "Weekly Report",            description: "Weekly metrics and trend analysis",                  group: "reports", defaultSender: "reports@" },
  { type: "report_qbr",        displayName: "QBR Report",              description: "Quarterly business review report generation",        group: "reports", defaultSender: "reports@" },
  { type: "system_health",     displayName: "System Health",            description: "Platform health and integration status alerts",      group: "system",  defaultSender: "noc@" },
  { type: "voicemail",         displayName: "Voicemail Transcription",  description: "Transcribed voicemail notification to on-call tech", group: "system",  defaultSender: "noc@" },
];

export const notificationRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const configs = await ctx.prisma.notificationConfig.findMany();
    return NOTIFICATION_TYPES.map((nt) => {
      const config = configs.find((c) => c.type === nt.type);
      return {
        ...nt,
        emailEnabled: config?.emailEnabled ?? false,
        emailSender: config?.emailSender ?? "",
        emailRecipients: config?.emailRecipients ?? [],
        teamsEnabled: config?.teamsEnabled ?? false,
        teamsWebhookUrl: config?.teamsWebhookUrl ?? "",
        smsEnabled: config?.smsEnabled ?? false,
        smsRecipients: config?.smsRecipients ?? [],
        configured: !!(config?.emailEnabled || config?.teamsEnabled),
        id: config?.id ?? null,
      };
    });
  }),

  update: adminProcedure
    .input(z.object({
      type: z.string(),
      emailEnabled: z.boolean(),
      emailSender: z.string().max(500).optional(),
      emailRecipients: z.array(z.string()).optional(),
      teamsEnabled: z.boolean(),
      teamsWebhookUrl: z.string().max(1000).optional(),
      smsEnabled: z.boolean(),
      smsRecipients: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const nt = NOTIFICATION_TYPES.find((n) => n.type === input.type);
      if (!nt) throw new Error("Unknown notification type");

      const result = await ctx.prisma.notificationConfig.upsert({
        where: { type: input.type },
        update: {
          emailEnabled: input.emailEnabled,
          emailSender: input.emailSender || null,
          emailRecipients: input.emailRecipients || [],
          teamsEnabled: input.teamsEnabled,
          teamsWebhookUrl: input.teamsWebhookUrl || null,
          smsEnabled: input.smsEnabled,
          smsRecipients: input.smsRecipients || [],
          updatedBy: ctx.user.id,
        },
        create: {
          type: input.type,
          displayName: nt.displayName,
          description: nt.description,
          emailEnabled: input.emailEnabled,
          emailSender: input.emailSender || null,
          emailRecipients: input.emailRecipients || [],
          teamsEnabled: input.teamsEnabled,
          teamsWebhookUrl: input.teamsWebhookUrl || null,
          smsEnabled: input.smsEnabled,
          smsRecipients: input.smsRecipients || [],
          updatedBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "notification.config.updated",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: "notification:" + input.type,
        detail: {
          type: input.type,
          emailEnabled: input.emailEnabled,
          teamsEnabled: input.teamsEnabled,
          smsEnabled: input.smsEnabled,
        },
      });

      return result;
    }),

  test: adminProcedure
    .input(z.object({ type: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nt = NOTIFICATION_TYPES.find((n) => n.type === input.type);
      if (!nt) throw new Error("Unknown notification type");

      await auditLog({
        action: "notification.test.sent",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: "notification:" + input.type,
        detail: { type: input.type },
      });

      return { success: true, message: `Test notification placeholder for ${nt.displayName}` };
    }),

  // ─── Email Test via Microsoft Graph ───────────────────────
  sendTestEmail: adminProcedure
    .input(z.object({
      senderEmail: z.string().email("Invalid sender email address"),
      recipientEmail: z.string().email("Invalid recipient email address"),
      subject: z.string().max(500).optional(),
      body: z.string().max(5000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const subject = input.subject || "RCC Email Test";
      const bodyHtml = input.body
        ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${input.body.replace(/\n/g, "<br/>")}</div>`
        : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
          <div style="border-left: 4px solid #3B82F6; padding: 12px 16px; background: #1a1a2e; border-radius: 4px;">
            <h2 style="margin: 0 0 8px; color: #f1f1f1; font-size: 16px;">REDiTECH Command Center — Email Test</h2>
            <p style="margin: 0 0 8px; color: #a0a0b0; font-size: 14px;">
              This is a test email sent from REDiTECH Command Center via Microsoft Graph API.
            </p>
            <table style="font-size: 13px; color: #c0c0d0;">
              <tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Sender:</td><td>${input.senderEmail}</td></tr>
              <tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Recipient:</td><td>${input.recipientEmail}</td></tr>
              <tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Sent by:</td><td>${ctx.user.name || ctx.user.email}</td></tr>
              <tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Time:</td><td>${new Date().toISOString()}</td></tr>
            </table>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #666;">
            If you received this email, your Microsoft Graph Mail.Send permission is working correctly.
          </p>
        </div>
      `;

      const result = await sendEmailViaGraph({
        senderEmail: input.senderEmail,
        toRecipients: [input.recipientEmail],
        subject,
        bodyHtml,
        trigger: "test",
        triggeredBy: ctx.user.id,
      });

      await auditLog({
        action: "notification.email.test",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: `email:${input.senderEmail}`,
        detail: {
          senderEmail: input.senderEmail,
          recipientEmail: input.recipientEmail,
          success: result.success,
          error: result.error,
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send test email");
      }

      return { success: true, message: `Test email sent from ${input.senderEmail} to ${input.recipientEmail}` };
    }),

  // ─── Email Send Log ─────────────────────────────────────────
  emailLogs: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.prisma.emailSendLog.findMany({
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (logs.length > input.limit) {
        const next = logs.pop();
        nextCursor = next?.id;
      }

      return { logs, nextCursor };
    }),
});
