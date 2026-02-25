"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CoveConnectionCard } from "./_components/cove-connection-card";
import { CoveCustomerMapping } from "./_components/cove-customer-mapping";

export default function CoveSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Cove Data Protection</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection and map Cove customers to clients
          </p>
        </div>
      </div>

      <CoveConnectionCard />
      <CoveCustomerMapping />
    </div>
  );
}
