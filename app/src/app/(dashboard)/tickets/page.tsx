"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTicketHub } from "./_components/use-ticket-hub";
import { TicketHubHeader, type TicketTab } from "./_components/ticket-hub-header";
import { TabMyTickets } from "./_components/tab-my-tickets";
import { TabAllTickets } from "./_components/tab-all-tickets";
import { TabCalendar } from "./_components/tab-calendar";
import { CreateTicketDialog } from "./_components/create-ticket-dialog";

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  const hub = useTicketHub();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TicketTab>("mine");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [myTicketCount, setMyTicketCount] = useState<number | undefined>();

  // Read URL params for cross-navigation (e.g., "Company Tickets" button)
  const urlTab = searchParams.get("tab");
  const urlCompany = searchParams.get("company");
  const urlContact = searchParams.get("contact");
  const searchParamsStr = searchParams.toString();

  // Sync tab state from URL — watch full search params string so re-triggers
  // even when urlTab stays "all" but company/contact changes
  useEffect(() => {
    if (urlTab === "all") setActiveTab("all");
    else if (urlTab === "calendar") setActiveTab("calendar");
  }, [searchParamsStr, urlTab]);

  // When user manually changes tabs via header, clear URL params to stay in sync
  const handleTabChange = useCallback((tab: TicketTab) => {
    setActiveTab(tab);
    if (tab === "mine") {
      router.replace("/tickets");
    } else if (tab === "all") {
      router.replace("/tickets?tab=all");
    } else if (tab === "calendar") {
      router.replace("/tickets?tab=calendar");
    }
  }, [router]);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCreateDialogOpen(true);
      }
      if (e.key === "Escape" && createDialogOpen) {
        setCreateDialogOpen(false);
      }
      if (e.key === "1") handleTabChange("mine");
      if (e.key === "2") handleTabChange("all");
      if (e.key === "3") handleTabChange("calendar");
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createDialogOpen, handleTabChange]);

  const handleRefresh = useCallback(() => {
    hub.utils.psa.getTickets.invalidate();
  }, [hub.utils]);

  return (
    <div className="space-y-6">
      <TicketHubHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onCreateTicket={() => setCreateDialogOpen(true)}
        onRefresh={handleRefresh}
        isFetching={false}
        hub={hub}
        myTicketCount={myTicketCount}
      />

      {activeTab === "mine" && (
        <TabMyTickets
          hub={hub}
          onMyCountChange={setMyTicketCount}
        />
      )}

      {activeTab === "all" && (
        <TabAllTickets
          hub={hub}
          initialCompanyId={urlCompany ?? undefined}
          initialContactSearch={urlContact ?? undefined}
        />
      )}

      {activeTab === "calendar" && (
        <TabCalendar hub={hub} />
      )}

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        hub={hub}
      />
    </div>
  );
}
