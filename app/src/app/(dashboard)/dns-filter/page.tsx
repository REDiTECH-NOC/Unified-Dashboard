"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect /dns-filter to /network?tab=dns-filter
 * DNS Filter lives inside the Network page as a tab.
 */
export default function DnsFilterRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/network?tab=dns-filter");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
