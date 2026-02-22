/**
 * IT Glue API response types.
 * IT Glue uses JSON:API specification (https://jsonapi.org/).
 * All responses follow the { data, meta, included } envelope.
 */

/** JSON:API resource object */
export interface ITGlueResource<T = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<
    string,
    {
      data: { id: string; type: string } | Array<{ id: string; type: string }> | null;
    }
  >;
}

/** JSON:API collection response */
export interface ITGlueListResponse<T = Record<string, unknown>> {
  data: ITGlueResource<T>[];
  meta?: {
    "current-page"?: number;
    "next-page"?: number | null;
    "prev-page"?: number | null;
    "total-pages"?: number;
    "total-count"?: number;
  };
  included?: ITGlueResource[];
}

/** JSON:API single resource response */
export interface ITGlueSingleResponse<T = Record<string, unknown>> {
  data: ITGlueResource<T>;
  included?: ITGlueResource[];
}

// ─── Organization ────────────────────────────────────────────

export interface ITGlueOrganizationAttributes {
  name: string;
  "organization-type-id"?: number;
  "organization-type-name"?: string;
  "organization-status-id"?: number;
  "organization-status-name"?: string;
  description?: string;
  "quick-notes"?: string;
  "short-name"?: string;
  alert?: string;
  primary?: boolean;
  "created-at"?: string;
  "updated-at"?: string;
}

// ─── Configuration (Device) ──────────────────────────────────

export interface ITGlueConfigurationAttributes {
  name: string;
  "organization-id"?: number;
  "organization-name"?: string;
  "configuration-type-id"?: number;
  "configuration-type-name"?: string;
  "configuration-status-id"?: number;
  "configuration-status-name"?: string;
  "contact-id"?: number;
  "contact-name"?: string;
  "serial-number"?: string;
  "asset-tag"?: string;
  hostname?: string;
  "primary-ip"?: string;
  "mac-address"?: string;
  "default-gateway"?: string;
  notes?: string;
  "operating-system-notes"?: string;
  "warranty-expires-at"?: string;
  "installed-by"?: string;
  "purchased-by"?: string;
  "purchased-at"?: string;
  "created-at"?: string;
  "updated-at"?: string;
}

// ─── Password ────────────────────────────────────────────────

export interface ITGluePasswordAttributes {
  name: string;
  "organization-id"?: number;
  "organization-name"?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  "resource-id"?: number;
  "resource-type"?: string;
  "password-category-id"?: number;
  "password-category-name"?: string;
  "otp-enabled"?: boolean;
  "password-updated-at"?: string;
  "created-at"?: string;
  "updated-at"?: string;
}

// ─── Flexible Asset ──────────────────────────────────────────

export interface ITGlueFlexibleAssetAttributes {
  name?: string;
  "organization-id"?: number;
  "organization-name"?: string;
  "flexible-asset-type-id"?: number;
  "flexible-asset-type-name"?: string;
  traits?: Record<string, unknown>;
  "created-at"?: string;
  "updated-at"?: string;
}

// ─── Contact ─────────────────────────────────────────────────

export interface ITGlueContactAttributes {
  "organization-id"?: number;
  "organization-name"?: string;
  "first-name"?: string;
  "last-name"?: string;
  title?: string;
  "contact-type-id"?: number;
  "contact-type-name"?: string;
  location?: {
    id?: number;
    name?: string;
  };
  notes?: string;
  "contact-emails"?: Array<{
    value: string;
    "label-name"?: string;
    primary?: boolean;
  }>;
  "contact-phones"?: Array<{
    value: string;
    "label-name"?: string;
    primary?: boolean;
  }>;
  "created-at"?: string;
  "updated-at"?: string;
}

// ─── Location ────────────────────────────────────────────────

export interface ITGlueLocationAttributes {
  "organization-id"?: number;
  "organization-name"?: string;
  name: string;
  primary?: boolean;
  "address-1"?: string;
  "address-2"?: string;
  city?: string;
  "region-name"?: string;
  "country-name"?: string;
  "postal-code"?: string;
  phone?: string;
  fax?: string;
  "created-at"?: string;
  "updated-at"?: string;
}

// ─── Flexible Asset Type ─────────────────────────────────────

export interface ITGlueFlexibleAssetTypeAttributes {
  name: string;
  description?: string;
  icon?: string;
  enabled?: boolean;
  "created-at"?: string;
  "updated-at"?: string;
}
