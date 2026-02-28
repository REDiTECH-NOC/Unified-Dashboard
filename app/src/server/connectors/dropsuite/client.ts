/**
 * Dropsuite REST API client.
 *
 * Extends BaseHttpClient — uses static token auth (X-Reseller-Token + X-Access-Token).
 *
 * Auth model:
 * - X-Reseller-Token: Global reseller token (stored in IntegrationConfig)
 * - X-Access-Token: Per-org auth token (returned in /users response, passed per-call)
 * - Secret Token: Used for webhook verification (not needed for read operations)
 *
 * The reseller token authenticates the MSP. Per-org tokens scope requests to a specific
 * organization's data. Some endpoints (/users, /status) only need the reseller token.
 *
 * IMPORTANT: Per-org access tokens are passed via request headers (not mutable state)
 * to ensure thread-safety when parallel requests run for different orgs.
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type {
  DropsuiteUser,
  DropsuiteTenant,
  DropsuiteMailbox,
  DropsuiteBackupAccount,
  DropsuitePaginatedResponse,
  DropsuiteRetentionPolicy,
  DropsuiteJournalAccount,
  DropsuiteDelegatedUser,
  DropsuitePlan,
  DropsuiteOneDrive,
  DropsuiteSharePointDomain,
  DropsuiteTeamsDomain,
  DropsuiteCalendarAccount,
  DropsuiteContactAccount,
  DropsuiteTaskAccount,
  DropsuiteNdrJournal,
  DropsuiteSharePointSite,
  DropsuiteTeamsGroup,
} from "./types";

export class DropsuiteClient extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  /** Base auth headers — reseller token + default access token (for reseller-level endpoints) */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "X-Reseller-Token": this.config.credentials.resellerToken ?? this.config.credentials.apiKey ?? "",
    };
    // Default access token for reseller-level endpoints (/users, /status)
    const defaultToken = this.config.credentials.authenticationToken ?? "";
    if (defaultToken) {
      headers["X-Access-Token"] = defaultToken;
    }
    return headers;
  }

  /** Build per-org override headers (overrides the default access token) */
  private orgHeaders(orgAuthToken: string): Record<string, string> {
    return { "X-Access-Token": orgAuthToken };
  }

  // ─── Status ────────────────────────────────────────────────────

  async getStatus(): Promise<string> {
    return this.request<string>({ path: "/status", skipRateLimit: true });
  }

  // ─── Plans ──────────────────────────────────────────────────────

  /** Get all available plans for this reseller */
  async getPlans(): Promise<DropsuitePlan[]> {
    return this.request<DropsuitePlan[]>({ path: "/plans" });
  }

  // ─── Users / Organizations ────────────────────────────────────

  /** Get all tenant users (organizations) under this reseller */
  async getUsers(): Promise<DropsuiteUser[]> {
    return this.request<DropsuiteUser[]>({ path: "/users" });
  }

  /** Get a specific user/org by ID */
  async getUserById(id: string): Promise<DropsuiteUser> {
    return this.request<DropsuiteUser>({ path: `/users/${id}` });
  }

  // ─── Tenants ──────────────────────────────────────────────────

  /** Get tenants (M365/GWS domains) for an organization */
  async getTenants(
    orgId: string,
    orgAuthToken: string,
    type?: "m365" | "gws"
  ): Promise<DropsuiteTenant[]> {
    const allTenants: DropsuiteTenant[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const params: Record<string, string | number | boolean | undefined> = { page, per_page: perPage };
      if (type) params.type = type;

      const result = await this.request<DropsuitePaginatedResponse<DropsuiteTenant>>({
        path: `/users/${orgId}/tenants`,
        params,
        headers: this.orgHeaders(orgAuthToken),
      });

      allTenants.push(...result.data);
      if (!result.pagination.next_page) break;
      page = result.pagination.next_page;
    }

    return allTenants;
  }

  // ─── Tenant Mailboxes ─────────────────────────────────────────

  /** Get mailboxes/users within a tenant */
  async getTenantMailboxes(
    orgId: string,
    orgAuthToken: string,
    tenantId: number,
    type: "m365" | "gws",
    status?: "active" | "excluded" | "available"
  ): Promise<DropsuiteMailbox[]> {
    const allMailboxes: DropsuiteMailbox[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const params: Record<string, string | number | boolean | undefined> = {
        type,
        page,
        per_page: perPage,
      };
      if (status) params.status = status;

      const result = await this.request<DropsuitePaginatedResponse<DropsuiteMailbox>>({
        path: `/users/${orgId}/tenants/${tenantId}/accounts`,
        params,
        headers: this.orgHeaders(orgAuthToken),
      });

      allMailboxes.push(...result.data);
      if (!result.pagination.next_page) break;
      page = result.pagination.next_page;
    }

    return allMailboxes;
  }

  // ─── Backup Accounts ──────────────────────────────────────────

  /** Get backup accounts (with live status) for an org */
  async getBackupAccounts(orgAuthToken: string): Promise<DropsuiteBackupAccount[]> {
    return this.request<DropsuiteBackupAccount[]>({
      path: "/accounts",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  /** Get deactivated backup accounts */
  async getDeactivatedAccounts(orgAuthToken: string): Promise<DropsuiteBackupAccount[]> {
    return this.request<DropsuiteBackupAccount[]>({
      path: "/accounts/deactivated_accounts",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  /** Get accounts with connection failures */
  async getConnectionFailures(orgAuthToken: string): Promise<DropsuiteBackupAccount[]> {
    return this.request<DropsuiteBackupAccount[]>({
      path: "/accounts/connection_failures",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── Journals ───────────────────────────────────────────────────

  /** Get journal mailbox accounts for an org */
  async getJournals(orgAuthToken: string): Promise<DropsuiteJournalAccount[]> {
    return this.request<DropsuiteJournalAccount[]>({
      path: "/journals",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── Delegated Users ──────────────────────────────────────────

  /** Get delegated users for an organization */
  async getDelegatedUsers(orgId: string, orgAuthToken: string): Promise<DropsuiteDelegatedUser[]> {
    return this.request<DropsuiteDelegatedUser[]>({
      path: `/users/${orgId}/delegated`,
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── Retention Policies ───────────────────────────────────────

  /** Get retention policies for an organization */
  async getRetentionPolicies(
    orgId: string,
    orgAuthToken: string
  ): Promise<DropsuiteRetentionPolicy[]> {
    const allPolicies: DropsuiteRetentionPolicy[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const result = await this.request<DropsuitePaginatedResponse<DropsuiteRetentionPolicy>>({
        path: `/users/${orgId}/retention_policies`,
        params: { page, per_page: perPage },
        headers: this.orgHeaders(orgAuthToken),
      });

      allPolicies.push(...result.data);
      if (!result.pagination.next_page) break;
      page = result.pagination.next_page;
    }

    return allPolicies;
  }

  // ─── OneDrive Backups ────────────────────────────────────────

  /** Get OneDrive backup accounts for an org */
  async getOneDrives(orgAuthToken: string): Promise<DropsuiteOneDrive[]> {
    return this.request<DropsuiteOneDrive[]>({
      path: "/onedrives",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── SharePoint Backups ────────────────────────────────────────

  /** Get SharePoint domain backups for an org */
  async getSharePointDomains(orgAuthToken: string): Promise<DropsuiteSharePointDomain[]> {
    return this.request<DropsuiteSharePointDomain[]>({
      path: "/sharepoints/domains",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  /** Get individual SharePoint sites within a domain */
  async getSharePointSites(domainId: number, orgAuthToken: string): Promise<DropsuiteSharePointSite[]> {
    return this.request<DropsuiteSharePointSite[]>({
      path: `/sharepoints/domains/${domainId}/sites`,
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── Teams & Groups ────────────────────────────────────────────

  /** Get Teams & Groups domain backups for an org */
  async getTeamsDomains(orgAuthToken: string): Promise<DropsuiteTeamsDomain[]> {
    return this.request<DropsuiteTeamsDomain[]>({
      path: "/teams_and_groups/domains",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  /** Get individual Teams groups within a domain */
  async getTeamsGroups(domainId: number, orgAuthToken: string): Promise<DropsuiteTeamsGroup[]> {
    return this.request<DropsuiteTeamsGroup[]>({
      path: `/teams_and_groups/domains/${domainId}/teams`,
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── Calendars, Contacts, Tasks ────────────────────────────────

  /** Get calendar backup accounts for an org */
  async getCalendars(orgAuthToken: string): Promise<DropsuiteCalendarAccount[]> {
    return this.request<DropsuiteCalendarAccount[]>({
      path: "/calendars",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  /** Get contact backup accounts for an org */
  async getContacts(orgAuthToken: string): Promise<DropsuiteContactAccount[]> {
    return this.request<DropsuiteContactAccount[]>({
      path: "/contacts",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  /** Get task backup accounts for an org */
  async getTasks(orgAuthToken: string): Promise<DropsuiteTaskAccount[]> {
    return this.request<DropsuiteTaskAccount[]>({
      path: "/tasks",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── NDR Journal ───────────────────────────────────────────────

  /** Get NDR journal mailbox for an org */
  async getNdrJournal(orgAuthToken: string): Promise<DropsuiteNdrJournal> {
    return this.request<DropsuiteNdrJournal>({
      path: "/ndr_journals",
      headers: this.orgHeaders(orgAuthToken),
    });
  }

  // ─── Health Check ─────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await this.getStatus();
      return {
        ok: result === "OK",
        latencyMs: Date.now() - start,
        message: result === "OK" ? "Connection successful" : `Unexpected status: ${result}`,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }
}
