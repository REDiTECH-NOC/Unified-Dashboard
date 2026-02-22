/**
 * IDocumentationConnector — interface for documentation platform connectors.
 *
 * Current implementation: IT Glue
 * Future: Hudu, Confluence, etc.
 */

import type { PaginatedResponse, HealthCheckResult } from "../_base/types";
import type {
  NormalizedOrganization,
  NormalizedDocument,
  NormalizedCredential,
  NormalizedContact,
  NormalizedDevice,
} from "./common";

export interface DocumentFilter {
  organizationId?: string;
  documentType?: string;
  searchTerm?: string;
  updatedAfter?: Date;
}

export interface CreateDocumentInput {
  organizationId: string;
  title: string;
  content: string;
  /** The flexible asset type ID (for IT Glue) */
  typeId?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
}

export interface IDocumentationConnector {
  // --- Organizations ---
  getOrganizations(
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedOrganization>>;

  getOrganizationById(id: string): Promise<NormalizedOrganization>;

  // --- Documents (Flexible Assets, KB articles) ---
  getDocuments(
    filter?: DocumentFilter,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedDocument>>;

  getDocumentById(id: string): Promise<NormalizedDocument>;

  createDocument(input: CreateDocumentInput): Promise<NormalizedDocument>;

  updateDocument(
    id: string,
    input: UpdateDocumentInput
  ): Promise<NormalizedDocument>;

  // --- Passwords / Credentials ---
  getPasswords(
    organizationId: string,
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedCredential>>;

  getPasswordById(id: string): Promise<NormalizedCredential>;

  // --- Configurations (IT assets tracked in docs platform) ---
  getConfigurations(
    organizationId?: string,
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedDevice>>;

  // --- Contacts ---
  getContacts(
    organizationId?: string,
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedContact>>;

  // --- Flexible Asset Types (schema definitions) ---
  getFlexibleAssetTypes(): Promise<
    Array<{ id: string; name: string; description?: string }>
  >;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
