"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DnsFilterConnectionCard } from "./_components/dnsfilter-connection-card";
import { DnsFilterCustomerMapping } from "./_components/dnsfilter-customer-mapping";

export default function DnsFilterSettingsPage() {
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
          <h2 className="text-2xl font-bold">DNS Filter</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection and map organizations to clients
          </p>
        </div>
      </div>

      <DnsFilterConnectionCard />
      <DnsFilterCustomerMapping />
    </div>
  );
}
