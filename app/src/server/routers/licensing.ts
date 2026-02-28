/**
 * Licensing tRPC router — read-only access to Pax8 distributor data.
 *
 * Provides: companies, products, subscriptions, orders, invoices, usage summaries.
 * All endpoints are read-only (GET). Ordering/provisioning deferred to a future phase.
 */

import { z } from "zod";
import { router, protectedProcedure, requirePerm } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";

export const licensingRouter = router({
  // ─── Companies ──────────────────────────────────────────────

  getCompanies: requirePerm("billing.view").query(async ({ ctx }) => {
    const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
    return licensing.getCompanies();
  }),

  getCompanyById: requirePerm("billing.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getCompanyById(input.id);
    }),

  // ─── Products ───────────────────────────────────────────────

  getProducts: requirePerm("billing.view")
    .input(
      z
        .object({ vendorName: z.string().optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getProducts(input?.vendorName);
    }),

  getProductById: requirePerm("billing.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getProductById(input.id);
    }),

  // ─── Subscriptions ──────────────────────────────────────────

  getSubscriptions: requirePerm("billing.view")
    .input(
      z
        .object({
          companyId: z.string().optional(),
          productId: z.string().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getSubscriptions(input ?? undefined);
    }),

  getSubscriptionById: requirePerm("billing.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getSubscriptionById(input.id);
    }),

  // ─── Orders ─────────────────────────────────────────────────

  getOrders: requirePerm("billing.view")
    .input(
      z
        .object({ companyId: z.string().optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getOrders(input?.companyId);
    }),

  // ─── Invoices ───────────────────────────────────────────────

  getInvoices: requirePerm("billing.view")
    .input(
      z
        .object({ companyId: z.string().optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getInvoices(input?.companyId);
    }),

  getInvoiceItems: requirePerm("billing.view")
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getInvoiceItems(input.invoiceId);
    }),

  // ─── Usage Summaries ────────────────────────────────────────

  getUsageSummaries: requirePerm("billing.view")
    .input(
      z
        .object({ companyId: z.string().optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const licensing = await ConnectorFactory.get("licensing", ctx.prisma);
      return licensing.getUsageSummaries(input?.companyId);
    }),
});
