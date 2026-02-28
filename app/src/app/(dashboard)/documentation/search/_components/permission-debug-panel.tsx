"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Shield, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export function PermissionDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [testUserId, setTestUserId] = useState<string | undefined>();
  const [testOrgId, setTestOrgId] = useState<string | undefined>();
  const [testSection, setTestSection] = useState<string | undefined>();

  const users = trpc.user.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });

  const cachedOrgs = trpc.itGluePerm.getCachedOrgs.useQuery(undefined, {
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });

  const testResult = trpc.itGluePerm.testAccess.useQuery(
    {
      userId: testUserId!,
      orgId: testOrgId!,
      section: testSection as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents" | undefined,
    },
    {
      enabled: !!testUserId && !!testOrgId,
      staleTime: 0,
    }
  );

  const userGroups = trpc.itGluePerm.getUserGroups.useQuery(
    { userId: testUserId! },
    {
      enabled: !!testUserId,
      staleTime: 30_000,
    }
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Permission Debug Panel
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800">
          <div className="pt-4 space-y-3">
            <p className="text-xs text-zinc-500">Test IT Glue permission resolution for any user.</p>

            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">User</label>
                <Select
                  value={testUserId ?? "none"}
                  onValueChange={(v) => setTestUserId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-white text-sm">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="none" className="text-zinc-500">Select user</SelectItem>
                    {(users.data ?? []).map((u: { id: string; name?: string | null; email: string }) => (
                      <SelectItem key={u.id} value={u.id} className="text-white">
                        {u.name ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Organization</label>
                <Select
                  value={testOrgId ?? "none"}
                  onValueChange={(v) => setTestOrgId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-white text-sm">
                    <SelectValue placeholder="Select org" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="none" className="text-zinc-500">Select org</SelectItem>
                    {(cachedOrgs.data ?? []).map((o: { itGlueId: string; name: string }) => (
                      <SelectItem key={o.itGlueId} value={o.itGlueId} className="text-white">
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Section</label>
                <Select
                  value={testSection ?? "any"}
                  onValueChange={(v) => setTestSection(v === "any" ? undefined : v)}
                >
                  <SelectTrigger className="w-[160px] bg-zinc-900 border-zinc-700 text-white text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="any" className="text-white">Any (org-level)</SelectItem>
                    <SelectItem value="passwords" className="text-white">Passwords</SelectItem>
                    <SelectItem value="flexible_assets" className="text-white">Flexible Assets</SelectItem>
                    <SelectItem value="configurations" className="text-white">Configurations</SelectItem>
                    <SelectItem value="contacts" className="text-white">Contacts</SelectItem>
                    <SelectItem value="documents" className="text-white">Documents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Test Result */}
            {testUserId && testOrgId && testResult.data && (
              <div className="rounded-md bg-zinc-800/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-medium text-white">Result:</span>
                  <Badge
                    className={
                      testResult.data.mode === "READ_WRITE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : testResult.data.mode === "READ_ONLY"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                    }
                  >
                    {testResult.data.mode}
                  </Badge>
                  {testResult.data.groupName && (
                    <span className="text-xs text-zinc-500">
                      via group &quot;{testResult.data.groupName}&quot;
                      {testResult.data.ruleSpecificity !== undefined && (
                        <> (specificity: {testResult.data.ruleSpecificity})</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* User's Groups */}
            {testUserId && userGroups.data && (
              <div className="space-y-1">
                <p className="text-xs text-zinc-400">
                  Groups for this user ({userGroups.data.length}):
                </p>
                {userGroups.data.length === 0 ? (
                  <p className="text-xs text-zinc-500">No IT Glue permission groups assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {userGroups.data.map((g) => (
                      <Badge
                        key={g.groupId}
                        variant="outline"
                        className="border-zinc-600 text-zinc-300"
                      >
                        {g.groupName}
                        <span className="ml-1 text-zinc-500">
                          ({g.assignmentType === "direct" ? "direct" : `via ${g.roleName}`})
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
