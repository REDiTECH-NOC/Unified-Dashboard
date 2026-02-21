import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";

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
});
