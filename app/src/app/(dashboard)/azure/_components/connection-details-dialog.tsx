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
import { Copy, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ConnectionDetailsDialogProps {
  databaseName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionDetailsDialog({
  databaseName,
  open,
  onOpenChange,
}: ConnectionDetailsDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data, isLoading } = trpc.infrastructure.getConnectionDetails.useQuery(
    { databaseName: databaseName! },
    { enabled: !!databaseName && open }
  );

  function handleClose() {
    setShowPassword(false);
    setCopiedField(null);
    onOpenChange(false);
  }

  async function copyToClipboard(field: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function copyAll() {
    if (!data) return;
    const text = [
      `Host: ${data.host}`,
      `Port: ${data.port}`,
      `Database: ${data.databaseName}`,
      `Username: ${data.username}`,
      `Password: ${data.password || "(unavailable)"}`,
      `SSL: ${data.sslMode}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedField("all");
    setTimeout(() => setCopiedField(null), 2000);
  }

  const fields = data
    ? [
        { label: "Host", value: data.host, key: "host" },
        { label: "Port", value: String(data.port), key: "port" },
        { label: "Database", value: data.databaseName, key: "database" },
        { label: "Username", value: data.username, key: "username" },
        {
          label: "Password",
          value: data.password || "(not in Key Vault)",
          key: "password",
          secret: true,
        },
        { label: "SSL", value: data.sslMode, key: "ssl" },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connection Details</DialogTitle>
          <DialogDescription>
            {databaseName ? (
              <>Connection info for <span className="font-mono">{databaseName}</span></>
            ) : (
              "Loading..."
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {fields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="text-xs text-muted-foreground w-20">{field.label}</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-xs font-mono text-foreground truncate max-w-[250px]">
                    {field.secret && !showPassword
                      ? "••••••••••••"
                      : field.value}
                  </span>
                  {field.secret && (
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  )}
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={copyAll} disabled={!data}>
            {copiedField === "all" ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy All
          </Button>
          <Button onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
