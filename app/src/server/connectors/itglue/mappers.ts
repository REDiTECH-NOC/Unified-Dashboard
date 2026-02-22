/**
 * IT Glue → Normalized type mappers.
 * Transforms JSON:API response resources into unified schema.
 */

import type {
  NormalizedOrganization,
  NormalizedDevice,
  NormalizedCredential,
  NormalizedContact,
  NormalizedDocument,
} from "../_interfaces/common";
import type {
  ITGlueResource,
  ITGlueOrganizationAttributes,
  ITGlueConfigurationAttributes,
  ITGluePasswordAttributes,
  ITGlueContactAttributes,
  ITGlueFlexibleAssetAttributes,
} from "./types";

const TOOL_ID = "itglue";

export function mapOrganization(
  resource: ITGlueResource<ITGlueOrganizationAttributes>
): NormalizedOrganization {
  const attrs = resource.attributes;
  return {
    sourceToolId: TOOL_ID,
    sourceId: resource.id,
    name: attrs.name,
    status: attrs["organization-status-name"],
    _raw: resource,
  };
}

export function mapConfiguration(
  resource: ITGlueResource<ITGlueConfigurationAttributes>
): NormalizedDevice {
  const attrs = resource.attributes;
  return {
    sourceToolId: TOOL_ID,
    sourceId: resource.id,
    hostname: attrs.hostname ?? attrs.name,
    organizationSourceId: attrs["organization-id"]
      ? String(attrs["organization-id"])
      : undefined,
    organizationName: attrs["organization-name"],
    privateIp: attrs["primary-ip"],
    macAddress: attrs["mac-address"],
    serialNumber: attrs["serial-number"],
    status: attrs["configuration-status-name"]?.toLowerCase() === "active"
      ? "online"
      : attrs["configuration-status-name"]?.toLowerCase() === "inactive"
        ? "offline"
        : "unknown",
    deviceType: mapConfigType(attrs["configuration-type-name"]),
    metadata: {
      assetTag: attrs["asset-tag"],
      configTypeName: attrs["configuration-type-name"],
      warrantyExpires: attrs["warranty-expires-at"],
      notes: attrs.notes,
    },
    _raw: resource,
  };
}

function mapConfigType(typeName?: string): NormalizedDevice["deviceType"] {
  if (!typeName) return "other";
  const t = typeName.toLowerCase();
  if (t.includes("server")) return "server";
  if (t.includes("workstation") || t.includes("desktop")) return "workstation";
  if (t.includes("laptop") || t.includes("notebook")) return "laptop";
  if (t.includes("switch") || t.includes("router") || t.includes("firewall") || t.includes("access point")) return "network";
  if (t.includes("phone") || t.includes("tablet") || t.includes("mobile")) return "mobile";
  return "other";
}

export function mapPassword(
  resource: ITGlueResource<ITGluePasswordAttributes>
): NormalizedCredential {
  const attrs = resource.attributes;
  return {
    sourceToolId: TOOL_ID,
    sourceId: resource.id,
    name: attrs.name,
    username: attrs.username,
    password: attrs.password, // Only populated if API key has password access
    otpSecret: attrs["otp-enabled"] ? undefined : undefined, // OTP secret retrieved separately
    url: attrs.url,
    notes: attrs.notes,
    organizationSourceId: attrs["organization-id"]
      ? String(attrs["organization-id"])
      : undefined,
    organizationName: attrs["organization-name"],
    resourceType: attrs["resource-type"],
    resourceSourceId: attrs["resource-id"]
      ? String(attrs["resource-id"])
      : undefined,
    updatedAt: attrs["password-updated-at"]
      ? new Date(attrs["password-updated-at"])
      : attrs["updated-at"]
        ? new Date(attrs["updated-at"])
        : undefined,
    _raw: resource,
  };
}

export function mapContact(
  resource: ITGlueResource<ITGlueContactAttributes>
): NormalizedContact {
  const attrs = resource.attributes;

  const primaryEmail = attrs["contact-emails"]?.find((e) => e.primary)?.value
    ?? attrs["contact-emails"]?.[0]?.value;

  const primaryPhone = attrs["contact-phones"]?.find((p) => p.primary)?.value
    ?? attrs["contact-phones"]?.[0]?.value;

  return {
    sourceToolId: TOOL_ID,
    sourceId: resource.id,
    firstName: attrs["first-name"] ?? "",
    lastName: attrs["last-name"] ?? "",
    email: primaryEmail,
    phone: primaryPhone,
    title: attrs.title,
    organizationSourceId: attrs["organization-id"]
      ? String(attrs["organization-id"])
      : undefined,
    organizationName: attrs["organization-name"],
    _raw: resource,
  };
}

export function mapFlexibleAsset(
  resource: ITGlueResource<ITGlueFlexibleAssetAttributes>
): NormalizedDocument {
  const attrs = resource.attributes;

  // Extract content from traits (flexible asset fields)
  let content = "";
  if (attrs.traits) {
    content = Object.entries(attrs.traits)
      .map(([key, val]) => {
        if (typeof val === "string") return `${key}: ${val}`;
        if (val && typeof val === "object") return `${key}: ${JSON.stringify(val)}`;
        return null;
      })
      .filter(Boolean)
      .join("\n");
  }

  return {
    sourceToolId: TOOL_ID,
    sourceId: resource.id,
    title: attrs.name ?? `Flexible Asset ${resource.id}`,
    content,
    documentType: "flexible_asset",
    organizationSourceId: attrs["organization-id"]
      ? String(attrs["organization-id"])
      : undefined,
    organizationName: attrs["organization-name"],
    createdAt: attrs["created-at"] ? new Date(attrs["created-at"]) : undefined,
    updatedAt: attrs["updated-at"] ? new Date(attrs["updated-at"]) : undefined,
    _raw: resource,
  };
}
