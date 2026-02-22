"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft } from "lucide-react";

interface ThreecxInstanceFormProps {
  instanceId: string | null; // null = add mode
  onBack: () => void;
  onSaved: () => void;
}

export function ThreecxInstanceForm({ instanceId, onBack, onSaved }: ThreecxInstanceFormProps) {
  const isEdit = !!instanceId;

  const [name, setName] = useState("");
  const [fqdn, setFqdn] = useState("");
  const [extensionNumber, setExtensionNumber] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<string>("");

  const { data: instance } = trpc.threecx.getInstance.useQuery(
    { id: instanceId! },
    { enabled: isEdit }
  );

  const { data: companies } = trpc.company.list.useQuery({
    pageSize: 500,
    status: "Active",
  });

  const addInstance = trpc.threecx.addInstance.useMutation({
    onSuccess: () => onSaved(),
  });

  const updateInstance = trpc.threecx.updateInstance.useMutation({
    onSuccess: () => onSaved(),
  });

  // Pre-fill form in edit mode
  useEffect(() => {
    if (instance) {
      setName(instance.name);
      setFqdn(instance.fqdn);
      setExtensionNumber(instance.extensionNumber);
      setPassword("");
      setCompanyId(instance.companyId ?? "");
    }
  }, [instance]);

  // Reset form when switching to add mode
  useEffect(() => {
    if (!isEdit) {
      setName("");
      setFqdn("");
      setExtensionNumber("");
      setPassword("");
      setCompanyId("");
    }
  }, [isEdit]);

  function handleSave() {
    if (isEdit) {
      updateInstance.mutate({
        id: instanceId!,
        name: name || undefined,
        fqdn: fqdn || undefined,
        extensionNumber: extensionNumber || undefined,
        password: password || undefined,
        companyId: companyId || null,
      });
    } else {
      addInstance.mutate({
        name,
        fqdn,
        extensionNumber,
        password,
        companyId: companyId || undefined,
      });
    }
  }

  const isPending = addInstance.isPending || updateInstance.isPending;
  const error = addInstance.error || updateInstance.error;

  const isValid = isEdit
    ? true // edit mode: all fields optional
    : !!name && !!fqdn && !!extensionNumber && !!password;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to instances
      </button>

      <h3 className="text-sm font-semibold">
        {isEdit ? "Edit PBX Instance" : "Add PBX Instance"}
      </h3>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Display Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., JB Dawson — Office PBX"
          className="text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          FQDN
        </label>
        <Input
          value={fqdn}
          onChange={(e) => setFqdn(e.target.value)}
          placeholder="pbx.example.com"
          className="font-mono text-sm"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          The PBX hostname (without https://)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Extension Number
          </label>
          <Input
            value={extensionNumber}
            onChange={(e) => setExtensionNumber(e.target.value)}
            placeholder="e.g., 100"
            className="font-mono text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            System Owner extension
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Password
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "Leave blank to keep existing" : "Extension password"}
            className="font-mono text-sm"
          />
          {isEdit && !password && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave blank to keep the existing password.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Company <span className="text-muted-foreground/50">(optional)</span>
        </label>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">No company assigned</option>
          {companies?.data.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {companies && companies.data.length === 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            No companies imported yet. Import from PSA first.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">{error.message}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : isEdit ? (
            "Update Instance"
          ) : (
            "Add Instance"
          )}
        </Button>
      </div>
    </div>
  );
}
