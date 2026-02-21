"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Plug, UserCog, Palette, Bell, Info } from "lucide-react";
import Link from "next/link";

const settingsSections = [
  {
    title: "Integrations",
    description: "Manage API connections for all 20 tools",
    icon: Plug,
    href: "/settings/integrations",
  },
  {
    title: "User Management",
    description: "Manage user roles, permissions, and feature flags",
    icon: UserCog,
    href: "/settings/users",
  },
  {
    title: "Notifications",
    description: "Configure notification channels, sender emails, and rules",
    icon: Bell,
    href: "/settings/notifications",
  },
  {
    title: "Branding",
    description: "Customize logo, company name, and platform appearance",
    icon: Palette,
    href: "/settings/branding",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Platform configuration and management
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="cursor-pointer transition-colors hover:border-primary/50 h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* System info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">System Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">v0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phase</span>
              <span>Phase 1 — Foundation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
