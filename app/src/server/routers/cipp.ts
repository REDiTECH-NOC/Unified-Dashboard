/**
 * CIPP Router — tRPC procedures for the full CIPP (CyberDrain Improved Partner Portal) API.
 *
 * Uses CIPPConnector via ConnectorFactory.getByToolId("cipp").
 * All write operations are audit-logged.
 *
 * Permission model:
 *   - Read queries: protectedProcedure (any authenticated user with cipp.view)
 *   - Write operations (user CRUD, groups, offboard, mailbox): cipp.manage
 *   - Security operations (alerts, incidents, device actions, LAPS, risky users): cipp.security
 *
 * Categories: tenants, users, mfa, groups, sign-ins, offboarding, security,
 *             intune, teams/sharepoint, platform, graph-api, health
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { CIPPConnector } from "../connectors/cipp/connector";
import { auditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

/** Get the CIPP connector instance (always by toolId, not category) */
async function getCIPP(prisma: Parameters<typeof ConnectorFactory.getByToolId>[1]) {
  return ConnectorFactory.getByToolId("cipp", prisma) as Promise<CIPPConnector>;
}

/** Check permission and throw FORBIDDEN if denied */
async function requirePermission(userId: string, permission: string) {
  const allowed = await hasPermission(userId, permission);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Missing permission: ${permission}`,
    });
  }
}

export const cippRouter = router({
  // =========================================================================
  // Tenant Administration
  // =========================================================================

  listTenants: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listTenants();
  }),

  listAlerts: protectedProcedure
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAlerts(input.tenantFilter);
    }),

  listLicenses: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listLicenses(input.tenantFilter);
    }),

  listCSPLicenses: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listCSPLicenses();
  }),

  listCSPSkus: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listCSPSkus();
  }),

  listAuditLogs: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAuditLogs(input.tenantFilter, input.startDate, input.endDate);
    }),

  listBackups: protectedProcedure
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listBackups(input.tenantFilter);
    }),

  listGDAPRoles: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listGDAPRoles();
  }),

  listGDAPRoleTemplates: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listGDAPRoleTemplates();
  }),

  // =========================================================================
  // Identity Management — Users
  // =========================================================================

  listUsers: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        select: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUsers(input.tenantFilter, input.select);
    }),

  addUser: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        displayName: z.string(),
        givenName: z.string().optional(),
        surname: z.string().optional(),
        mailNickname: z.string().optional(),
        userPrincipalName: z.string().optional(),
        primDomain: z.string().optional(),
        usageLocation: z.string().optional(),
        password: z.string().optional(),
        autoPassword: z.boolean().optional(),
        mustChangePass: z.boolean().optional(),
        licenses: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addUser(input);
      await auditLog({
        action: "cipp.user.create",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.displayName}`,
        detail: { displayName: input.displayName, tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  removeUser: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeUser(input.tenantFilter, input.userId);
      await auditLog({
        action: "cipp.user.remove",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
      });
      return result;
    }),

  disableUser: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        enable: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.disableUser(input.tenantFilter, input.userId, input.enable);
      await auditLog({
        action: input.enable ? "cipp.user.enable" : "cipp.user.disable",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId, enable: input.enable },
      });
      return result;
    }),

  resetPassword: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        mustChange: z.boolean().default(true),
        displayName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.resetPassword(
        input.tenantFilter,
        input.userId,
        input.mustChange,
        input.displayName
      );
      await auditLog({
        action: "cipp.user.resetPassword",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
      });
      return result;
    }),

  revokeSessions: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        username: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.revokeSessions(input.tenantFilter, input.userId, input.username);
      await auditLog({
        action: "cipp.user.revokeSessions",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
      });
      return result;
    }),

  clearImmutableId: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.clearImmutableId(input.tenantFilter, input.userId);
      await auditLog({
        action: "cipp.user.clearImmutableId",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — MFA
  // =========================================================================

  listMFAUsers: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMFAUsers(input.tenantFilter);
    }),

  resetMFA: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.resetMFA(input.tenantFilter, input.userId);
      await auditLog({
        action: "cipp.mfa.reset",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
      });
      return result;
    }),

  createTAP: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.createTAP(input.tenantFilter, input.userId);
      await auditLog({
        action: "cipp.mfa.createTAP",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
      });
      return result;
    }),

  setPerUserMFA: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        state: z.enum(["Enforced", "Enabled", "Disabled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.setPerUserMFA(input.tenantFilter, input.userId, input.state);
      await auditLog({
        action: "cipp.mfa.setPerUser",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { tenantFilter: input.tenantFilter, userId: input.userId, state: input.state },
      });
      return result;
    }),

  sendPushNotification: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userEmail: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.sendPushNotification(input.tenantFilter, input.userEmail);
      await auditLog({
        action: "cipp.mfa.sendPush",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userEmail}`,
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — Groups
  // =========================================================================

  listGroups: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        groupId: z.string().optional(),
        members: z.boolean().optional(),
        owners: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listGroups(input.tenantFilter, {
        groupId: input.groupId,
        members: input.members,
        owners: input.owners,
      });
    }),

  addGroup: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        displayName: z.string(),
        description: z.string().optional(),
        groupType: z.string(),
        mailEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addGroup(input);
      await auditLog({
        action: "cipp.group.create",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/group:${input.displayName}`,
        detail: { displayName: input.displayName, groupType: input.groupType },
      });
      return result;
    }),

  editGroup: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        groupId: z.string(),
        AddMember: z.string().optional(),
        RemoveMember: z.string().optional(),
        AddOwner: z.string().optional(),
        RemoveOwner: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const { tenantFilter, ...editInput } = input;
      const result = await cipp.editGroup(tenantFilter, editInput);
      await auditLog({
        action: "cipp.group.edit",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${tenantFilter}/group:${input.groupId}`,
        detail: { groupId: input.groupId, changes: editInput },
      });
      return result;
    }),

  deleteGroup: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        groupId: z.string(),
        groupType: z.string(),
        displayName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.deleteGroup(
        input.tenantFilter,
        input.groupId,
        input.groupType,
        input.displayName
      );
      await auditLog({
        action: "cipp.group.delete",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/group:${input.groupId}`,
        detail: { displayName: input.displayName, groupType: input.groupType },
      });
      return result;
    }),

  hideGroupFromGAL: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        groupId: z.string(),
        groupType: z.string(),
        hide: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.hideGroupFromGAL(
        input.tenantFilter,
        input.groupId,
        input.groupType,
        input.hide
      );
      await auditLog({
        action: input.hide ? "cipp.group.hideFromGAL" : "cipp.group.showInGAL",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/group:${input.groupId}`,
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — Sign-ins & Audit
  // =========================================================================

  listSignIns: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        filter: z.string().optional(),
        failedOnly: z.boolean().optional(),
        failureThreshold: z.number().optional(),
        days: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSignIns(input.tenantFilter, {
        filter: input.filter,
        failedOnly: input.failedOnly,
        failureThreshold: input.failureThreshold,
        days: input.days,
      });
    }),

  listInactiveAccounts: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listInactiveAccounts(input.tenantFilter);
    }),

  listRoles: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listRoles(input.tenantFilter);
    }),

  listAzureADConnectStatus: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAzureADConnectStatus(input.tenantFilter);
    }),

  // =========================================================================
  // Identity Management — Offboarding & Mailbox
  // =========================================================================

  execOffboardUser: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        convertToShared: z.boolean().optional(),
        removeFromGroups: z.boolean().optional(),
        hideFromGAL: z.boolean().optional(),
        disableUser: z.boolean().optional(),
        revokeAccess: z.boolean().optional(),
        forwardTo: z.string().optional(),
        oooMessage: z.string().optional(),
        removelicenses: z.boolean().optional(),
        removeMobileDevices: z.boolean().optional(),
        removeRules: z.boolean().optional(),
        keepCopy: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const { tenantFilter, userId, ...options } = input;
      const result = await cipp.execOffboardUser(tenantFilter, userId, options);
      await auditLog({
        action: "cipp.user.offboard",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${tenantFilter}/user:${userId}`,
        detail: { tenantFilter, userId, options },
      });
      return result;
    }),

  convertMailbox: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        mailboxType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.convertMailbox(input.tenantFilter, input.userId, input.mailboxType);
      await auditLog({
        action: "cipp.mailbox.convert",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { mailboxType: input.mailboxType },
      });
      return result;
    }),

  enableArchive: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.enableArchive(input.tenantFilter, input.userId);
      await auditLog({
        action: "cipp.mailbox.enableArchive",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
      });
      return result;
    }),

  setOutOfOffice: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        state: z.string(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.setOutOfOffice(
        input.tenantFilter,
        input.userId,
        input.state,
        input.message
      );
      await auditLog({
        action: "cipp.mailbox.setOoO",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { state: input.state },
      });
      return result;
    }),

  setEmailForward: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        forwardOption: z.string(),
        forwardTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.setEmailForward(
        input.tenantFilter,
        input.userId,
        input.forwardOption,
        input.forwardTo
      );
      await auditLog({
        action: "cipp.mailbox.setForward",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { forwardOption: input.forwardOption, forwardTo: input.forwardTo },
      });
      return result;
    }),

  provisionOneDrive: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), upn: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.provisionOneDrive(input.tenantFilter, input.upn);
      await auditLog({
        action: "cipp.onedrive.provision",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.upn}`,
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — Devices & Security
  // =========================================================================

  execDeviceAction: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        deviceId: z.string(),
        action: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execDeviceAction(input.tenantFilter, input.deviceId, input.action);
      await auditLog({
        action: `cipp.device.${input.action}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/device:${input.deviceId}`,
        detail: { deviceAction: input.action },
      });
      return result;
    }),

  getRecoveryKey: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), guid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.getRecoveryKey(input.tenantFilter, input.guid);
      await auditLog({
        action: "cipp.device.getRecoveryKey",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/device:${input.guid}`,
      });
      return result;
    }),

  dismissRiskyUser: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        userId: z.string(),
        displayName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.dismissRiskyUser(
        input.tenantFilter,
        input.userId,
        input.displayName
      );
      await auditLog({
        action: "cipp.security.dismissRiskyUser",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { displayName: input.displayName },
      });
      return result;
    }),

  listDeletedItems: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDeletedItems(input.tenantFilter);
    }),

  restoreDeleted: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.restoreDeleted(input.tenantFilter, input.itemId);
      await auditLog({
        action: "cipp.deletedItem.restore",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/item:${input.itemId}`,
      });
      return result;
    }),

  // =========================================================================
  // Security & Compliance
  // =========================================================================

  listDefenderState: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDefenderState(input.tenantFilter);
    }),

  listDefenderTVM: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDefenderTVM(input.tenantFilter);
    }),

  listSecurityAlerts: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSecurityAlerts(input.tenantFilter);
    }),

  setSecurityAlert: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        alertId: z.string(),
        status: z.string(),
        vendor: z.string().optional(),
        provider: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.setSecurityAlert(
        input.tenantFilter,
        input.alertId,
        input.status,
        input.vendor,
        input.provider
      );
      await auditLog({
        action: "cipp.security.setAlert",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/alert:${input.alertId}`,
        detail: { status: input.status },
      });
      return result;
    }),

  listSecurityIncidents: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSecurityIncidents(input.tenantFilter);
    }),

  setSecurityIncident: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        incidentId: z.string(),
        status: z.string(),
        assignedTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.setSecurityIncident(
        input.tenantFilter,
        input.incidentId,
        input.status,
        input.assignedTo
      );
      await auditLog({
        action: "cipp.security.setIncident",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/incident:${input.incidentId}`,
        detail: { status: input.status, assignedTo: input.assignedTo },
      });
      return result;
    }),

  // =========================================================================
  // Intune
  // =========================================================================

  listIntuneDevices: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listIntuneDevices(input.tenantFilter);
    }),

  intuneDeviceAction: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        deviceId: z.string(),
        action: z.string(),
        newDeviceName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.intuneDeviceAction(
        input.tenantFilter,
        input.deviceId,
        input.action,
        input.newDeviceName
      );
      await auditLog({
        action: `cipp.intune.device.${input.action}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/device:${input.deviceId}`,
        detail: { deviceAction: input.action, newDeviceName: input.newDeviceName },
      });
      return result;
    }),

  getLocalAdminPassword: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.getLocalAdminPassword(input.tenantFilter, input.deviceId);
      await auditLog({
        action: "cipp.intune.getLAPS",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/device:${input.deviceId}`,
      });
      return result;
    }),

  getDeviceRecoveryKey: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.getDeviceRecoveryKey(input.tenantFilter, input.deviceId);
      await auditLog({
        action: "cipp.intune.getRecoveryKey",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/device:${input.deviceId}`,
      });
      return result;
    }),

  listAPDevices: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAPDevices(input.tenantFilter);
    }),

  listIntuneApps: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listIntuneApps(input.tenantFilter);
    }),

  listIntunePolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listIntunePolicy(input.tenantFilter);
    }),

  syncAPDevices: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.syncAPDevices(input.tenantFilter);
      await auditLog({
        action: "cipp.intune.syncAPDevices",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
      });
      return result;
    }),

  // =========================================================================
  // Teams & SharePoint
  // =========================================================================

  listTeams: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeams(input.tenantFilter);
    }),

  listTeamsActivity: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeamsActivity(input.tenantFilter);
    }),

  listTeamsVoice: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeamsVoice(input.tenantFilter);
    }),

  listSites: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        type: z.enum(["SharePointSiteUsage", "OneDriveUsageAccount"]).default("SharePointSiteUsage"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSites(input.tenantFilter, input.type);
    }),

  // =========================================================================
  // CIPP Platform
  // =========================================================================

  listScheduledItems: protectedProcedure
    .input(z.object({ showHidden: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listScheduledItems(input.showHidden);
    }),

  removeScheduledItem: protectedProcedure
    .input(z.object({ rowKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeScheduledItem(input.rowKey);
      await auditLog({
        action: "cipp.scheduledItem.remove",
        category: "API",
        actorId: ctx.user.id,
        resource: `scheduledItem:${input.rowKey}`,
      });
      return result;
    }),

  listLogs: protectedProcedure
    .input(
      z.object({
        dateFilter: z.string().optional(),
        severity: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listLogs(input.dateFilter, input.severity);
    }),

  listExtensionsConfig: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listExtensionsConfig();
  }),

  // =========================================================================
  // Graph API (pass-through)
  // =========================================================================

  graphRequest: protectedProcedure
    .input(
      z.object({
        tenantFilter: z.string(),
        endpoint: z.string(),
        $select: z.string().optional(),
        $filter: z.string().optional(),
        $top: z.number().optional(),
        $orderby: z.string().optional(),
        $count: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      const { tenantFilter, endpoint, ...options } = input;
      return cipp.graphRequest(tenantFilter, endpoint, options);
    }),

  // =========================================================================
  // Health Check
  // =========================================================================

  healthCheck: protectedProcedure.query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.healthCheck();
  }),
});
