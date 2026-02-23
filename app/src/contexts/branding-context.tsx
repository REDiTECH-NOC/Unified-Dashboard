"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface BrandingSettings {
  logoUrl: string;
  logoUrlLight: string;
  companyName: string;
  faviconUrl: string;
  reportLogoUrl: string;
}

interface BrandingContextValue extends BrandingSettings {
  updateBranding: (settings: Partial<BrandingSettings>) => void;
}

const defaults: BrandingSettings = {
  logoUrl: "/logo.png",
  logoUrlLight: "",
  companyName: "REDiTECH",
  faviconUrl: "",
  reportLogoUrl: "",
};

const STORAGE_KEY = "rcc-branding";

const BrandingContext = createContext<BrandingContextValue>({
  ...defaults,
  updateBranding: () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandingSettings>(defaults);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BrandingSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  const updateBranding = (partial: Partial<BrandingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <BrandingContext.Provider value={{ ...settings, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
