"use client";

import Link from "next/link";
import { Ticket, ArrowUpRight } from "lucide-react";

export function RecentTicketsModule() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
        <Ticket className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No tickets</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Connect your PSA to see tickets here. AI will auto-triage incoming alerts.
      </p>
      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
      >
        Connect PSA
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
