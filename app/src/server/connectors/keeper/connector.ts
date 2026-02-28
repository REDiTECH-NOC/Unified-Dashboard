/**
 * Keeper Security MSP connector.
 *
 * Implements IPasswordManagerConnector for MSP-level account management:
 * - List managed companies (enterprises)
 * - Current and monthly usage/billing data
 * - Product catalog
 */

import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type {
  IPasswordManagerConnector,
  ManagedCompany,
  CompanyUsage,
  MonthlyUsage,
  PasswordManagerProduct,
} from "../_interfaces/password-manager";
import { KeeperClient } from "./client";
import { mapAccount, mapCurrentUsage, mapMonthlyUsage, mapProduct } from "./mappers";

export class KeeperConnector implements IPasswordManagerConnector {
  private client: KeeperClient;

  constructor(config: ConnectorConfig) {
    this.client = new KeeperClient(config);
  }

  async listManagedCompanies(): Promise<ManagedCompany[]> {
    const accounts = await this.client.getAccounts();
    return accounts.map(mapAccount);
  }

  async getCompanyUsage(companyIds: string[]): Promise<CompanyUsage[]> {
    const ids = companyIds.map((id) => parseInt(id, 10));
    const usage = await this.client.getCurrentUsage(ids);
    return usage.map(mapCurrentUsage);
  }

  async getMonthlyUsage(
    companyIds: string[],
    month: string
  ): Promise<MonthlyUsage[]> {
    const ids = companyIds.map((id) => parseInt(id, 10));
    const usage = await this.client.getMonthlyUsage(ids, month);
    return usage.map(mapMonthlyUsage);
  }

  async getProducts(): Promise<PasswordManagerProduct[]> {
    const products = await this.client.getProducts();
    return products.map(mapProduct);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
