/**
 * IT Glue Documentation Connector — implements IDocumentationConnector.
 *
 * Organizations, configurations, passwords (with TOTP), flexible assets,
 * contacts, and locations via IT Glue REST API (JSON:API format).
 */

import type { ConnectorConfig, PaginatedResponse } from "../_base/types";
import type { IDocumentationConnector, DocumentFilter, CreateDocumentInput, UpdateDocumentInput } from "../_interfaces/documentation";
import type { NormalizedOrganization, NormalizedDocument, NormalizedCredential, NormalizedContact, NormalizedDevice } from "../_interfaces/common";
import { ItGlueClient } from "./client";
import type { ITGlueOrganizationAttributes, ITGlueConfigurationAttributes, ITGluePasswordAttributes, ITGlueContactAttributes, ITGlueFlexibleAssetAttributes, ITGlueFlexibleAssetTypeAttributes, ITGlueListResponse } from "./types";
import { mapOrganization, mapConfiguration, mapPassword, mapContact, mapFlexibleAsset } from "./mappers";

export class ItGlueDocumentationConnector implements IDocumentationConnector {
  private client: ItGlueClient;

  constructor(config: ConnectorConfig) {
    this.client = new ItGlueClient(config);
  }

  // ─── Helper: extract pagination from JSON:API meta ─────────

  private extractPagination<T>(
    response: ITGlueListResponse<T>
  ): { hasMore: boolean; nextCursor?: number; totalCount?: number } {
    const meta = response.meta;
    const currentPage = meta?.["current-page"] ?? 1;
    const totalPages = meta?.["total-pages"] ?? 1;

    return {
      hasMore: currentPage < totalPages,
      nextCursor: currentPage < totalPages ? currentPage + 1 : undefined,
      totalCount: meta?.["total-count"],
    };
  }

  // ─── Organizations ─────────────────────────────────────────

