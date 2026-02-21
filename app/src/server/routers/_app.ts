import { router } from "../trpc";
import { userRouter } from "./user";
import { auditRouter } from "./audit";
import { integrationRouter } from "./integration";
import { permissionRoleRouter } from "./permissionRole";
import { notificationRouter } from "./notification";

export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  integration: integrationRouter,
  permissionRole: permissionRoleRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
