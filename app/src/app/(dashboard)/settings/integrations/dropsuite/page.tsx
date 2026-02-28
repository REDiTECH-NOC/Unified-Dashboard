"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DropsuiteConnectionCard } from "./_components/dropsuite-connection-card";
import { DropsuiteCustomerMapping } from "./_components/dropsuite-customer-mapping";

export default function DropsuiteSettingsPage() {
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
          <h2 className="text-2xl font-bold">DropSuite (NinjaOne SaaS Backup)</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection and map organizations to clients
          </p>
        </div>
      </div>

      <DropsuiteConnectionCard />
      <DropsuiteCustomerMapping />
    </div>
  );
}
