"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Wand2,
  Check,
  Link2,
  Unlink,
  User,
  Users,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TechMappingCard() {
  const utils = trpc.useUtils();

  // ── Queries ──
  const mappings = trpc.companyMatching.getUserMappings.useQuery();
  const unmatched = trpc.companyMatching.getUnmatchedMembers.useQuery();
  const appUsers = trpc.user.list.useQuery();
  const members = trpc.psa.getMembers.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });

  // ── Mutations ──
  const autoMatch = trpc.companyMatching.autoMatchMembers.useMutation({
    onSuccess: () => {
      utils.companyMatching.getUserMappings.invalidate();
      utils.companyMatching.getUnmatchedMembers.invalidate();
    },
  });

  const mapMember = trpc.companyMatching.mapMember.useMutation({
    onSuccess: () => {
      utils.companyMatching.getUserMappings.invalidate();
      utils.companyMatching.getUnmatchedMembers.invalidate();
    },
  });

  // ── Local state for manual mapping ──
  const [manualSelections, setManualSelections] = useState<
    Record<string, string>
  >({});

  function handleManualMap(cwMemberId: string, cwMemberName: string, cwMemberEmail: string) {
    const userId = manualSelections[cwMemberId];
    if (!userId) return;
    mapMember.mutate({
      userId,
      toolId: "connectwise",
      externalId: cwMemberId,
      externalName: cwMemberName,
      externalEmail: cwMemberEmail,
    });
    setManualSelections((prev) => {
      const next = { ...prev };
      delete next[cwMemberId];
      return next;
    });
  }

  const isLoading =
    mappings.isLoading || unmatched.isLoading || appUsers.isLoading;

  // Build set of already-mapped user IDs and CW member IDs
  const mappedUserIds = new Set(
    (mappings.data ?? []).map((m) => m.userId)
  );
  const mappedCwIds = new Set(
    (mappings.data ?? []).map((m) => m.externalId)
  );

  // Available app users for manual mapping (not already mapped)
  const availableUsers = (appUsers.data ?? []).filter(
    (u) => !mappedUserIds.has(u.id)
  );

  // CW members not yet mapped
  const unmatchedMembers = (unmatched.data?.members ?? []).filter(
    (m) => !mappedCwIds.has(m.id)
  );

  // All CW members for display
  const cwMemberMap = new Map(
    (members.data ?? []).map((m) => [m.id, m])
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Tech Mapping
          </CardTitle>
          <Button
            size="sm"
            className="h-7"
            onClick={() => autoMatch.mutate()}
            disabled={autoMatch.isPending}
          >
            {autoMatch.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Auto-Match by Email
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Map app users to ConnectWise members so &quot;My Tickets&quot; works
          correctly. Auto-match finds exact email matches.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Auto-match result */}
            {autoMatch.isSuccess && (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2.5 text-xs text-green-400 flex items-center gap-2">
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Matched {autoMatch.data.matched} user
                  {autoMatch.data.matched !== 1 ? "s" : ""} by email
                  {autoMatch.data.unmatched > 0 &&
                    ` — ${autoMatch.data.unmatched} CW member${autoMatch.data.unmatched !== 1 ? "s" : ""} still unmatched`}
                </span>
              </div>
            )}

            {autoMatch.error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {autoMatch.error.message}
              </div>
            )}

            {/* Current Mappings */}
            {(mappings.data?.length ?? 0) > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Mapped ({mappings.data?.length})
                </label>
                <div className="rounded-md border border-border/50 divide-y divide-border/30">
                  {mappings.data
                    ?.filter((m) => m.toolId === "connectwise")
                    .map((mapping) => (
                      <div
                        key={mapping.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium truncate">
                              {mapping.user.name ?? mapping.user.email}
                            </span>
                          </div>
                          <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-muted-foreground truncate">
                              {mapping.externalName ?? mapping.externalId}
                            </span>
                            {mapping.externalEmail && (
                              <span className="text-[10px] text-muted-foreground/60 truncate">
                                ({mapping.externalEmail})
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-5 text-[10px] flex-shrink-0",
                            mapping.matchMethod === "auto_email"
                              ? "text-green-400 border-green-500/30"
                              : "text-blue-400 border-blue-500/30"
                          )}
                        >
                          {mapping.matchMethod === "auto_email"
                            ? "auto"
                            : "manual"}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Unmatched CW Members */}
            {unmatchedMembers.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Unmatched CW Members ({unmatchedMembers.length})
                </label>
                <div className="rounded-md border border-border/50 divide-y divide-border/30">
                  {unmatchedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-medium">
                          {member.name}
                        </span>
                        {member.email && (
                          <span className="text-[10px] text-muted-foreground ml-1.5">
                            ({member.email})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <select
                          className="h-7 rounded-md border border-border bg-background px-2 text-xs min-w-[140px]"
                          value={manualSelections[member.id] ?? ""}
                          onChange={(e) =>
                            setManualSelections((prev) => ({
                              ...prev,
                              [member.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select user...</option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name ?? u.email}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            !manualSelections[member.id] ||
                            mapMember.isPending
                          }
                          onClick={() =>
                            handleManualMap(
                              member.id,
                              member.name,
                              member.email
                            )
                          }
                        >
                          {mapMember.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Link2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All matched, none unmatched */}
            {unmatchedMembers.length === 0 &&
              (mappings.data?.filter((m) => m.toolId === "connectwise")
                .length ?? 0) > 0 && (
                <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-400/80 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                  All active CW members are mapped to app users
                </div>
              )}

            {/* No mappings and no members */}
            {(mappings.data?.filter((m) => m.toolId === "connectwise")
              .length ?? 0) === 0 &&
              unmatchedMembers.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No CW members found. Make sure ConnectWise is connected above.
                </div>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
