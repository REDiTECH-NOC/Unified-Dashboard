"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/branding-context";
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
} from "lucide-react";

const navSections = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/alerts", label: "Alerts", icon: AlertTriangle },
      { href: "/tickets", label: "Tickets", icon: Ticket },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings", label: "General", icon: Settings },
      { href: "/settings/integrations", label: "Integrations", icon: Plug },
      { href: "/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/settings/users", label: "Users", icon: UserCog },
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

export function Sidebar() {
  const pathname = usePathname();
  const bp = useBreakpoint();
  const { logoUrl, companyName } = useBranding();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

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
            src={logoUrl}
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
          {navSections.map((section) => (
            <div key={section.label} className="mt-6 first:mt-0">
              {!effectiveCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {section.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md transition-colors duration-100",
                        effectiveCollapsed
                          ? "justify-center px-0 h-10"
                          : "px-3 h-10",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
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
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Version */}
        <div className="border-t border-border p-3">
          {effectiveCollapsed ? (
            <p className="text-[10px] text-muted-foreground text-center">
              v0.1
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center">
              v0.1.0 — Phase 1
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
