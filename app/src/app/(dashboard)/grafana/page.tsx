"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function AnalyticsPage() {
  const [permitted, setPermitted] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/embed/grafana/api/health")
      .then((res) => {
        setPermitted(res.status !== 403);
      })
      .catch(() => setPermitted(false));
  }, []);

  if (permitted === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!permitted) {
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
