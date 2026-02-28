/**
 * IT Glue Permission Resolution — resolves hierarchical access rules.
 *
 * Hierarchy: Org → Section → Category → Individual Asset
 * Each level inherits from parent. Most specific rule wins.
 * Across multiple groups, most permissive result wins (union of access).
 * No matching rule = DENIED (deny-by-default).
 *
 * Integrates with the existing 3-tier permission system:
 *   1. Base permissions (documentation.view, etc.) — checked first by requirePerm()
 *   2. IT Glue permission groups — checked second by this module
 */

import { prisma } from "./prisma";

// Use string literal type until Prisma client is regenerated with new schema
type ITGlueAccessMode = "READ_WRITE" | "READ_ONLY" | "DENIED";

export interface ITGlueAccessResult {
  allowed: boolean;
  mode: ITGlueAccessMode;
  groupName?: string;
  ruleSpecificity?: number; // 0=org, 1=section, 2=category, 3=asset
}

interface RuleRecord {
  id: string;
  groupId: string;
  orgId: string;
  section: string | null;
  categoryId: string | null;
  assetId: string | null;
  accessMode: ITGlueAccessMode;
}

interface GroupWithRules {
  groupId: string;
  groupName: string;
  rules: RuleRecord[];
}

const ACCESS_PRIORITY: Record<ITGlueAccessMode, number> = {
  READ_WRITE: 2,
  READ_ONLY: 1,
  DENIED: 0,
};

// ─── Group Resolution ───────────────────────────────────────────────

/**
 * Get all IT Glue permission group IDs for a user (direct + via PermissionRoles).
 */
export async function getITGlueGroupIdsForUser(userId: string): Promise<string[]> {
  // Direct assignments
  const directGroups = await prisma.iTGluePermissionGroupUser.findMany({
    where: { userId },
    select: { groupId: true },
  });

  // Via PermissionRoles: user → UserPermissionRole → PermissionRole → ITGluePermissionGroupRole
  const roleGroups = await prisma.iTGluePermissionGroupRole.findMany({
    where: {
      permissionRole: {
        users: { some: { userId } },
      },
    },
    select: { groupId: true },
  });

  const allGroupIds = new Set([
    ...directGroups.map((g) => g.groupId),
    ...roleGroups.map((g) => g.groupId),
  ]);

  return Array.from(allGroupIds);
}

/**
 * Get all IT Glue permission groups with their assignment source.
 */
export async function getITGlueGroupsForUser(
  userId: string
): Promise<Array<{ groupId: string; groupName: string; assignmentType: "direct" | "role"; roleName?: string }>> {
  const directAssignments = await prisma.iTGluePermissionGroupUser.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true } } },
  });

  const roleAssignments = await prisma.iTGluePermissionGroupRole.findMany({
    where: {
      permissionRole: {
        users: { some: { userId } },
      },
    },
    include: {
      group: { select: { id: true, name: true } },
      permissionRole: { select: { name: true } },
    },
  });

  const result: Array<{ groupId: string; groupName: string; assignmentType: "direct" | "role"; roleName?: string }> = [];
  const seen = new Set<string>();

  for (const d of directAssignments) {
    result.push({ groupId: d.group.id, groupName: d.group.name, assignmentType: "direct" });
    seen.add(d.group.id);
  }

  for (const r of roleAssignments) {
    if (!seen.has(r.group.id)) {
      result.push({
        groupId: r.group.id,
        groupName: r.group.name,
        assignmentType: "role",
        roleName: r.permissionRole.name,
      });
      seen.add(r.group.id);
    }
  }

  return result;
}

// ─── Rule Matching ──────────────────────────────────────────────────

/**
 * Score a rule's specificity and check if it matches the request.
 * Returns null if the rule doesn't match.
 */
function matchRule(
  rule: RuleRecord,
  orgId: string,
  section?: string,
  categoryId?: string,
  assetId?: string
): { specificity: number; mode: ITGlueAccessMode } | null {
  // Wildcard org rule — matches any org at specificity -1 (below org-level)
  if (rule.orgId === "*" && !rule.section && !rule.categoryId && !rule.assetId) {
    return { specificity: -1, mode: rule.accessMode };
  }

  // Rule must be for the same org
  if (rule.orgId !== orgId) return null;

  // Level 0: org-only rule (all nulls)
  if (!rule.section && !rule.categoryId && !rule.assetId) {
    return { specificity: 0, mode: rule.accessMode };
  }

  // Level 1: section-level rule
  if (rule.section && !rule.categoryId && !rule.assetId) {
    if (!section || rule.section !== section) return null;
    return { specificity: 1, mode: rule.accessMode };
  }

  // Level 2: category-level rule
  if (rule.section && rule.categoryId && !rule.assetId) {
    if (!section || rule.section !== section) return null;
    if (!categoryId || rule.categoryId !== categoryId) return null;
    return { specificity: 2, mode: rule.accessMode };
  }

  // Level 3: asset-level rule
  if (rule.assetId) {
    if (rule.section && section && rule.section !== section) return null;
    if (!assetId || rule.assetId !== assetId) return null;
    return { specificity: 3, mode: rule.accessMode };
  }

  return null;
}

// ─── Single Resolution ──────────────────────────────────────────────

/**
 * Resolve IT Glue access for a single asset.
 *
 * @param userId - The user to check access for
 * @param orgId - IT Glue organization ID
 * @param section - "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents"
 * @param categoryId - Password category ID or flexible asset type ID
 * @param assetId - Specific IT Glue record ID
 */
