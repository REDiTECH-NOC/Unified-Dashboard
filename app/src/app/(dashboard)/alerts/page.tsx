import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, Mail, Monitor } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Alert Triage</h2>
        <p className="text-sm text-muted-foreground">
          Unified alert queue from all security and monitoring tools
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "SentinelOne", icon: Shield, count: 0 },
          { label: "Blackpoint", icon: Shield, count: 0 },
          { label: "Avanan", icon: Mail, count: 0 },
          { label: "NinjaRMM", icon: Monitor, count: 0 },
        ].map((tool) => (
          <Card key={tool.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <tool.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{tool.count}</p>
                <p className="text-xs text-muted-foreground">{tool.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm font-medium">No alerts yet</p>
          <p className="text-xs">Connect security tools in Settings to start receiving alerts</p>
          <p className="mt-4 text-xs">Phase 2: SentinelOne AI analysis, VirusTotal lookups, quick actions</p>
        </CardContent>
      </Card>
    </div>
  );
}
