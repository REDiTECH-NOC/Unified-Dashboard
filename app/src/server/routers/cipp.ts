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
import { router, protectedProcedure, requirePerm } from "../trpc";
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

  listTenants: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listTenants();
  }),

  listAlerts: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAlerts(input.tenantFilter);
    }),

  listLicenses: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listLicenses(input.tenantFilter);
    }),

  listCSPLicenses: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listCSPLicenses();
  }),

  listCSPSkus: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listCSPSkus();
  }),

  listAuditLogs: requirePerm("cipp.view")
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

  listTenantDetails: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTenantDetails(input.tenantFilter);
    }),

  listDomains: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDomains(input.tenantFilter);
    }),

  listPartnerRelationships: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listPartnerRelationships(input.tenantFilter);
    }),

  listTenantOnboarding: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listTenantOnboarding();
  }),

  listExternalTenantInfo: requirePerm("cipp.view")
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listExternalTenantInfo(input.tenantId);
    }),

  editTenant: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.editTenant(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.tenant.edit",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { tenantFilter: input.tenantFilter, fields: Object.keys(input.data) },
      });
      return result;
    }),

  listBackups: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listBackups(input.tenantFilter);
    }),

  execRunBackup: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execRunBackup(input.tenantFilter);
      await auditLog({
        action: "cipp.backup.run",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  listGDAPRoles: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listGDAPRoles();
  }),

  listGDAPRoleTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listGDAPRoleTemplates();
  }),

  // =========================================================================
  // Identity Management — Users
  // =========================================================================

  listUsers: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
      });
      return result;
    }),

  editUser: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.editUser(input.tenantFilter, input.userId, input.data);
      await auditLog({
        action: "cipp.user.edit",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { fields: Object.keys(input.data) },
      });
      return result;
    }),

  listUserCounts: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserCounts(input.tenantFilter);
    }),

  listUserSigninLogs: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserSigninLogs(input.tenantFilter, input.userId);
    }),

  listUserDevices: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserDevices(input.tenantFilter, input.userId);
    }),

  listUserGroups: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserGroups(input.tenantFilter, input.userId);
    }),

  listUserMailboxDetails: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserMailboxDetails(input.tenantFilter, input.userId);
    }),

  listUserMailboxRules: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserMailboxRules(input.tenantFilter, input.userId);
    }),

  listUserConditionalAccessPolicies: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserConditionalAccessPolicies(input.tenantFilter, input.userId);
    }),

  listUserPhoto: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listUserPhoto(input.tenantFilter, input.userId);
    }),

  execUniversalSearch: requirePerm("cipp.view")
    .input(z.object({ searchString: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.execUniversalSearch(input.searchString);
    }),

  execBECCheck: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      return cipp.execBECCheck(input.tenantFilter, input.userId);
    }),

  execBECRemediate: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), options: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execBECRemediate(input.tenantFilter, input.userId, input.options);
      await auditLog({
        action: "cipp.security.becRemediate",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { options: Object.keys(input.options) },
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — MFA
  // =========================================================================

  listMFAUsers: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter, userEmail: input.userEmail },
      });
      return result;
    }),

  listMFAUsersAllTenants: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listMFAUsersAllTenants();
  }),

  listPerUserMFA: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listPerUserMFA(input.tenantFilter);
    }),

  listBasicAuth: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listBasicAuth(input.tenantFilter);
    }),

  listSharedMailboxAccountEnabled: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSharedMailboxAccountEnabled(input.tenantFilter);
    }),

  execExcludeLicenses: protectedProcedure
    .input(z.object({ licenses: z.array(z.object({ GUID: z.string(), SKUName: z.string() })) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execExcludeLicenses(input.licenses);
      await auditLog({
        action: "cipp.license.exclude",
        category: "API",
        actorId: ctx.user.id,
        detail: { count: input.licenses.length },
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — Groups
  // =========================================================================

  listGroups: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter, groupId: input.groupId, hide: input.hide },
      });
      return result;
    }),

  listGroupTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listGroupTemplates();
  }),

  addGroupTemplate: protectedProcedure
    .input(z.object({ template: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addGroupTemplate(input.template);
      await auditLog({
        action: "cipp.groupTemplate.add",
        category: "API",
        actorId: ctx.user.id,
        detail: { template: input.template },
      });
      return result;
    }),

  removeGroupTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeGroupTemplate(input.id);
      await auditLog({
        action: "cipp.groupTemplate.remove",
        category: "API",
        actorId: ctx.user.id,
        detail: { templateId: input.id },
      });
      return result;
    }),

  execGroupsDeliveryManagement: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), groupId: z.string(), options: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execGroupsDeliveryManagement(input.tenantFilter, input.groupId, input.options);
      await auditLog({
        action: "cipp.group.deliveryManagement",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/group:${input.groupId}`,
        detail: { options: Object.keys(input.options) },
      });
      return result;
    }),

  // =========================================================================
  // Identity Management — Sign-ins & Audit
  // =========================================================================

  listSignIns: requirePerm("cipp.view")
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

  listInactiveAccounts: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listInactiveAccounts(input.tenantFilter);
    }),

  listRoles: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listRoles(input.tenantFilter);
    }),

  listAzureADConnectStatus: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter, userId: input.userId },
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
        detail: { tenantFilter: input.tenantFilter, upn: input.upn },
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
        detail: { tenantFilter: input.tenantFilter, deviceGuid: input.guid },
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

  listDeletedItems: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter, itemId: input.itemId },
      });
      return result;
    }),

  // =========================================================================
  // Security & Compliance
  // =========================================================================

  listDefenderState: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDefenderState(input.tenantFilter);
    }),

  listDefenderTVM: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDefenderTVM(input.tenantFilter);
    }),

  listSecurityAlerts: requirePerm("cipp.view")
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

  listSecurityIncidents: requirePerm("cipp.view")
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

  addDefenderDeployment: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), options: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addDefenderDeployment(input.tenantFilter, input.options);
      await auditLog({
        action: "cipp.security.addDefenderDeployment",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { options: Object.keys(input.options) },
      });
      return result;
    }),

  getCippAlerts: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.getCippAlerts();
  }),

  removeQueuedAlert: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeQueuedAlert(input.id);
      await auditLog({
        action: "cipp.alert.remove",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { alertId: input.id },
      });
      return result;
    }),

  addAlert: protectedProcedure
    .input(z.object({ alert: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addAlert(input.alert);
      await auditLog({
        action: "cipp.alert.add",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { alert: input.alert },
      });
      return result;
    }),

  execBreachSearch: requirePerm("cipp.view")
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.execBreachSearch(input.domain);
    }),

  listBreachesTenant: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listBreachesTenant(input.tenantFilter);
    }),

  listBreachesAccount: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), account: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listBreachesAccount(input.tenantFilter, input.account);
    }),

  listPhishPolicies: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listPhishPolicies(input.tenantFilter);
    }),

  listSafeLinkFilter: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSafeLinkFilter(input.tenantFilter);
    }),

  listSafeAttachmentFilter: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSafeAttachmentFilter(input.tenantFilter);
    }),

  // =========================================================================
  // Conditional Access
  // =========================================================================

  listConditionalAccessPolicies: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listConditionalAccessPolicies(input.tenantFilter);
    }),

  listCATemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listCATemplates();
  }),

  listNamedLocations: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listNamedLocations(input.tenantFilter);
    }),

  addCAPolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), policy: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addCAPolicy(input.tenantFilter, input.policy);
      await auditLog({
        action: "cipp.ca.addPolicy",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { policy: input.policy },
      });
      return result;
    }),

  addCATemplate: protectedProcedure
    .input(z.object({ template: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addCATemplate(input.template);
      await auditLog({
        action: "cipp.ca.addTemplate",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { template: input.template },
      });
      return result;
    }),

  editCAPolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), policyId: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.editCAPolicy(input.tenantFilter, input.policyId, input.data);
      await auditLog({
        action: "cipp.ca.editPolicy",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/ca:${input.policyId}`,
        detail: { fields: Object.keys(input.data) },
      });
      return result;
    }),

  removeCAPolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), policyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeCAPolicy(input.tenantFilter, input.policyId);
      await auditLog({
        action: "cipp.ca.removePolicy",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/ca:${input.policyId}`,
        detail: { policyId: input.policyId },
      });
      return result;
    }),

  removeCATemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeCATemplate(input.id);
      await auditLog({
        action: "cipp.ca.removeTemplate",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { templateId: input.id },
      });
      return result;
    }),

  addNamedLocation: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), location: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addNamedLocation(input.tenantFilter, input.location);
      await auditLog({
        action: "cipp.ca.addNamedLocation",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { location: input.location },
      });
      return result;
    }),

  // =========================================================================
  // Standards & BPA
  // =========================================================================

  listStandards: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listStandards();
  }),

  bestPracticeAnalyserList: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.bestPracticeAnalyserList(input.tenantFilter);
    }),

  listTenantAlignment: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTenantAlignment(input.tenantFilter);
    }),

  listTenantDrift: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTenantDrift(input.tenantFilter);
    }),

  listDomainHealth: requirePerm("cipp.view")
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDomainHealth(input.domain);
    }),

  domainAnalyserList: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.domainAnalyserList(input.tenantFilter);
    }),

  execSetStandardsRun: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execSetStandardsRun(input.tenantFilter);
      await auditLog({
        action: "cipp.standards.run",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  removeStandard: protectedProcedure
    .input(z.object({ policyName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeStandard(input.policyName);
      await auditLog({
        action: "cipp.standards.remove",
        category: "API",
        actorId: ctx.user.id,
        detail: { policyName: input.policyName },
      });
      return result;
    }),

  listStandardTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listStandardTemplates();
  }),

  removeStandardTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeStandardTemplate(input.id);
      await auditLog({
        action: "cipp.standardTemplate.remove",
        category: "API",
        actorId: ctx.user.id,
        detail: { templateId: input.id },
      });
      return result;
    }),

  listBPATemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listBPATemplates();
  }),

  removeBPATemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeBPATemplate(input.id);
      await auditLog({
        action: "cipp.bpaTemplate.remove",
        category: "API",
        actorId: ctx.user.id,
        detail: { templateId: input.id },
      });
      return result;
    }),

  // =========================================================================
  // Email & Exchange
  // =========================================================================

  listMailboxes: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxes(input.tenantFilter);
    }),

  listMailboxStatistics: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxStatistics(input.tenantFilter);
    }),

  listSharedMailboxStatistics: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSharedMailboxStatistics(input.tenantFilter);
    }),

  listMailboxCAS: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxCAS(input.tenantFilter);
    }),

  listMailboxPermissions: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxPermissions(input.tenantFilter, input.userId);
    }),

  listMailboxRules: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxRules(input.tenantFilter, input.userId);
    }),

  listCalendarPermissions: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listCalendarPermissions(input.tenantFilter, input.userId);
    }),

  listOutOfOffice: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listOutOfOffice(input.tenantFilter, input.userId);
    }),

  addSharedMailbox: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addSharedMailbox(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.mailbox.addShared",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  execHideFromGAL: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), hide: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execHideFromGAL(input.tenantFilter, input.userId, input.hide);
      await auditLog({
        action: input.hide ? "cipp.mailbox.hideFromGAL" : "cipp.mailbox.showInGAL",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { hide: input.hide },
      });
      return result;
    }),

  execCopyForSent: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), messageAction: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execCopyForSent(input.tenantFilter, input.userId, input.messageAction);
      await auditLog({
        action: "cipp.mailbox.copyForSent",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { messageAction: input.messageAction },
      });
      return result;
    }),

  execEditMailboxPermissions: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), permissions: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execEditMailboxPermissions(input.tenantFilter, input.userId, input.permissions);
      await auditLog({
        action: "cipp.mailbox.editPermissions",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { permissions: Object.keys(input.permissions) },
      });
      return result;
    }),

  execSetMailboxQuota: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), quota: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execSetMailboxQuota(input.tenantFilter, input.userId, input.quota);
      await auditLog({
        action: "cipp.mailbox.setQuota",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { quota: input.quota },
      });
      return result;
    }),

  execEditCalendarPermissions: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), permissions: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execEditCalendarPermissions(input.tenantFilter, input.userId, input.permissions);
      await auditLog({
        action: "cipp.calendar.editPermissions",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { permissions: Object.keys(input.permissions) },
      });
      return result;
    }),

  listRestrictedUsers: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listRestrictedUsers(input.tenantFilter);
    }),

  removeRestrictedUser: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeRestrictedUser(input.tenantFilter, input.userId);
      await auditLog({
        action: "cipp.user.removeRestriction",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}`,
        detail: { userId: input.userId },
      });
      return result;
    }),

  listMailboxRestores: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxRestores(input.tenantFilter);
    }),

  listMailboxMobileDevices: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailboxMobileDevices(input.tenantFilter, input.userId);
    }),

  execMailboxMobileDevices: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), userId: z.string(), deviceId: z.string(), action: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execMailboxMobileDevices(input.tenantFilter, input.userId, input.deviceId, input.action);
      await auditLog({
        action: `cipp.mailbox.mobileDevice.${input.action}`,
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.userId}/device:${input.deviceId}`,
        detail: { action: input.action },
      });
      return result;
    }),

  listMessageTrace: requirePerm("cipp.view")
    .input(z.object({
      tenantFilter: z.string(),
      sender: z.string().optional(),
      recipient: z.string().optional(),
      days: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      const { tenantFilter, ...options } = input;
      return cipp.listMessageTrace(tenantFilter, options);
    }),

  listMailQuarantine: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listMailQuarantine(input.tenantFilter);
    }),

  execQuarantineManagement: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), identity: z.string(), action: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.security");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execQuarantineManagement(input.tenantFilter, input.identity, input.action);
      await auditLog({
        action: `cipp.quarantine.${input.action}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/quarantine:${input.identity}`,
        detail: { action: input.action },
      });
      return result;
    }),

  listContacts: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listContacts(input.tenantFilter);
    }),

  addContact: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), contact: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addContact(input.tenantFilter, input.contact);
      await auditLog({
        action: "cipp.contact.add",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { contact: input.contact },
      });
      return result;
    }),

  listSpamFilter: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSpamFilter(input.tenantFilter);
    }),

  listSpamFilterTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listSpamFilterTemplates();
  }),

  addSpamFilter: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addSpamFilter(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.spamFilter.add",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  removeSpamFilter: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeSpamFilter(input.tenantFilter, input.name);
      await auditLog({
        action: "cipp.spamFilter.remove",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/spamFilter:${input.name}`,
        detail: { name: input.name },
      });
      return result;
    }),

  listAntiPhishingFilter: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAntiPhishingFilter(input.tenantFilter);
    }),

  listConnectionFilter: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listConnectionFilter(input.tenantFilter);
    }),

  listTenantAllowBlockList: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTenantAllowBlockList(input.tenantFilter);
    }),

  listQuarantinePolicy: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listQuarantinePolicy(input.tenantFilter);
    }),

  addQuarantinePolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addQuarantinePolicy(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.quarantinePolicy.add",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  listTransportRules: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTransportRules(input.tenantFilter);
    }),

  listTransportRulesTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listTransportRulesTemplates();
  }),

  addTransportRule: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addTransportRule(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.transportRule.add",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  removeTransportRule: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), guid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeTransportRule(input.tenantFilter, input.guid);
      await auditLog({
        action: "cipp.transportRule.remove",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/transportRule:${input.guid}`,
        detail: { guid: input.guid },
      });
      return result;
    }),

  listExchangeConnectors: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listExchangeConnectors(input.tenantFilter);
    }),

  listExConnectorTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listExConnectorTemplates();
  }),

  addExConnector: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addExConnector(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.exConnector.add",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  // =========================================================================
  // Intune
  // =========================================================================

  listIntuneDevices: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter, deviceId: input.deviceId },
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
        detail: { tenantFilter: input.tenantFilter, deviceId: input.deviceId },
      });
      return result;
    }),

  listAPDevices: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAPDevices(input.tenantFilter);
    }),

  listIntuneApps: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listIntuneApps(input.tenantFilter);
    }),

  listIntunePolicy: requirePerm("cipp.view")
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
        detail: { tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  listDeviceDetails: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string(), deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listDeviceDetails(input.tenantFilter, input.deviceId);
    }),

  listAllTenantDeviceCompliance: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listAllTenantDeviceCompliance();
  }),

  listIntuneIntents: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listIntuneIntents(input.tenantFilter);
    }),

  listIntuneTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listIntuneTemplates();
  }),

  addPolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), policy: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addPolicy(input.tenantFilter, input.policy);
      await auditLog({
        action: "cipp.intune.addPolicy",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { policy: input.policy },
      });
      return result;
    }),

  removePolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), policyId: z.string(), policyType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removePolicy(input.tenantFilter, input.policyId, input.policyType);
      await auditLog({
        action: "cipp.intune.removePolicy",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/policy:${input.policyId}`,
        detail: { policyType: input.policyType },
      });
      return result;
    }),

  editPolicy: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), policyId: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.editPolicy(input.tenantFilter, input.policyId, input.data);
      await auditLog({
        action: "cipp.intune.editPolicy",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/policy:${input.policyId}`,
        detail: { fields: Object.keys(input.data) },
      });
      return result;
    }),

  listAssignmentFilters: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAssignmentFilters(input.tenantFilter);
    }),

  listAssignmentFilterTemplates: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listAssignmentFilterTemplates();
  }),

  listAutopilotConfig: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAutopilotConfig(input.tenantFilter);
    }),

  addAutopilotConfig: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), config: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addAutopilotConfig(input.tenantFilter, input.config);
      await auditLog({
        action: "cipp.intune.addAutopilotConfig",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { config: input.config },
      });
      return result;
    }),

  removeAPDevice: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeAPDevice(input.tenantFilter, input.deviceId);
      await auditLog({
        action: "cipp.intune.removeAPDevice",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/device:${input.deviceId}`,
        detail: { deviceId: input.deviceId },
      });
      return result;
    }),

  execAutoPilotSync: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execAutoPilotSync(input.tenantFilter);
      await auditLog({
        action: "cipp.intune.autoPilotSync",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  listAppStatus: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listAppStatus(input.tenantFilter);
    }),

  addChocoApp: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), appData: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addChocoApp(input.tenantFilter, input.appData);
      await auditLog({
        action: "cipp.intune.addChocoApp",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { appData: input.appData },
      });
      return result;
    }),

  addWinGetApp: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), appData: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addWinGetApp(input.tenantFilter, input.appData);
      await auditLog({
        action: "cipp.intune.addWinGetApp",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { appData: input.appData },
      });
      return result;
    }),

  addOfficeApp: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), appData: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addOfficeApp(input.tenantFilter, input.appData);
      await auditLog({
        action: "cipp.intune.addOfficeApp",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { appData: input.appData },
      });
      return result;
    }),

  removeApp: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), appId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeApp(input.tenantFilter, input.appId);
      await auditLog({
        action: "cipp.intune.removeApp",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/app:${input.appId}`,
        detail: { appId: input.appId },
      });
      return result;
    }),

  listScripts: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listScripts(input.tenantFilter);
    }),

  addIntuneTemplate: protectedProcedure
    .input(z.object({ template: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addIntuneTemplate(input.template);
      await auditLog({
        action: "cipp.intune.addTemplate",
        category: "API",
        actorId: ctx.user.id,
        detail: { template: input.template },
      });
      return result;
    }),

  // =========================================================================
  // Teams & SharePoint
  // =========================================================================

  listTeams: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeams(input.tenantFilter);
    }),

  listTeamsActivity: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeamsActivity(input.tenantFilter);
    }),

  listTeamsVoice: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeamsVoice(input.tenantFilter);
    }),

  listSites: requirePerm("cipp.view")
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

  listTeamsLisLocation: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listTeamsLisLocation(input.tenantFilter);
    }),

  addTeam: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addTeam(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.teams.add",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  listSharePointQuota: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSharePointQuota(input.tenantFilter);
    }),

  listSharePointSettings: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listSharePointSettings(input.tenantFilter);
    }),

  addSharePointSite: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.addSharePointSite(input.tenantFilter, input.data);
      await auditLog({
        action: "cipp.sharepoint.addSite",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { data: input.data },
      });
      return result;
    }),

  removeSharePointSite: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), siteUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeSharePointSite(input.tenantFilter, input.siteUrl);
      await auditLog({
        action: "cipp.sharepoint.removeSite",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/site:${input.siteUrl}`,
        detail: { siteUrl: input.siteUrl },
      });
      return result;
    }),

  listOneDriveList: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listOneDriveList(input.tenantFilter);
    }),

  execSharePointSiteAdmin: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), siteUrl: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execSharePointSiteAdmin(input.tenantFilter, input.siteUrl, input.data);
      await auditLog({
        action: "cipp.sharepoint.siteAdmin",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/site:${input.siteUrl}`,
        detail: { data: Object.keys(input.data) },
      });
      return result;
    }),

  execSharePointSiteMembers: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), siteUrl: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execSharePointSiteMembers(input.tenantFilter, input.siteUrl, input.data);
      await auditLog({
        action: "cipp.sharepoint.siteMembers",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/site:${input.siteUrl}`,
        detail: { data: Object.keys(input.data) },
      });
      return result;
    }),

  execOneDrivePerms: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), upn: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execOneDrivePerms(input.tenantFilter, input.upn, input.data);
      await auditLog({
        action: "cipp.onedrive.editPerms",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}/user:${input.upn}`,
        detail: { data: Object.keys(input.data) },
      });
      return result;
    }),

  // =========================================================================
  // GDAP
  // =========================================================================

  listGDAPInvite: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listGDAPInvite();
  }),

  listGDAPAccessAssignments: requirePerm("cipp.view")
    .input(z.object({ relationshipId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listGDAPAccessAssignments(input.relationshipId);
    }),

  execGDAPInvite: protectedProcedure
    .input(z.object({ data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execGDAPInvite(input.data);
      await auditLog({
        action: "cipp.gdap.invite",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { data: input.data },
      });
      return result;
    }),

  execAddGDAPRole: protectedProcedure
    .input(z.object({ data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execAddGDAPRole(input.data);
      await auditLog({
        action: "cipp.gdap.addRole",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { data: input.data },
      });
      return result;
    }),

  execDeleteGDAPRelationship: protectedProcedure
    .input(z.object({ relationshipId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execDeleteGDAPRelationship(input.relationshipId);
      await auditLog({
        action: "cipp.gdap.deleteRelationship",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { relationshipId: input.relationshipId },
      });
      return result;
    }),

  execGDAPMigration: protectedProcedure
    .input(z.object({ data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execGDAPMigration(input.data);
      await auditLog({
        action: "cipp.gdap.migration",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { data: input.data },
      });
      return result;
    }),

  execCPVPermissions: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execCPVPermissions(input.tenantFilter);
      await auditLog({
        action: "cipp.gdap.cpvPermissions",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  execAccessChecks: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.execAccessChecks(input.tenantFilter);
    }),

  // =========================================================================
  // Service Health
  // =========================================================================

  listServiceHealth: requirePerm("cipp.view")
    .input(z.object({ tenantFilter: z.string() }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listServiceHealth(input.tenantFilter);
    }),

  // =========================================================================
  // CIPP Platform
  // =========================================================================

  listScheduledItems: requirePerm("cipp.view")
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
        detail: { rowKey: input.rowKey },
      });
      return result;
    }),

  listLogs: requirePerm("cipp.view")
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

  listExtensionsConfig: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listExtensionsConfig();
  }),

  getVersion: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.getVersion();
  }),

  listQueue: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listQueue();
  }),

  removeQueue: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.removeQueue(input.id);
      await auditLog({
        action: "cipp.queue.remove",
        category: "API",
        actorId: ctx.user.id,
        detail: { queueId: input.id },
      });
      return result;
    }),

  execNotificationConfig: protectedProcedure
    .input(z.object({ config: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execNotificationConfig(input.config);
      await auditLog({
        action: "cipp.notificationConfig.update",
        category: "API",
        actorId: ctx.user.id,
        detail: { fields: Object.keys(input.config) },
      });
      return result;
    }),

  execPasswordConfig: protectedProcedure
    .input(z.object({ config: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execPasswordConfig(input.config);
      await auditLog({
        action: "cipp.passwordConfig.update",
        category: "API",
        actorId: ctx.user.id,
        detail: { fields: Object.keys(input.config) },
      });
      return result;
    }),

  execRunBackupPlatform: protectedProcedure
    .input(z.object({ tenantFilter: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execRunBackup(input.tenantFilter);
      await auditLog({
        action: "cipp.backup.runPlatform",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { tenantFilter: input.tenantFilter },
      });
      return result;
    }),

  listExcludedLicenses: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listExcludedLicenses();
  }),

  listExcludedTenants: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listExcludedTenants();
  }),

  execExcludeTenant: protectedProcedure
    .input(z.object({ tenantFilter: z.string(), exclude: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execExcludeTenant(input.tenantFilter, input.exclude);
      await auditLog({
        action: input.exclude ? "cipp.tenant.exclude" : "cipp.tenant.include",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { exclude: input.exclude },
      });
      return result;
    }),

  listTrustedIP: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listTrustedIP();
  }),

  listCustomVariables: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listCustomVariables();
  }),

  listNotificationConfig: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listNotificationConfig();
  }),

  listPendingWebhooks: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listPendingWebhooks();
  }),

  listScheduledTasks: requirePerm("cipp.view")
    .input(z.object({ showHidden: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listScheduledTasks(input.showHidden);
    }),

  // =========================================================================
  // Extensions
  // =========================================================================

  execExtensionMapping: protectedProcedure
    .input(z.object({ data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execExtensionMapping(input.data);
      await auditLog({
        action: "cipp.extension.mapping",
        category: "API",
        actorId: ctx.user.id,
        detail: { data: Object.keys(input.data) },
      });
      return result;
    }),

  listExtensionSync: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listExtensionSync();
  }),

  execExtensionsConfigUpdate: protectedProcedure
    .input(z.object({ config: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execExtensionsConfig(input.config);
      await auditLog({
        action: "cipp.extensionsConfig.update",
        category: "API",
        actorId: ctx.user.id,
        detail: { fields: Object.keys(input.config) },
      });
      return result;
    }),

  execExtensionTest: protectedProcedure
    .input(z.object({ extension: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execExtensionTest(input.extension);
      await auditLog({
        action: "cipp.extension.test",
        category: "API",
        actorId: ctx.user.id,
        detail: { extension: input.extension },
      });
      return result;
    }),

  listHaloClients: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.listHaloClients();
  }),

  // =========================================================================
  // Graph API (pass-through)
  // =========================================================================

  graphRequest: requirePerm("cipp.view")
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

  listGraphBulkRequest: requirePerm("cipp.view")
    .input(z.object({
      tenantFilter: z.string(),
      endpoint: z.string(),
      options: z.record(z.unknown()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const cipp = await getCIPP(ctx.prisma);
      return cipp.listGraphBulkRequest(input.tenantFilter, input.endpoint, input.options);
    }),

  execExoRequest: protectedProcedure
    .input(z.object({
      tenantFilter: z.string(),
      cmdlet: z.string(),
      cmdParams: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user.id, "cipp.manage");
      const cipp = await getCIPP(ctx.prisma);
      const result = await cipp.execExoRequest(input.tenantFilter, input.cmdlet, input.cmdParams);
      await auditLog({
        action: "cipp.exo.request",
        category: "API",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantFilter}`,
        detail: { cmdlet: input.cmdlet },
      });
      return result;
    }),

  // =========================================================================
  // Health Check
  // =========================================================================

  healthCheck: requirePerm("cipp.view").query(async ({ ctx }) => {
    const cipp = await getCIPP(ctx.prisma);
    return cipp.healthCheck();
  }),
});
