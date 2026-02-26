"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PbxSsoButtonProps {
  instanceId: string;
  disabled?: boolean;
  compact?: boolean;
}

export function PbxSsoButton({
  instanceId,
  disabled,
  compact,
}: PbxSsoButtonProps) {
  const [loading, setLoading] = useState(false);

  const ssoMutation = trpc.threecx.getSsoUrl.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      setLoading(false);
    },
    onError: () => {
      setLoading(false);
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger row click
    setLoading(true);
    ssoMutation.mutate({ instanceId });
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
        "border border-border bg-transparent hover:bg-accent",
        "text-muted-foreground hover:text-foreground",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        compact ? "px-2 py-1" : "px-3 py-1.5"
      )}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ExternalLink className="h-3 w-3" />
      )}
      {!compact && "Open Admin"}
    </button>
  );
}
