"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Server,
  Users,
  Phone,
  Radio,
  Settings,
  PhoneOutgoing,
  Headphones,
} from "lucide-react";
import { PbxSsoButton } from "../_components/pbx-sso-button";
import { TabOverview } from "../_components/tab-overview";
import { TabExtensions } from "../_components/tab-extensions";
import { TabTrunks } from "../_components/tab-trunks";
import { TabActiveCalls } from "../_components/tab-active-calls";
import { TabServices } from "../_components/tab-services";
import { TabCallLog } from "../_components/tab-call-log";
import { TabQueues } from "../_components/tab-queues";

const TABS = [
  { id: "overview", label: "Overview", icon: Server },
  { id: "extensions", label: "Extensions", icon: Users },
  { id: "queues", label: "Queues & RGs", icon: Headphones },
  { id: "trunks", label: "Trunks", icon: Radio },
  { id: "calls", label: "Active Calls", icon: Phone },
  { id: "services", label: "Services", icon: Settings },
  { id: "calllog", label: "Call Log", icon: PhoneOutgoing },
] as const;

type TabId = (typeof TABS)[number]["id"];

function statusDotClass(status: string) {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    case "degraded":
      return "bg-yellow-500";
    default:
      return "bg-zinc-500";
  }
}

export default function PbxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.instanceId as string;
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [, startTransition] = useTransition();

  const { data: instance, isLoading } = trpc.threecx.getInstance.useQuery(
    { id: instanceId },
    { retry: false }
  );

  const utils = trpc.useUtils();
  const refreshMutation = trpc.threecx.refreshInstance.useMutation({
    onSuccess: () => {
      utils.threecx.getInstance.invalidate({ id: instanceId });
      utils.threecx.getSystemStatus.invalidate({ instanceId });
      utils.threecx.getSystemHealth.invalidate({ instanceId });
      utils.threecx.getUsers.invalidate({ instanceId });
      utils.threecx.getTrunks.invalidate({ instanceId });
      utils.threecx.getActiveCalls.invalidate({ instanceId });
      utils.threecx.getServices.invalidate({ instanceId });
      utils.threecx.getSystemTelemetry.invalidate({ instanceId });
      utils.threecx.getCallHistory.invalidate({ instanceId });
      utils.threecx.getQueues.invalidate({ instanceId });
      utils.threecx.getRingGroups.invalidate({ instanceId });
      utils.threecx.getUsersWithMembership.invalidate({ instanceId });
      utils.threecx.getTrunkDetails.invalidate({ instanceId });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/3cx")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Phone Systems
        </button>
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm font-medium">Instance not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/3cx")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Phone Systems
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              statusDotClass(instance.status)
            )}
          />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {instance.name}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              {instance.fqdn}
              {instance.version && (
                <span className="ml-2">v{instance.version}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshMutation.mutate({ instanceId })}
            disabled={refreshMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
          <PbxSsoButton
            instanceId={instanceId}
            disabled={instance.status === "offline"}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5 border border-border w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => startTransition(() => setActiveTab(tab.id))}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <TabOverview instanceId={instanceId} />}
      {activeTab === "extensions" && <TabExtensions instanceId={instanceId} />}
      {activeTab === "queues" && <TabQueues instanceId={instanceId} />}
      {activeTab === "trunks" && <TabTrunks instanceId={instanceId} />}
      {activeTab === "calls" && <TabActiveCalls instanceId={instanceId} />}
      {activeTab === "services" && <TabServices instanceId={instanceId} />}
      {activeTab === "calllog" && <TabCallLog instanceId={instanceId} />}
    </div>
  );
}