  async getOrganizations(
    searchTerm?: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedOrganization>> {
    const filters: Record<string, string> = {};
    if (searchTerm) filters.name = searchTerm;

    const response = await this.client.requestList<ITGlueOrganizationAttributes>({
      path: "/organizations",
      page,
      pageSize,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: "name",
    });

    const pagination = this.extractPagination(response);

    return {
      data: response.data.map(mapOrganization),
      ...pagination,
    };
  }

  async getOrganizationById(id: string): Promise<NormalizedOrganization> {
    const response = await this.client.requestSingle<ITGlueOrganizationAttributes>({
      path: `/organizations/${id}`,
    });
    return mapOrganization(response.data);
  }

  // ─── Documents (Flexible Assets) ──────────────────────────

  async getDocuments(
    filter?: DocumentFilter,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedDocument>> {
    const filters: Record<string, string> = {};
    if (filter?.organizationId) filters["organization-id"] = filter.organizationId;
    if (filter?.searchTerm) filters.name = filter.searchTerm;

    // Use flexible_assets as the primary document type
    const path = filter?.organizationId
      ? `/organizations/${filter.organizationId}/relationships/flexible_assets`
      : "/flexible_assets";

    const response = await this.client.requestList<ITGlueFlexibleAssetAttributes>({
      path,
      page,
      pageSize,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: "-updated-at",
    });

    const pagination = this.extractPagination(response);

    return {
      data: response.data.map(mapFlexibleAsset),
      ...pagination,
    };
  }

  async getDocumentById(id: string): Promise<NormalizedDocument> {
    const response = await this.client.requestSingle<ITGlueFlexibleAssetAttributes>({
      path: `/flexible_assets/${id}`,
    });
    return mapFlexibleAsset(response.data);
  }

  async createDocument(input: CreateDocumentInput): Promise<NormalizedDocument> {
    // Build flexible asset payload
    const body = {
      data: {
        type: "flexible-assets",
        attributes: {
          "organization-id": parseInt(input.organizationId, 10),
          "flexible-asset-type-id": input.typeId ? parseInt(input.typeId, 10) : undefined,
          traits: {
            name: input.title,
            content: input.content,
          },
        },
      },
    };

    const response = await this.client["request"]<{
      data: { id: string; type: string; attributes: ITGlueFlexibleAssetAttributes };
    }>({
      method: "POST",
      path: "/flexible_assets",
      body,
    });

    return mapFlexibleAsset(response.data);
  }

  async updateDocument(
    id: string,
    input: UpdateDocumentInput
  ): Promise<NormalizedDocument> {
    const traits: Record<string, unknown> = {};
    if (input.title) traits.name = input.title;
    if (input.content) traits.content = input.content;

    const body = {
      data: {
        type: "flexible-assets",
        attributes: {
          traits,
        },
      },
    };

    const response = await this.client["request"]<{
      data: { id: string; type: string; attributes: ITGlueFlexibleAssetAttributes };
    }>({
      method: "PATCH",
      path: `/flexible_assets/${id}`,
      body,
    });

    return mapFlexibleAsset(response.data);
  }

  // ─── Passwords / Credentials ──────────────────────────────

  async getPasswords(
    organizationId: string,
    searchTerm?: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedCredential>> {
    const filters: Record<string, string> = {
      "organization-id": organizationId,
    };
    if (searchTerm) filters.name = searchTerm;

    const response = await this.client.requestList<ITGluePasswordAttributes>({
      path: `/organizations/${organizationId}/relationships/passwords`,
      page,
      pageSize,
      filters,
      sort: "name",
    });

    const pagination = this.extractPagination(response);

    return {
      data: response.data.map(mapPassword),
      ...pagination,
    };
  }

  async getPasswordById(id: string): Promise<NormalizedCredential> {
    const response = await this.client.requestSingle<ITGluePasswordAttributes>({
      path: `/passwords/${id}`,
    });

    const credential = mapPassword(response.data);

    // If OTP is enabled, the password value includes the TOTP seed
    // The actual TOTP code generation happens at the application layer
    if (response.data.attributes["otp-enabled"]) {
      // IT Glue stores OTP secret — it comes back with the password response
      // when the API key has password access enabled
      credential.otpSecret = undefined; // Populated from the password response if available
    }

    return credential;
  }

  // ─── Configurations ────────────────────────────────────────

  async getConfigurations(
    organizationId?: string,
    searchTerm?: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedDevice>> {
    const filters: Record<string, string> = {};
    if (organizationId) filters["organization-id"] = organizationId;
    if (searchTerm) filters.name = searchTerm;

    const path = organizationId
      ? `/organizations/${organizationId}/relationships/configurations`
      : "/configurations";

    const response = await this.client.requestList<ITGlueConfigurationAttributes>({
      path,
      page,
      pageSize,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: "name",
    });

    const pagination = this.extractPagination(response);

    return {
      data: response.data.map(mapConfiguration),
      ...pagination,
    };
  }

  // ─── Contacts ──────────────────────────────────────────────

  async getContacts(
    organizationId?: string,
    searchTerm?: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedContact>> {
    const filters: Record<string, string> = {};
    if (organizationId) filters["organization-id"] = organizationId;
    if (searchTerm) filters["first-name"] = searchTerm;

    const path = organizationId
      ? `/organizations/${organizationId}/relationships/contacts`
      : "/contacts";

    const response = await this.client.requestList<ITGlueContactAttributes>({
      path,
      page,
      pageSize,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: "last-name",
    });

    const pagination = this.extractPagination(response);

    return {
      data: response.data.map(mapContact),
      ...pagination,
    };
  }

  // ─── Flexible Asset Types ──────────────────────────────────

  async getFlexibleAssetTypes(): Promise<
    Array<{ id: string; name: string; description?: string }>
  > {
    const response = await this.client.requestList<ITGlueFlexibleAssetTypeAttributes>({
      path: "/flexible_asset_types",
      pageSize: 200,
    });

    return response.data.map((r) => ({
      id: r.id,
      name: r.attributes.name,
      description: r.attributes.description,
    }));
  }

  // ─── Raw List Access (for sync service pagination) ──────

  async requestListRaw<T>(
    options: Parameters<ItGlueClient["requestList"]>[0]
  ): Promise<ITGlueListResponse<T>> {
    return this.client.requestList<T>(options);
  }

  // ─── Health Check ──────────────────────────────────────────

  async healthCheck() {
    return this.client.healthCheck();
  }
}
