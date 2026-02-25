"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  FileText,
  Hash,
  Award,
  Globe,
} from "lucide-react";

/* ─── TYPES ────────────────────────────────────────────── */

interface CreateExclusionDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExclusionType = "path" | "hash" | "certificate" | "browser";
type OsType = "windows" | "macos" | "linux";

const EXCLUSION_TYPES: { id: ExclusionType; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: "path", label: "Path", icon: FileText, placeholder: "C:\\Program Files\\Example\\*" },
  { id: "hash", label: "Hash", icon: Hash, placeholder: "SHA1 hash value" },
  { id: "certificate", label: "Certificate", icon: Award, placeholder: "Certificate signer identity" },
  { id: "browser", label: "Browser", icon: Globe, placeholder: "Browser extension ID" },
];

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function CreateExclusionDialog({ open, onClose }: CreateExclusionDialogProps) {
  const [type, setType] = useState<ExclusionType>("path");
  const [value, setValue] = useState("");
  const [osType, setOsType] = useState<OsType>("windows");
  const [description, setDescription] = useState("");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const sites = trpc.edr.getSites.useQuery(undefined, { staleTime: 15 * 60_000 });
  const createExclusion = trpc.edr.createExclusion.useMutation({
    onSuccess: () => {
      utils.edr.getExclusions.invalidate();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (!open) return null;

  const currentType = EXCLUSION_TYPES.find((t) => t.id === type)!;

  async function handleSubmit() {
    if (!value.trim()) {
      setError("Value is required");
      return;
    }
    setError(null);
    await createExclusion.mutateAsync({
      type,
      value: value.trim(),
      osType,
      siteIds: selectedSiteIds.length > 0 ? selectedSiteIds : undefined,
      description: description.trim() || undefined,
    });
  }

  function toggleSite(siteId: string) {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] bg-card border border-border rounded-xl shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-card border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Add Exclusion</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Exclusion Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EXCLUSION_TYPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setType(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors",
                    type === id
                      ? "border-red-500/50 bg-red-500/10 text-foreground"
                      : "border-border bg-accent/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Value
            </label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={currentType.placeholder}
              className="w-full h-9 px-3 rounded-lg bg-accent border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </div>

          {/* OS Type */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              OS Type
            </label>
            <div className="flex gap-2">
              {(["windows", "macos", "linux"] as const).map((os) => (
                <button
                  key={os}
                  onClick={() => setOsType(os)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    osType === os
                      ? "border-red-500/50 bg-red-500/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {os === "macos" ? "macOS" : os.charAt(0).toUpperCase() + os.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Description <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why is this exclusion needed?"
              className="w-full h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </div>

          {/* Site Scope */}
          {sites.data && sites.data.length > 0 && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Scope <span className="text-muted-foreground/60">(leave empty for all sites)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {sites.data.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => toggleSite(site.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                      selectedSiteIds.includes(site.id)
                        ? "border-red-500/50 bg-red-500/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {site.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-4 bg-card border-t border-border">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-accent hover:bg-accent/80 text-sm font-medium text-foreground border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createExclusion.isPending || !value.trim()}
            className="h-8 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {createExclusion.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Exclusion
          </button>
        </div>
      </div>
    </div>
  );
}
