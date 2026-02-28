/**
 * DNSFilter Mappers — transform raw API responses to normalized interface types.
 */

import type {
  DnsFilterQueryLogEntry,
  DnsFilterTopDomainsResult,
  DnsFilterTopCategoriesResult,
  DnsFilterOrganization,
  DnsFilterNetwork,
  DnsFilterPolicy,
  DnsFilterCategory,
  DnsFilterUserAgent,
  DnsFilterIpAddress,
  DnsFilterIdType,
  DnsFilterUser,
  DnsFilterBlockPage,
  DnsFilterScheduledPolicy,
  DnsFilterApplication,
  DnsFilterApplicationCategory,
} from "./types";
import { DNS_SECURITY_CATEGORIES } from "./types";
import type {
  DnsThreatEvent,
  DnsTopDomain,
  DnsTopCategory,
  DnsQueryLogEntry,
  DnsOrganization,
  DnsNetwork,
  DnsPolicy,
  DnsCategory,
  DnsRoamingClient,
  DnsDomainLookup,
  DnsUser,
  DnsBlockPage,
  DnsScheduledPolicy,
  DnsApplication,
  DnsApplicationCategory,
} from "../_interfaces/dns-security";

// ─── Severity Mapping ────────────────────────────────────────

function mapThreatSeverity(categoryName?: string): {
  severity: DnsThreatEvent["severity"];
  severityScore: number;
} {
  if (!categoryName) return { severity: "medium", severityScore: 5 };

  const cat = categoryName.trim();
  if (cat === "Malware" || cat === "Botnet" || cat === "Cryptomining") {
    return { severity: "critical", severityScore: 9 };
  }
  if (cat === "Phishing & Deception" || cat === "Spyware" || cat === "Compromised & Links to Malware") {
    return { severity: "high", severityScore: 7 };
  }
  if (DNS_SECURITY_CATEGORIES.has(cat)) {
    return { severity: "medium", severityScore: 5 };
  }
  return { severity: "low", severityScore: 3 };
}

function mapQuerySource(source?: string): DnsThreatEvent["source"] {
  if (!source) return "network";
  if (source.includes("agent") || source === "user_agent") return "agent";
  if (source === "proxy") return "proxy";
  return "network";
}

// ─── Query Log → Threat Event ────────────────────────────────

export function mapQueryLogToThreat(entry: DnsFilterQueryLogEntry): DnsThreatEvent {
  const categoryName = entry.categories_names?.[0];
  const { severity, severityScore } = mapThreatSeverity(categoryName);
  return {
    sourceToolId: "dnsfilter",
    sourceId: `${entry.time}-${entry.domain ?? entry.fqdn}`,
    domain: entry.domain ?? "",
    fqdn: entry.fqdn,
    category: categoryName ?? "Unknown",
    categoryId: entry.categories?.[0],
    severity,
    severityScore,
    action: entry.result === "blocked" ? "blocked" : "allowed",
    source: mapQuerySource(entry.agenttype),
    networkName: entry.network_name,
    networkId: entry.networkid?.toString(),
    agentHostname: entry.agentname,
    agentId: entry.agentid,
    queryType: entry.question_type,
    timestamp: new Date(entry.time),
    _raw: entry,
  };
}

// ─── Query Log → DnsQueryLogEntry ────────────────────────────

export function mapQueryLogEntry(entry: DnsFilterQueryLogEntry): DnsQueryLogEntry {
  return {
    domain: entry.domain ?? "",
    fqdn: entry.fqdn,
    category: entry.categories_names?.[0] ?? "Unknown",
    categoryId: entry.categories?.[0],
    result: entry.result === "blocked" ? "blocked" : "allowed",
    isThreat: entry.threat ?? false,
    queryType: entry.question_type,
    source: mapQuerySource(entry.agenttype),
    networkName: entry.network_name,
    agentHostname: entry.agentname,
    timestamp: new Date(entry.time),
    _raw: entry,
  };
}

// ─── Top Domains ─────────────────────────────────────────────

