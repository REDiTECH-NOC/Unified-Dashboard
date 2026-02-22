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
});

export type AppRouter = typeof appRouter;
