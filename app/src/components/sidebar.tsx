"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/branding-context";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/use-permissions";
import {
  LayoutDashboard,
  AlertTriangle,
  Ticket,
  Users,
  ScrollText,
  Settings,
  Plug,
  UserCog,
  Bell,
  Search,
  BarChart3,
  TrendingUp,
  Activity,
  Workflow,
  Cloud,
  Monitor,
  HardDrive,
  Phone,
  Wifi,
  DollarSign,
  ChevronDown,
  KeyRound,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;   // If set, only shown when user has this permission
  external?: boolean;    // If true, opens in a new tab via <a target="_blank">
  externalKey?: string;  // Runtime URL key resolved from system.externalUrls
}

const navSections: { label: string; collapsible?: boolean; defaultCollapsed?: boolean; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { href: "/tickets", label: "Tickets", icon: Ticket, permission: "tickets.view" },
      { href: "/alerts", label: "Alerts", icon: AlertTriangle, permission: "alerts.view" },
      { href: "/cipp", label: "Microsoft 365", icon: Monitor, permission: "cipp.view" },
      { href: "/3cx", label: "Phone Systems", icon: Phone, permission: "phone.view" },
      { href: "/clients", label: "Clients", icon: Users, permission: "clients.view" },
      { href: "/billing", label: "Billing", icon: DollarSign, permission: "billing.view" },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/passwords", label: "Passwords", icon: KeyRound, permission: "keeper.view" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/backups", label: "Backups", icon: HardDrive, permission: "backups.view" },
      { href: "/network", label: "Network", icon: Wifi, permission: "network.view" },
      { href: "/monitoring", label: "Uptime Monitor", icon: Activity, permission: "tools.uptime" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/analytics", label: "Reporting", icon: TrendingUp, permission: "dashboard.view" },
      { href: "/grafana", label: "Grafana", icon: BarChart3, permission: "tools.grafana" },
      { href: "/audit", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: "/settings", label: "General", icon: Settings, permission: "settings.view" },
      { href: "#", label: "Automations", icon: Workflow, permission: "tools.n8n", external: true, externalKey: "n8n" },
      { href: "/settings/integrations", label: "Integrations", icon: Plug, permission: "settings.integrations" },
      { href: "/azure", label: "Azure", icon: Cloud, permission: "tools.azure" },
      { href: "/settings/notifications", label: "Notifications", icon: Bell, permission: "settings.notifications" },
      { href: "/settings/users", label: "Users", icon: UserCog, permission: "users.manage" },
    ],
  },
];

function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    let raf: number;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isLaptop: width >= 1024 && width < 1280,
    isDesktop: width >= 1280,
  };
}

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export function Sidebar() {
  const pathname = usePathname();
  const bp = useBreakpoint();
  const { logoUrl, logoUrlLight, companyName } = useBranding();
  const isDark = useIsDarkMode();
  const activeLogo = !isDark && logoUrlLight ? logoUrlLight : logoUrl;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Collapsible sections — init from defaultCollapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    for (const s of navSections) {
      if (s.collapsible && s.defaultCollapsed) defaults.add(s.label);
    }
    return defaults;
  });
  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // User permissions for sidebar filtering (shared hook with 5-min cache)
  const { permissions: permSet, isLoading: permsLoading } = usePermissions();

  // Fetch runtime external URLs (n8n, etc.) — set once by admin in .env
  const { data: externalUrls } = trpc.system.externalUrls.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });

  // Filter nav sections based on permissions (hide empty sections)
  // Also resolve externalKey → actual URL and hide items with no configured URL
  const visibleSections = useMemo(() => {
    // While loading, show all items (prevents flash of empty sidebar)
    if (permsLoading) return navSections;

    return navSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => !item.permission || permSet.has(item.permission))
          .filter((item) => {
            // Hide external items whose URL hasn't been configured
            if (item.externalKey) {
              const url = externalUrls?.[item.externalKey as keyof typeof externalUrls];
              return !!url;
            }
            return true;
          })
          .map((item) => {
            // Resolve externalKey to actual href
            if (item.externalKey && externalUrls) {
              const url = externalUrls[item.externalKey as keyof typeof externalUrls];
              if (url) return { ...item, href: url };
            }
            return item;
          }),
      }))
      .filter((section) => section.items.length > 0);
  }, [permsLoading, permSet, externalUrls]);

  const isOverlay = bp.isMobile || bp.isTablet;
  const effectiveCollapsed = bp.isLaptop ? !hovered : false;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Expose toggle for the header hamburger
  useEffect(() => {
    (window as any).__toggleSidebar = () => setMobileOpen((v) => !v);
    return () => {
      delete (window as any).__toggleSidebar;
    };
  }, []);

  if (isOverlay && !mobileOpen) return null;

  return (
    <>
      {/* Overlay backdrop */}
      {isOverlay && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => bp.isLaptop && setHovered(true)}
        onMouseLeave={() => bp.isLaptop && setHovered(false)}
        className={cn(
          "fixed top-0 left-0 z-50 h-full flex flex-col",
          "bg-card border-r border-border shadow-sidebar",
          "transition-all duration-200",
          isOverlay && "w-sidebar",
          !isOverlay && effectiveCollapsed && "w-18",
          !isOverlay && !effectiveCollapsed && "w-sidebar"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center justify-center border-b border-border flex-shrink-0",
            effectiveCollapsed ? "h-16 px-2" : "h-20 px-4"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeLogo}
            alt={companyName}
            className={cn(
              "object-contain",
              effectiveCollapsed ? "w-10 h-10" : "w-full h-auto max-h-16"
            )}
          />
        </div>

        {/* Search */}
        {!effectiveCollapsed && (
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-accent">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>
        )}

        {/* Nav sections */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto py-4",
            effectiveCollapsed ? "px-2" : "px-3"
          )}
        >
          {visibleSections.map((section) => {
            const isCollapsible = section.collapsible;
            const isSectionCollapsed = isCollapsible && collapsedSections.has(section.label);
            // Auto-expand Settings when a settings route is active
            const hasActiveChild = section.items.some(
              (item) => !item.external && (pathname === item.href || pathname.startsWith(item.href + "/"))
            );

            return (
            <div key={section.label} className="mt-6 first:mt-0">
              {!effectiveCollapsed && (
                isCollapsible ? (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="flex items-center justify-between w-full px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isSectionCollapsed && !hasActiveChild && "-rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {section.label}
                  </p>
                )
              )}
              {(!isSectionCollapsed || hasActiveChild) && (
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive =
                    !item.external &&
                    (pathname === item.href ||
                    pathname.startsWith(item.href + "/"));

                  const linkClasses = cn(
                    "relative flex items-center gap-3 rounded-md transition-colors duration-100",
                    effectiveCollapsed
                      ? "justify-center px-0 h-10"
                      : "px-3 h-10",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  );

                  const linkContent = (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-red-500" />
                      )}
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] flex-shrink-0",
                          isActive ? "text-red-500" : ""
                        )}
                      />
                      {!effectiveCollapsed && (
                        <span className="text-sm font-medium truncate">
                          {item.label}
                        </span>
                      )}
                    </>
                  );

                  if (item.external) {
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClasses}
                      >
                        {linkContent}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={linkClasses}
                    >
                      {linkContent}
                    </Link>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </nav>

        {/* Version */}
        <div className="border-t border-border p-3">
          {effectiveCollapsed ? (
            <p className="text-[10px] text-muted-foreground text-center">
              v0.2
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center">
              v0.2.0 — Phase 2
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
