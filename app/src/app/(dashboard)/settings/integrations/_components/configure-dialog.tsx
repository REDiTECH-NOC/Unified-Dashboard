"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { TOOL_SCHEMAS } from "./tool-schemas";
import { Check, X, Loader2, Zap, Info } from "lucide-react";

interface ConfigureDialogProps {
  toolId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ConfigureDialog({ toolId, onClose, onSaved }: ConfigureDialogProps) {
  const schema = toolId ? TOOL_SCHEMAS[toolId] : null;

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [hasExistingSecrets, setHasExistingSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const { data: existingConfig, isLoading: isLoadingConfig } =
    trpc.integration.getConfig.useQuery(
      { toolId: toolId! },
      { enabled: !!toolId }
    );

  const updateConfig = trpc.integration.updateConfig.useMutation({
    onSuccess: () => {
      onSaved();
    },
  });

  const testConnection = trpc.integration.testConnection.useMutation({
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error) => {
      setTestResult({ success: false, message: error.message });
    },
  });

  // Initialize form when dialog opens or config loads
  useEffect(() => {
    if (!schema) return;

    const values: Record<string, string> = {};
    const secrets: Record<string, boolean> = {};

    for (const field of schema.fields) {
      if (field.type === "password") {
        // Password fields: always start blank, track if existing value stored
        values[field.key] = "";
        secrets[field.key] = !!(existingConfig?.config as Record<string, unknown> | undefined)?.[field.key];
      } else {
        // Non-secret fields: pre-fill from existing config or default
        const existing = (existingConfig?.config as Record<string, unknown> | undefined)?.[field.key];
        values[field.key] = (existing as string) ?? field.defaultValue ?? "";
      }
    }

    setFormValues(values);
    setHasExistingSecrets(secrets);
    setTestResult(null);
  }, [schema, existingConfig]);

  const setField = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  function handleSave() {
    if (!schema || !toolId) return;

    const secretFields = schema.fields
      .filter((f) => f.type === "password")
      .map((f) => f.key);

    updateConfig.mutate({
      toolId,
      config: formValues,
      secretFields,
    });
  }

  function handleTest() {
    if (!toolId) return;
    setTestResult(null);
    testConnection.mutate({ toolId });
  }

  // Validation: all required fields must be filled (or have existing secret)
  const isValid =
    schema?.fields.every((field) => {
      if (!field.required) return true;
      if (field.type === "password") {
        return !!formValues[field.key] || hasExistingSecrets[field.key];
      }
      return !!formValues[field.key];
    }) ?? false;

  return (
    <Dialog open={!!toolId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClose={onClose} className="max-w-lg">
        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : schema ? (
          <>
            <DialogHeader>
              <DialogTitle>Configure {schema.displayName}</DialogTitle>
              <DialogDescription>{schema.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {schema.instructions && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-400" />
                  <p>{schema.instructions}</p>
                </div>
              )}

              {schema.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {field.label}
                    {!field.required && (
                      <span className="text-muted-foreground/50 ml-1">(optional)</span>
                    )}
                  </label>
                  <Input
                    type={field.type === "password" ? "password" : "text"}
                    value={formValues[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={
                      field.type === "password" && hasExistingSecrets[field.key]
                        ? "Leave blank to keep existing"
                        : field.placeholder
                    }
                    className="font-mono text-sm"
                  />
                  {field.type === "password" && hasExistingSecrets[field.key] && !formValues[field.key] && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      A value is already stored. Leave blank to keep the existing value.
                    </p>
                  )}
                  {field.helpText && field.type !== "password" && (
                    <p className="text-[10px] text-muted-foreground mt-1">{field.helpText}</p>
                  )}
                  {field.helpText && field.type === "password" && !(hasExistingSecrets[field.key] && !formValues[field.key]) && (
                    <p className="text-[10px] text-muted-foreground mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}

              {/* Test connection result */}
              {testResult && (
                <div
                  className={
                    "rounded-md border p-3 text-sm flex items-center gap-2 " +
                    (testResult.success
                      ? "border-green-500/30 bg-green-500/5 text-green-400"
                      : "border-red-500/30 bg-red-500/5 text-red-400")
                  }
                >
                  {testResult.success ? (
                    <Check className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <X className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="flex-1 text-xs">{testResult.message}</span>
                  {testResult.latencyMs != null && (
                    <span className="text-[10px] text-muted-foreground">{testResult.latencyMs}ms</span>
                  )}
                </div>
              )}
            </div>

            {updateConfig.error && (
              <p className="text-sm text-red-400">{updateConfig.error.message}</p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!isValid || testConnection.isPending}
                className="mr-auto"
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                )}
                {testConnection.isPending ? "Testing..." : "Test Connection"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={updateConfig.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isValid || updateConfig.isPending}
              >
                {updateConfig.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
