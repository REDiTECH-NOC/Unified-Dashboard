import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Clients</h2>
        <p className="text-sm text-muted-foreground">
          Client health scores and overview
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm font-medium">No clients synced yet</p>
          <p className="text-xs">Connect ConnectWise PSA and NinjaRMM to see client data</p>
          <p className="mt-4 text-xs">Phase 2: Client health scores, device counts, alert summaries</p>
        </CardContent>
      </Card>
    </div>
  );
}