export function mapTopDomain(d: DnsFilterTopDomainsResult, type?: string): DnsTopDomain {
  return {
    domain: d.domain,
    total: d.total,
    blocked: type === "blocked" ? d.total : 0,
    allowed: type === "allowed" ? d.total : (type === "blocked" ? 0 : d.total),
    category: d.categories?.[0]?.name,
    isThreat: false,
  };
}

// ─── Top Categories ──────────────────────────────────────────

export function mapTopCategory(c: DnsFilterTopCategoriesResult): DnsTopCategory {
  return {
    categoryId: c.category_id,
    categoryName: c.category_name,
    total: c.total,
    blocked: 0,
    allowed: c.total,
    isSecurity: DNS_SECURITY_CATEGORIES.has(c.category_name),
  };
}

// ─── Organizations ───────────────────────────────────────────

export function mapOrganization(org: DnsFilterOrganization): DnsOrganization {
  return {
    id: org.id,
    name: org.attributes.name,
    type: org.attributes.type,
    status: org.attributes.state,
    networkCount: org.attributes.total_networks,
    userCount: org.attributes.total_users,
    _raw: org,
  };
}

// ─── Networks ────────────────────────────────────────────────

export function mapNetwork(
  net: DnsFilterNetwork,
  ipLookup?: Map<string, DnsFilterIpAddress>
): DnsNetwork {
  const ipIds = net.relationships?.ip_addresses?.data ?? [];
  const ipAddresses = ipIds
    .map((ref: DnsFilterIdType) => ipLookup?.get(ref.id)?.attributes?.ip)
    .filter(Boolean) as string[];

  return {
    id: net.id,
    name: net.attributes.name,
    organizationId: net.relationships?.organization?.data?.id,
    policyId: net.relationships?.policy?.data?.id ?? undefined,
    scheduledPolicyId: net.relationships?.scheduled_policy?.data?.id ?? undefined,
    blockPageId: net.relationships?.block_page?.data?.id ?? undefined,
    ipAddresses,
    isProtected: !!net.relationships?.policy?.data,
    secretKey: net.attributes.secret_key,
    localDomains: net.attributes.local_domains,
    localResolvers: net.attributes.local_resolvers,
    _raw: net,
  };
}

// ─── Policies ────────────────────────────────────────────────

export function mapPolicy(pol: DnsFilterPolicy): DnsPolicy {
  return {
    id: pol.id,
    name: pol.attributes.name,
    organizationId: pol.attributes.organization_id?.toString(),
    allowedDomains: pol.attributes.whitelist_domains ?? [],
    blockedDomains: pol.attributes.blacklist_domains ?? [],
    blockedCategories: pol.attributes.blacklist_categories ?? [],
    allowUnknownDomains: pol.attributes.allow_unknown_domains,
    googleSafesearch: pol.attributes.google_safesearch,
    bingSafeSearch: pol.attributes.bing_safe_search,
    duckDuckGoSafeSearch: pol.attributes.duck_duck_go_safe_search,
    ecosiaSafesearch: pol.attributes.ecosia_safesearch,
    yandexSafeSearch: pol.attributes.yandex_safe_search,
    youtubeRestricted: pol.attributes.youtube_restricted,
    youtubeRestrictedLevel: pol.attributes.youtube_restricted_level,
    interstitial: pol.attributes.interstitial,
    isGlobalPolicy: pol.attributes.is_global_policy,
    canEdit: pol.attributes.can_edit,
    allowListOnly: pol.attributes.allow_list_only,
    lockVersion: pol.attributes.lock_version,
    allowApplications: pol.attributes.allow_applications,
    blockApplications: pol.attributes.block_applications,
    networkCount: pol.relationships?.network_policies?.data?.length ?? pol.relationships?.networks?.data?.length,
    agentCount: pol.relationships?.agent_policies?.data?.length,
    _raw: pol,
  };
}

// ─── Categories ──────────────────────────────────────────────

export function mapCategory(cat: DnsFilterCategory): DnsCategory {
  return {
    id: cat.id,
    name: cat.attributes.name,
    description: cat.attributes.description,
    isSecurity: cat.attributes.security ?? DNS_SECURITY_CATEGORIES.has(cat.attributes.name),
  };
}

// ─── Roaming Clients ─────────────────────────────────────────