export async function resolveITGlueAccess(
  userId: string,
  orgId: string,
  section?: string,
  categoryId?: string,
  assetId?: string
): Promise<ITGlueAccessResult> {
  const groupIds = await getITGlueGroupIdsForUser(userId);

  if (groupIds.length === 0) {
    return { allowed: false, mode: "DENIED" };
  }

  // Load all rules for this user's groups that match the orgId (or wildcard "*")
  const rules = await prisma.iTGluePermissionRule.findMany({
    where: {
      groupId: { in: groupIds },
      orgId: { in: [orgId, "*"] },
    },
    include: {
      group: { select: { name: true } },
    },
  });

  return resolveFromRules(rules, orgId, section, categoryId, assetId);
}

/**
 * Core resolution logic — shared between single and batch resolvers.
 */
function resolveFromRules(
  rules: Array<RuleRecord & { group: { name: string } }>,
  orgId: string,
  section?: string,
  categoryId?: string,
  assetId?: string
): ITGlueAccessResult {
  if (rules.length === 0) {
    return { allowed: false, mode: "DENIED" };
  }

  // Group rules by groupId
  const rulesByGroup = new Map<string, Array<RuleRecord & { group: { name: string } }>>();
  for (const rule of rules) {
    const existing = rulesByGroup.get(rule.groupId) ?? [];
    existing.push(rule);
    rulesByGroup.set(rule.groupId, existing);
  }

  // For each group, find the most specific matching rule
  const groupResults: Array<{ mode: ITGlueAccessMode; groupName: string; specificity: number }> = [];

  for (const [, groupRules] of rulesByGroup) {
    let bestMatch: { specificity: number; mode: ITGlueAccessMode; groupName: string } | null = null;

    for (const rule of groupRules) {
      const match = matchRule(rule, orgId, section, categoryId, assetId);
      if (match && (!bestMatch || match.specificity > bestMatch.specificity)) {
        bestMatch = { ...match, groupName: rule.group.name };
      }
    }

    if (bestMatch) {
      groupResults.push(bestMatch);
    }
  }

  if (groupResults.length === 0) {
    return { allowed: false, mode: "DENIED" };
  }

  // Most permissive across all groups wins
  groupResults.sort((a, b) => ACCESS_PRIORITY[b.mode] - ACCESS_PRIORITY[a.mode]);
  const best = groupResults[0];

  return {
    allowed: best.mode !== "DENIED",
    mode: best.mode,
    groupName: best.groupName,
    ruleSpecificity: best.specificity,
  };
}

// ─── Batch Resolution ───────────────────────────────────────────────

export interface BatchAssetInput {
  orgId: string;
  section: string;
  categoryId?: string;
  assetId: string;
}

/**
 * Efficiently resolve access for many assets at once.
 * Loads all groups + rules in bulk (2 queries), then resolves in memory.
 */
export async function batchResolveITGlueAccess(
  userId: string,
  assets: BatchAssetInput[]
): Promise<Map<string, ITGlueAccessResult>> {
  const results = new Map<string, ITGlueAccessResult>();

  if (assets.length === 0) return results;

  const groupIds = await getITGlueGroupIdsForUser(userId);

  if (groupIds.length === 0) {
    for (const asset of assets) {
      results.set(asset.assetId, { allowed: false, mode: "DENIED" });
    }
    return results;
  }

  // Collect unique orgIds from the asset list (+ wildcard "*")
  const orgIds = [...new Set(assets.map((a) => a.orgId)), "*"];

  // Load ALL rules for these groups + orgs in one query
  const allRules = await prisma.iTGluePermissionRule.findMany({
    where: {
      groupId: { in: groupIds },
      orgId: { in: orgIds },
    },
    include: {
      group: { select: { name: true } },
    },
  });

  // Index rules by orgId for fast lookup
  const rulesByOrg = new Map<string, Array<typeof allRules[number]>>();
  for (const rule of allRules) {
    const existing = rulesByOrg.get(rule.orgId) ?? [];
    existing.push(rule);
    rulesByOrg.set(rule.orgId, existing);
  }

  // Wildcard rules apply to all orgs
  const wildcardRules = rulesByOrg.get("*") ?? [];

  // Resolve each asset (merge org-specific + wildcard rules)
  for (const asset of assets) {
    const orgRules = [...(rulesByOrg.get(asset.orgId) ?? []), ...wildcardRules];
    const result = resolveFromRules(orgRules, asset.orgId, asset.section, asset.categoryId, asset.assetId);
    results.set(asset.assetId, result);
  }

  return results;
}

/**
 * Get all org IDs that a user has any access to (for filtering org lists).
 */
export async function getAllowedOrgIds(userId: string): Promise<Set<string>> {
  const groupIds = await getITGlueGroupIdsForUser(userId);
  if (groupIds.length === 0) return new Set();

  const orgRules = await prisma.iTGluePermissionRule.findMany({
    where: {
      groupId: { in: groupIds },
      section: null, // org-level rules only
      categoryId: null,
      assetId: null,
      accessMode: { not: "DENIED" },
    },
    select: { orgId: true },
    distinct: ["orgId"],
  });

  const orgIds = new Set(orgRules.map((r) => r.orgId));

  // If wildcard "*" rule exists with non-DENIED access, all orgs are allowed
  if (orgIds.has("*")) {
    const allOrgs = await prisma.iTGlueCachedOrg.findMany({
      select: { itGlueId: true },
    });
    return new Set(allOrgs.map((o) => o.itGlueId));
  }

  return orgIds;
}
