import { router } from "../trpc";
import { userRouter } from "./user";
import { auditRouter } from "./audit";
import { integrationRouter } from "./integration";
import { permissionRoleRouter } from "./permissionRole";
import { notificationRouter } from "./notification";
import { psaRouter } from "./psa";
import { rmmRouter } from "./rmm";
import { edrRouter } from "./edr";
import { documentationRouter } from "./documentation";
import { uptimeRouter } from "./uptime";
import { companyRouter } from "./company";
import { companyMatchingRouter } from "./company-matching";
import { threecxRouter } from "./threecx";
import { systemRouter } from "./system";
import { networkRouter } from "./network";
import { blackpointRouter } from "./blackpoint";
import { infrastructureRouter } from "./infrastructure";
import { quicklinksRouter } from "./quicklinks";
import { cippRouter } from "./cipp";
import { emailSecurityRouter } from "./email-security";
import { backupRouter } from "./backup";
import { aiRouter } from "./ai";
import { notificationInboxRouter } from "./notification-inbox";
import { notificationPreferencesRouter } from "./notification-preferences";
import { notificationChannelRouter } from "./notification-channel";
import { billingRouter } from "./billing";
import { licensingRouter } from "./licensing";
import { saasBackupRouter } from "./saas-backup";
import { dnsFilterRouter } from "./dns-filter";

export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  integration: integrationRouter,
  permissionRole: permissionRoleRouter,
  notification: notificationRouter,
  psa: psaRouter,
  rmm: rmmRouter,
  edr: edrRouter,
  documentation: documentationRouter,
  uptime: uptimeRouter,
  company: companyRouter,
  companyMatching: companyMatchingRouter,
  threecx: threecxRouter,
  system: systemRouter,
  network: networkRouter,
  blackpoint: blackpointRouter,
  infrastructure: infrastructureRouter,
  quicklinks: quicklinksRouter,
  cipp: cippRouter,
  emailSecurity: emailSecurityRouter,
  backup: backupRouter,
  ai: aiRouter,
  notificationInbox: notificationInboxRouter,
  notificationPreferences: notificationPreferencesRouter,
  notificationChannel: notificationChannelRouter,
  billing: billingRouter,
  licensing: licensingRouter,
  saasBackup: saasBackupRouter,
  dnsFilter: dnsFilterRouter,
});

export type AppRouter = typeof appRouter;
