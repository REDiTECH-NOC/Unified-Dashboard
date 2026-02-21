import { Card, CardContent } from "@/components/ui/card";
import { Ticket } from "lucide-react";

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tickets</h2>
        <p className="text-sm text-muted-foreground">
          ConnectWise PSA ticket management
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Ticket className="mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm font-medium">No tickets yet</p>
          <p className="text-xs">Connect ConnectWise PSA in Settings to manage tickets</p>
          <p className="mt-4 text-xs">Phase 2: Full ticket CRUD, AI-assisted creation, search and filter</p>
        </CardContent>
      </Card>
    </div>
  );
}