export function mapRoamingClient(agent: DnsFilterUserAgent): DnsRoamingClient {
  const state = (agent.attributes.agent_state ?? "").toLowerCase();
  let agentState: DnsRoamingClient["agentState"] = "offline";
  if (state === "protected") agentState = "protected";
  else if (state === "unprotected") agentState = "unprotected";

  const statusRaw = (agent.attributes.status ?? "").toLowerCase();
  let status: DnsRoamingClient["status"] = "active";
  if (statusRaw === "disabled") status = "disabled";
  else if (statusRaw === "uninstalled") status = "uninstalled";

  return {
    id: agent.id,
    hostname: agent.attributes.hostname ?? agent.attributes.friendly_name ?? "Unknown",
    friendlyName: agent.attributes.friendly_name,
    agentType: agent.attributes.agent_type ?? "unknown",
    agentVersion: agent.attributes.agent_version,
    status,
    agentState,
    policyId: agent.relationships?.policy?.data?.id,
    scheduledPolicyId: agent.relationships?.scheduled_policy?.data?.id,
    networkId: agent.relationships?.network?.data?.id,
    organizationId: agent.relationships?.organization?.data?.id,
    tags: agent.attributes.tags,
    lastSync: agent.attributes.last_sync ? new Date(agent.attributes.last_sync) : undefined,
    _raw: agent,
  };
}

// ─── Users ──────────────────────────────────────────────────

export function mapUser(user: DnsFilterUser): DnsUser {
  return {
    id: user.id,
    email: user.attributes.email,
    name: user.attributes.name,
    role: user.attributes.role,
    organizationId: user.attributes.organization_id?.toString(),
    createdAt: user.attributes.created_at ? new Date(user.attributes.created_at) : undefined,
    lastSignIn: user.attributes.last_sign_in_at ? new Date(user.attributes.last_sign_in_at) : undefined,
  };
}

// ─── Block Pages ──────────────────────────────────────────────

export function mapBlockPage(bp: DnsFilterBlockPage): DnsBlockPage {
  return {
    id: bp.id,
    name: bp.attributes.name,
    organizationId: bp.attributes.organization_id?.toString(),
    orgName: bp.attributes.block_org_name,
    email: bp.attributes.block_email_addr,
    logoUuid: bp.attributes.block_logo_uuid,
  };
}

// ─── Scheduled Policies ───────────────────────────────────────

export function mapScheduledPolicy(sp: DnsFilterScheduledPolicy): DnsScheduledPolicy {
  return {
    id: sp.id,
    name: sp.attributes.name,
    organizationId: sp.attributes.organization_id?.toString(),
    policyIds: sp.attributes.policy_ids,
    timezone: sp.attributes.timezone,
  };
}

// ─── Applications ─────────────────────────────────────────────

export function mapApplication(app: DnsFilterApplication): DnsApplication {
  return {
    id: app.id,
    name: app.attributes.name,
    displayName: app.attributes.display_name,
    description: app.attributes.description,
    homePageUrl: app.attributes.home_page_url,
    icon: app.attributes.icon ?? app.attributes.favicon,
    categoryIds: app.relationships?.categories?.data?.map((c) => c.id),
  };
}

export function mapApplicationCategory(cat: DnsFilterApplicationCategory): DnsApplicationCategory {
  return {
    id: cat.id,
    name: cat.attributes.name,
    description: cat.attributes.description,
  };
}

// ─── Domain Lookup ───────────────────────────────────────────

export function mapDomainLookup(
  data: { attributes?: { host?: string; name?: string }; relationships?: { categories?: { data: DnsFilterIdType[] } }; id?: number; name?: string; category?: string },
  categoryLookup?: Map<string, string>
): DnsDomainLookup {
  const categories = (data.relationships?.categories?.data ?? []).map((ref: DnsFilterIdType) => ({
    id: ref.id,
    name: categoryLookup?.get(ref.id) ?? `Category ${ref.id}`,
  }));

  return {
    domain: data.attributes?.host ?? data.attributes?.name ?? "",
    host: data.attributes?.host,
    categories,
    application: data.id && data.name
      ? { id: data.id as number, name: data.name as string, category: (data.category as string) ?? "" }
      : undefined,
  };
}
