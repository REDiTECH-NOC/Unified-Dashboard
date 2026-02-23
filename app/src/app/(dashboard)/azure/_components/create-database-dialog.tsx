"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CreateDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreatedResult {
  databaseName: string;
  username: string;
  password: string;
  host: string;
  port: number;
  sslMode: string;
}

export function CreateDatabaseDialog({ open, onOpenChange }: CreateDatabaseDialogProps) {
  const utils = trpc.useUtils();
  const [clientName, setClientName] = useState("");
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const createMutation = trpc.infrastructure.createDatabase.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.infrastructure.listDatabases.invalidate();
    },
  });

  function handleClose() {
    setClientName("");
    setResult(null);
    createMutation.reset();
    onOpenChange(false);
  }

  function handleCreate() {
    createMutation.mutate({ clientName: clientName.toLowerCase().trim() });
  }

  async function copyToClipboard(field: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function copyAll() {
    if (!result) return;
    const text = [
      `Host: ${result.host}`,
      `Port: ${result.port}`,
      `Database: ${result.databaseName}`,
      `Username: ${result.username}`,
      `Password: ${result.password}`,
      `SSL: ${result.sslMode}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedField("all");
    setTimeout(() => setCopiedField(null), 2000);
  }

  const previewDbName = clientName ? `${clientName.toLowerCase().trim()}3cx_database` : "";
  const previewUsername = clientName ? `${clientName.toLowerCase().trim()}_tcx` : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create 3CX Database</DialogTitle>
          <DialogDescription>
            Creates a new database, user, and grants for a 3CX PBX client
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Client Name
                </label>
                <Input
                  placeholder="reditech"
                  value={clientName}
                  onChange={(e) =>
                    setClientName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
                  }
                  disabled={createMutation.isPending}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Lowercase letters and numbers only
                </p>
              </div>

              {/* Live preview */}
              {clientName && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Preview</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Database:</span>
                      <span className="font-mono text-foreground">{previewDbName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username:</span>
                      <span className="font-mono text-foreground">{previewUsername}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Password:</span>
                      <span className="text-muted-foreground italic">Auto-generated (32 chars)</span>
                    </div>
                  </div>
                </div>
              )}

              {createMutation.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {createMutation.error.message}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!clientName || createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Database
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Success — show credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                <Check className="h-3.5 w-3.5" />
                Database created successfully
              </div>

              <div className="rounded-lg border border-border divide-y divide-border">
                {[
                  { label: "Host", value: result.host, key: "host" },
                  { label: "Port", value: String(result.port), key: "port" },
                  { label: "Database", value: result.databaseName, key: "database" },
                  { label: "Username", value: result.username, key: "username" },
                  { label: "Password", value: result.password, key: "password" },
                  { label: "SSL", value: result.sslMode, key: "ssl" },
                ].map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground w-20">{field.label}</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="text-xs font-mono text-foreground truncate max-w-[250px]">
                        {field.value}
                      </span>
                      <button
                        onClick={() => copyToClipboard(field.key, field.value)}
                        className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                      >
                        {copiedField === field.key ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Save these credentials now. The password is stored in Key Vault but this is
                  the only time it will be displayed in plaintext.
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => copyAll()}>
                {copiedField === "all" ? (
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copy All
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
