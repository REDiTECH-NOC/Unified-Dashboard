"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  X,
  ChevronDown,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

interface EditInstance {
  id: string;
  name: string;
  fqdn: string;
  extensionNumber: string;
  companyId: string | null;
  companyName: string | null;
  localIp: string | null;
  sshUsername: string | null;
}

interface PbxAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editInstance?: EditInstance | null;
}

export function PbxAddDialog({
  open,
  onOpenChange,
  editInstance,
}: PbxAddDialogProps) {
  const isEdit = !!editInstance;
  const utils = trpc.useUtils();

  // Form state
  const [name, setName] = useState("");
  const [fqdn, setFqdn] = useState("");
  const [extensionNumber, setExtensionNumber] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState("");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);

  // SSO deployment state
  const [ssoExpanded, setSsoExpanded] = useState(false);
  const [deploySso, setDeploySso] = useState(false);
  const [localIp, setLocalIp] = useState("");
  const [sshUsername, setSshUsername] = useState("root");
  const [sshPassword, setSshPassword] = useState("");

  // Test connection state
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message?: string;
    latencyMs?: number;
  } | null>(null);

  // Load companies for dropdown
  const { data: companies } = trpc.company.list.useQuery(
    { searchTerm: companyName || undefined, page: 1, pageSize: 20 },
    { staleTime: 60_000, enabled: companyDropdownOpen && companyName.length > 0 }
  );

  // Mutations
  const addMutation = trpc.threecx.addInstance.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
      utils.threecx.listInstances.invalidate();
      onOpenChange(false);
    },
  });

  const updateMutation = trpc.threecx.updateInstance.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
      utils.threecx.listInstances.invalidate();
      onOpenChange(false);
    },
  });

  const testMutation = trpc.threecx.testConnection.useMutation({
    onSuccess: (data) => setTestResult(data),
    onError: (err) =>
      setTestResult({ ok: false, message: err.message }),
  });

  // Close company dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset form when dialog opens/closes or editInstance changes
  useEffect(() => {
    if (open && editInstance) {
      setName(editInstance.name);
      setFqdn(editInstance.fqdn);
      setExtensionNumber(editInstance.extensionNumber);
      setPassword("");
      setCompanyId(editInstance.companyId ?? "");
      setCompanyName(editInstance.companyName ?? "");
      setLocalIp(editInstance.localIp ?? "");
      setSshUsername(editInstance.sshUsername ?? "root");
      setSshPassword("");
      setSsoExpanded(!!editInstance.localIp);
      setDeploySso(false);
    } else if (open && !editInstance) {
      setName("");
      setFqdn("");
      setExtensionNumber("");
      setPassword("");
      setCompanyId("");
      setCompanyName("");
      setLocalIp("");
      setSshUsername("root");
      setSshPassword("");
      setSsoExpanded(false);
      setDeploySso(false);
    }
    setTestResult(null);
    setCompanyDropdownOpen(false);
  }, [open, editInstance]);

  const ssoFieldsValid = !ssoExpanded || (localIp && sshPassword) || (isEdit && localIp);

  const canSave = isEdit
    ? name && fqdn && extensionNumber && ssoFieldsValid
    : name && fqdn && extensionNumber && password && ssoFieldsValid;

  const saving = addMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!canSave) return;

    if (isEdit) {
      updateMutation.mutate({
        id: editInstance!.id,
        name,
        fqdn,
        extensionNumber,
        password: password || undefined,
        companyId: companyId || null,
        companyName: companyId ? null : (companyName || null),
        localIp: ssoExpanded ? (localIp || null) : undefined,
        sshUsername: ssoExpanded ? (sshUsername || null) : undefined,
        sshPassword: ssoExpanded && sshPassword ? sshPassword : undefined,
      });
    } else {
      addMutation.mutate({
        name,
        fqdn,
        extensionNumber,
        password,
        companyId: companyId || undefined,
        companyName: companyId ? undefined : (companyName || undefined),
        localIp: ssoExpanded ? localIp : undefined,
        sshUsername: ssoExpanded ? sshUsername : undefined,
        sshPassword: ssoExpanded && sshPassword ? sshPassword : undefined,
        deploySso: ssoExpanded && deploySso ? true : undefined,
      });
    }
  };

  const handleTest = () => {
    if (!isEdit) return;
    setTestResult(null);
    testMutation.mutate({ id: editInstance!.id });
  };

  const handleSelectCompany = (id: string, cName: string) => {
    setCompanyId(id);
    setCompanyName(cName);
    setCompanyDropdownOpen(false);
  };

  const handleClearCompany = () => {
    setCompanyId("");
    setCompanyName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit PBX Instance" : "Add PBX Instance"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Name */}
          <div>
            <label className={labelClass}>Name *</label>
            <input
              className={inputClass}
              placeholder="e.g. REDiTECH PBX"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* FQDN */}
          <div>
            <label className={labelClass}>FQDN / Address *</label>
            <input
              className={inputClass}
              placeholder="e.g. reditech.3cx.us"
              value={fqdn}
              onChange={(e) => setFqdn(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Domain or IP of the PBX. Do not include https://
            </p>
          </div>

          {/* Extension + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Extension Number *</label>
              <input
                className={inputClass}
                placeholder="e.g. 10000"
                value={extensionNumber}
                onChange={(e) => setExtensionNumber(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>
                Password {isEdit ? "" : "*"}
              </label>
              <input
                type="password"
                className={inputClass}
                placeholder={isEdit ? "Leave blank to keep" : "Web client password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Company — free-text with optional CW company linking */}
          <div ref={companyRef} className="relative">
            <label className={labelClass}>Company</label>
            {companyId ? (
              <div className="flex items-center gap-2">
                <div className={cn(inputClass, "flex items-center gap-2")}>
                  <span className="flex-1 truncate">{companyName}</span>
                  <span className="text-[10px] text-green-500 shrink-0">Linked</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearCompany}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <input
                className={inputClass}
                placeholder="Type a company name or search to link..."
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setCompanyId("");
                  if (e.target.value.length > 0) {
                    setCompanyDropdownOpen(true);
                  } else {
                    setCompanyDropdownOpen(false);
                  }
                }}
                onFocus={() => {
                  if (companyName.length > 0) setCompanyDropdownOpen(true);
                }}
              />
            )}

            {/* Company search dropdown */}
            {companyDropdownOpen && !companyId && (companies?.data?.length ?? 0) > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {companies?.data?.map((c: { id: string; name: string }) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCompany(c.id, c.name)}
                    className="flex items-center w-full px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors text-left"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground mt-1">
              Type any name, or select a match to link to a ConnectWise client
            </p>
          </div>

          {/* SSO Deployment */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setSsoExpanded(!ssoExpanded)}
              className="flex items-center justify-between w-full px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Upload className="h-3.5 w-3.5" />
                SSO File Deployment
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  ssoExpanded && "rotate-180"
                )}
              />
            </button>

            {ssoExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                <p className="text-[10px] text-muted-foreground">
                  Deploy SSO helper files to the PBX via the on-prem relay agent. Requires SSH access to the PBX.
                </p>

                <div>
                  <label className={labelClass}>Local IP *</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 10.0.1.50"
                    value={localIp}
                    onChange={(e) => setLocalIp(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>SSH Username</label>
                    <input
                      className={inputClass}
                      placeholder="root"
                      value={sshUsername}
                      onChange={(e) => setSshUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      SSH Password {isEdit ? "" : "*"}
                    </label>
                    <input
                      type="password"
                      className={inputClass}
                      placeholder={isEdit ? "Leave blank to keep" : "SSH password"}
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                    />
                  </div>
                </div>

                {!isEdit && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deploySso}
                      onChange={(e) => setDeploySso(e.target.checked)}
                      className="rounded border-border bg-accent h-3.5 w-3.5 accent-red-500"
                    />
                    Deploy SSO files now
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div
              className={cn(
                "rounded-lg p-3 text-xs flex items-center gap-2",
                testResult.ok
                  ? "bg-green-500/10 border border-green-500/30 text-green-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              )}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{testResult.message ?? (testResult.ok ? "Connection successful" : "Connection failed")}</span>
              {testResult.latencyMs !== undefined && (
                <span className="text-muted-foreground">
                  {testResult.latencyMs}ms
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {(addMutation.error || updateMutation.error) && (
            <div className="rounded-lg p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400">
              {addMutation.error?.message || updateMutation.error?.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {isEdit && (
                <button
                  onClick={handleTest}
                  disabled={testMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  Test Connection
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {isEdit ? "Save Changes" : "Add PBX"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
