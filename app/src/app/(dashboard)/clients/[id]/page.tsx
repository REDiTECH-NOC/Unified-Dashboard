"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Phone,
  Globe,
  MapPin,
  Users,
  Monitor,
  FileText,
  Shield,
  Link2,
  Unlink,
  Save,
  Loader2,
  ChevronRight,
  Mail,
  Smartphone,
  Star,
  Server,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { ClientBillingTab } from "@/app/(dashboard)/billing/_components/client-billing-tab";

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { relative } = useTimezone();
  const utils = trpc.useUtils();
  const id = params.id as string;

  // ── Data ──
  const company = trpc.company.getById.useQuery({ id }, { staleTime: 30_000 });
  const threecxInstances = trpc.threecx.listInstances.useQuery(undefined, {
    staleTime: 60_000,
  });

  // ── Custom Fields State ──
  const [afterHours, setAfterHours] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [hasEdited, setHasEdited] = useState(false);

  // Initialize from server data
  if (company.data && afterHours === null && notes === null && !hasEdited) {
    // Only set once on first load
    if (afterHours === null) setAfterHours(company.data.afterHoursAlertProcedure ?? "");
    if (notes === null) setNotes(company.data.notes ?? "");
  }

  // ── Mutations ──
  const updateFields = trpc.company.updateCustomFields.useMutation({
    onSuccess: () => {
      utils.company.getById.invalidate({ id });
      setHasEdited(false);
    },
  });

  const linkThreecx = trpc.company.linkThreecx.useMutation({
    onSuccess: () => {
      utils.company.getById.invalidate({ id });
      utils.threecx.listInstances.invalidate();
    },
  });

  const unlinkThreecx = trpc.company.unlinkThreecx.useMutation({
    onSuccess: () => {
      utils.company.getById.invalidate({ id });
      utils.threecx.listInstances.invalidate();
    },
  });

  // ── 3CX linking state ──
  const [selectedThreecx, setSelectedThreecx] = useState("");

  // Available (unlinked) 3CX instances
  const availableThreecx = (threecxInstances.data ?? []).filter(
    (inst) => !inst.company || inst.company.id === id
  );
  const unlinkedThreecx = availableThreecx.filter((inst) => !inst.company);

  function handleSaveFields() {
    updateFields.mutate({
      id,
      afterHoursAlertProcedure: afterHours || null,
      notes: notes || null,
    });
  }

  function handleLinkThreecx() {
    if (!selectedThreecx) return;
    linkThreecx.mutate({ companyId: id, threecxInstanceId: selectedThreecx });
    setSelectedThreecx("");
  }

  if (company.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (company.error || !company.data) {
    return (
      <div className="space-y-4">
        <Link
          href="/clients"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </Link>
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Company not found</p>
        </div>
      </div>
    );
  }

  const c = company.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/clients"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold truncate">{c.name}</h2>
            <Badge
              variant="secondary"
              className={cn(
                "h-5 text-[10px]",
                c.status === "Active"
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-zinc-400 border-zinc-500/30 bg-zinc-500/10"
              )}
            >
              {c.status}
            </Badge>
            {c.type && (
              <span className="text-xs text-muted-foreground">{c.type}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            CW #{c.psaSourceId}
            {c.identifier && ` · ${c.identifier}`}
            {" · "}
            Last synced {relative(c.lastSyncedAt)}
          </p>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Info + Custom Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Address Info */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Company Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {c.phone && (
                  <div className="flex items-center gap-2 text-xs">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.website && (
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <a
                      href={
                        c.website.startsWith("http")
                          ? c.website
                          : `https://${c.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {c.website}
                    </a>
                  </div>
                )}
              </div>
              <div>
                {c.addressLine1 && (
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div>{c.addressLine1}</div>
                      {c.addressLine2 && <div>{c.addressLine2}</div>}
                      <div className="text-muted-foreground">
                        {[c.city, c.state, c.zip]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* After-Hours Alert Procedure */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              After-Hours Alert Procedure
            </h3>
            <textarea
              value={afterHours ?? ""}
              onChange={(e) => {
                setAfterHours(e.target.value);
                setHasEdited(true);
              }}
              placeholder="Enter the after-hours alert escalation procedure for this client..."
              className="w-full h-28 rounded-md border border-border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </section>

          {/* Notes */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Admin Notes
            </h3>
            <textarea
              value={notes ?? ""}
              onChange={(e) => {
                setNotes(e.target.value);
                setHasEdited(true);
              }}
              placeholder="General notes about this company..."
              className="w-full h-24 rounded-md border border-border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </section>

          {/* Save button */}
          {hasEdited && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveFields}
                disabled={updateFields.isPending}
              >
                {updateFields.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {updateFields.isSuccess && !hasEdited && (
            <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2.5 text-xs text-green-400">
              Changes saved successfully
            </div>
          )}

          {/* Contacts */}
          {c.contacts && c.contacts.length > 0 && (
            <section className="rounded-lg border border-border/50 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Contacts ({c.contacts.length})
                </h3>
              </div>
              <div className="divide-y divide-border/30">
                {c.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="px-4 py-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">
                            {contact.firstName} {contact.lastName}
                          </span>
                          {contact.defaultFlag && (
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                        {contact.title && (
                          <span className="text-[10px] text-muted-foreground">
                            {contact.title}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.mobilePhone && (
                        <span className="flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          {contact.mobilePhone}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Billing Reconciliation */}
          <ClientBillingTab companyId={id} />

          {/* Sites */}
          {c.sites && c.sites.length > 0 && (
            <section className="rounded-lg border border-border/50 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Sites ({c.sites.length})
                </h3>
              </div>
              <div className="divide-y divide-border/30">
                {c.sites.map((site) => (
                  <div
                    key={site.id}
                    className={cn(
                      "px-4 py-2.5 flex items-center justify-between",
                      site.inactiveFlag && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium">{site.name}</span>
                      {site.primaryFlag && (
                        <Badge
                          variant="secondary"
                          className="h-4 text-[10px] text-blue-400 border-blue-500/30"
                        >
                          Primary
                        </Badge>
                      )}
                      {site.inactiveFlag && (
                        <Badge
                          variant="secondary"
                          className="h-4 text-[10px] text-zinc-400"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-4 flex-shrink-0">
                      {site.addressLine1 && (
                        <span>
                          {site.addressLine1}
                          {site.city && `, ${site.city}`}
                          {site.state && ` ${site.state}`}
                        </span>
                      )}
                      {site.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {site.phone}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: 3CX + Integration Mappings + Stats */}
        <div className="space-y-6">
          {/* 3CX Phone Systems */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-400" />
              3CX Phone Systems
            </h3>

            {/* Linked instances */}
            {c.threecxInstances && c.threecxInstances.length > 0 ? (
              <div className="space-y-2">
                {c.threecxInstances.map((inst) => (
                  <div
                    key={inst.id}
                    className="rounded-md border border-border/50 bg-muted/20 p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium flex items-center gap-1.5">
                        <Server className="h-3 w-3 text-green-400" />
                        {inst.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground hover:text-red-400"
                        onClick={() =>
                          unlinkThreecx.mutate({
                            threecxInstanceId: inst.id,
                          })
                        }
                        disabled={unlinkThreecx.isPending}
                      >
                        <Unlink className="h-3 w-3 mr-1" />
                        Unlink
                      </Button>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {inst.fqdn}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {inst.extensionsRegistered ?? 0}/
                      {inst.extensionsTotal ?? 0} ext · {inst.trunksRegistered ?? 0}/
                      {inst.trunksTotal ?? 0} trunks
                      {(inst.callsActive ?? 0) > 0 && (
                        <span className="text-green-400">
                          {" · "}
                          {inst.callsActive} active
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-4 text-[10px]",
                        inst.status === "online"
                          ? "text-green-400 border-green-500/30"
                          : "text-zinc-400 border-zinc-500/30"
                      )}
                    >
                      {inst.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No 3CX instance linked
              </p>
            )}

            {/* Link new instance */}
            {unlinkedThreecx.length > 0 && (
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/30">
                <select
                  value={selectedThreecx}
                  onChange={(e) => setSelectedThreecx(e.target.value)}
                  className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="">Link 3CX instance...</option>
                  {unlinkedThreecx.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.fqdn})
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!selectedThreecx || linkThreecx.isPending}
                  onClick={handleLinkThreecx}
                >
                  {linkThreecx.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
          </section>

          {/* Integration Mappings */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Integration Mappings
            </h3>
            {c.integrationMappings.length > 0 ? (
              <div className="space-y-1.5">
                {c.integrationMappings.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs rounded-md border border-border/30 px-2.5 py-1.5"
                  >
                    <span className="font-medium">{m.toolId}</span>
                    <span className="text-muted-foreground truncate ml-2">
                      {m.externalName || m.externalId}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No integrations mapped
              </p>
            )}
          </section>

          {/* Summary Stats */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border/30 p-2 text-center">
                <div className="text-lg font-bold">
                  {c.contacts?.length ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Contacts
                </div>
              </div>
              <div className="rounded-md border border-border/30 p-2 text-center">
                <div className="text-lg font-bold">
                  {c.sites?.length ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">Sites</div>
              </div>
              <div className="rounded-md border border-border/30 p-2 text-center">
                <div className="text-lg font-bold">
                  {c._count?.configurations ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Configs
                </div>
              </div>
              <div className="rounded-md border border-border/30 p-2 text-center">
                <div className="text-lg font-bold">
                  {c._count?.agreements ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Agreements
                </div>
              </div>
            </div>
          </section>

          {/* Sync Info */}
          <section className="rounded-lg border border-border/50 bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Sync Info
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-4 text-[10px]",
                    c.syncSource === "auto"
                      ? "text-blue-400 border-blue-500/30"
                      : "text-purple-400 border-purple-500/30"
                  )}
                >
                  {c.syncSource}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sync</span>
                <span
                  className={
                    c.syncEnabled ? "text-green-400" : "text-zinc-400"
                  }
                >
                  {c.syncEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CW ID</span>
                <span>{c.psaSourceId}</span>
              </div>
              {c.identifier && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CW Code</span>
                  <span>{c.identifier}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
