import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { BrandingProvider } from "@/contexts/branding-context";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { PermissionGate } from "@/components/permission-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandingProvider>
      <DynamicFavicon />
      <PermissionGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col lg:ml-18 xl:ml-sidebar transition-all duration-200">
            <Header />
            <main className="flex-1 p-4 sm:p-5 lg:p-6 xl:p-8">{children}</main>
          </div>
        </div>
      </PermissionGate>
    </BrandingProvider>
  );
}
