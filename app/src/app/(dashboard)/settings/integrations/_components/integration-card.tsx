"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUILT_TOOLS, THREECX_TOOL_ID, SSO_TOOL_ID } from "./tool-schemas";
import { Clock } from "lucide-react";

interface ToolInfo {
  toolId: string;
  displayName: string;
  status: string;
}

interface IntegrationCardProps {
  tool: ToolInfo;
  onConfigure: (toolId: string) => void;
}

export function IntegrationCard({ tool, onConfigure }: IntegrationCardProps) {
  const isBuilt = BUILT_TOOLS.has(tool.toolId) || tool.toolId === THREECX_TOOL_ID;
  const isSso = tool.toolId === SSO_TOOL_ID;

  // SSO is handled separately, shouldn't appear here
  if (isSso) return null;

  return (
    <Card className="relative">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div
            className={
              "h-2 w-2 rounded-full " +
              (tool.status === "connected"
                ? "bg-green-500"
                : tool.status === "error"
                ? "bg-red-500"
                : tool.status === "degraded"
                ? "bg-yellow-500"
                : "bg-muted-foreground/30")
            }
          />
          <div>
            <p className="text-sm font-medium">{tool.displayName}</p>
            <p className="text-[10px] text-muted-foreground">
              {tool.status === "unconfigured"
                ? "Not configured"
                : tool.status.charAt(0).toUpperCase() + tool.status.slice(1)}
            </p>
          </div>
        </div>
        {isBuilt ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConfigure(tool.toolId)}
          >
            Configure
          </Button>
        ) : (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Clock className="h-3 w-3" />
            Coming Soon
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
