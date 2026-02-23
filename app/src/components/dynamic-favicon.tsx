"use client";

import { useEffect } from "react";
import { useBranding } from "@/contexts/branding-context";

export function DynamicFavicon() {
  const { faviconUrl, logoUrl } = useBranding();

  useEffect(() => {
    const href = faviconUrl || logoUrl || "/logo.png";

    let link = document.querySelector(
      'link[rel="icon"]'
    ) as HTMLLinkElement | null;

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    link.href = href;
  }, [faviconUrl, logoUrl]);

  return null;
}
