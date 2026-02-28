"use client";

import { KeyRound, Settings } from "lucide-react";
import Link from "next/link";

export function KeeperNotConnected() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
      <KeyRound className="h-12 w-12 mb-4 text-zinc-600" />
      <p className="text-lg font-medium text-zinc-400">
        Keeper Security not configured
      </p>
      <p className="text-sm mt-1">
        Add your Keeper MSP API credentials to get started.
      </p>
      <Link
        href="/settings/integrations"
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors"
      >
        <Settings className="h-4 w-4" />
        Go to Integrations
      </Link>
    </div>
  );
}
