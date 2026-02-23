"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBranding } from "@/contexts/branding-context";
import { Upload, RotateCcw, Check, Globe, FileText, Moon, Sun } from "lucide-react";

function ImageUploadCard({
  title,
  description,
  previewUrl,
  onUpload,
  onClear,
  accept,
  previewClassName,
  icon,
}: {
  title: string;
  description: string;
  previewUrl: string;
  onUpload: (dataUrl: string) => void;
  onClear: () => void;
  accept: string;
  previewClassName?: string;
  icon?: React.ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8">
          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt={`${title} preview`}
              className={previewClassName || "max-h-20 w-auto object-contain"}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <span className="text-xs">No image uploaded</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
          {previewUrl && (
            <Button variant="outline" onClick={onClear}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function BrandingPage() {
  const {
    logoUrl,
    logoUrlLight,
    companyName,
    faviconUrl,
    reportLogoUrl,
    updateBranding,
  } = useBranding();

  const [nameValue, setNameValue] = useState(companyName);
  const [previewLogo, setPreviewLogo] = useState(logoUrl);
  const [previewLogoLight, setPreviewLogoLight] = useState(logoUrlLight);
  const [previewFavicon, setPreviewFavicon] = useState(faviconUrl);
  const [previewReportLogo, setPreviewReportLogo] = useState(reportLogoUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateBranding({
      logoUrl: previewLogo,
      logoUrlLight: previewLogoLight,
      companyName: nameValue,
      faviconUrl: previewFavicon,
      reportLogoUrl: previewReportLogo,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setPreviewLogo("/logo.png");
    setPreviewLogoLight("");
    setNameValue("REDiTECH");
    setPreviewFavicon("");
    setPreviewReportLogo("");
    updateBranding({
      logoUrl: "/logo.png",
      logoUrlLight: "",
      companyName: "REDiTECH",
      faviconUrl: "",
      reportLogoUrl: "",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Branding</h2>
        <p className="text-sm text-muted-foreground">
          Customize the platform logo, favicon, and company name
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dark Mode Logo */}
        <ImageUploadCard
          title="Logo — Dark Mode"
          description="Shown in the sidebar when dark mode is active. Recommended: PNG or SVG with transparent background, at least 200px wide."
          previewUrl={previewLogo}
          onUpload={setPreviewLogo}
          onClear={() => setPreviewLogo("/logo.png")}
          accept="image/png,image/jpeg,image/svg+xml"
          previewClassName="max-h-20 w-auto object-contain bg-zinc-900 rounded-lg p-3"
          icon={<Moon className="h-4 w-4 text-muted-foreground" />}
        />

        {/* Light Mode Logo */}
        <ImageUploadCard
          title="Logo — Light Mode"
          description="Shown in the sidebar when light mode is active. Falls back to the dark mode logo if not set."
          previewUrl={previewLogoLight}
          onUpload={setPreviewLogoLight}
          onClear={() => setPreviewLogoLight("")}
          accept="image/png,image/jpeg,image/svg+xml"
          previewClassName="max-h-20 w-auto object-contain bg-white rounded-lg p-3"
          icon={<Sun className="h-4 w-4 text-muted-foreground" />}
        />

        {/* Company Name */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Company name"
            />
            <p className="text-xs text-muted-foreground">
              Used as the alt text for the logo and in browser titles.
            </p>
          </CardContent>
        </Card>

        {/* Favicon */}
        <ImageUploadCard
          title="Favicon"
          description="Recommended: 32x32 or 64x64 PNG, SVG, or ICO. Shown as the browser tab icon on all pages."
          previewUrl={previewFavicon}
          onUpload={setPreviewFavicon}
          onClear={() => setPreviewFavicon("")}
          accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
          previewClassName="h-8 w-8 object-contain"
          icon={<Globe className="h-4 w-4 text-muted-foreground" />}
        />

        {/* Report Logo */}
        <ImageUploadCard
          title="Report Logo"
          description="Used on generated reports and QBR documents. Recommended: PNG or SVG, at least 300px wide."
          previewUrl={previewReportLogo}
          onUpload={setPreviewReportLogo}
          onClear={() => setPreviewReportLogo("")}
          accept="image/png,image/jpeg,image/svg+xml"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Save / Reset */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} className="gap-2">
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
        <p className="text-xs text-muted-foreground">
          Changes are saved to your browser. Server-side storage coming in a
          future update.
        </p>
      </div>
    </div>
  );
}
