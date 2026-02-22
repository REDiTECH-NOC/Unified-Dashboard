"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ServerOff, Loader2 } from "lucide-react";

type GrafanaState = "loading" | "permitted" | "denied" | "unavailable";

export default function AnalyticsPage() {
  const [state, setState] = useState<GrafanaState>("loading");

  useEffect(() => {
    fetch("/api/embed/grafana/api/health")
      .then((res) => {
        if (res.status === 403) setState("denied");
        else if (res.status === 502 || res.status === 504) setState("unavailable");
        else if (res.ok) setState("permitted");
        else setState("unavailable");
      })
      .catch(() => setState("unavailable"));
  }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Access Denied</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          You do not have permission to access Grafana analytics. Contact an administrator.
        </p>
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
          <ServerOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Grafana Unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          The Grafana service is not reachable. It may be starting up or not yet configured.
        </p>
      </div>
    );
  }

  return (
    <div className="-mt-4 sm:-mt-5 lg:-mt-6 xl:-mt-8 -mx-4 sm:-mx-5 lg:-mx-6 xl:-mx-8 -mb-4 sm:-mb-5 lg:-mb-6 xl:-mb-8">
      <iframe
        src="/api/embed/grafana"
        className="w-full border-0"
        style={{ height: "100vh" }}
        title="Grafana Analytics"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  );
}
