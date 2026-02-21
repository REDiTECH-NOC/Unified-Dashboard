"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBranding } from "@/contexts/branding-context";
import { Upload, RotateCcw, Check } from "lucide-react";

export default function BrandingPage() {
  const { logoUrl, companyName, updateBranding } = useBranding();
  const [nameValue, setNameValue] = useState(companyName);
  const [previewLogo, setPreviewLogo] = useState(logoUrl);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a blob URL for preview and storage
    const url = URL.createObjectURL(file);
    setPreviewLogo(url);

    // In a real implementation, this would upload to the server/S3
    // For now, we convert to base64 for localStorage persistence
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateBranding({
      logoUrl: previewLogo,
      companyName: nameValue,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setPreviewLogo("/logo.png");
    setNameValue("REDiTECH");
    updateBranding({
      logoUrl: "/logo.png",
      companyName: "REDiTECH",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Branding</h2>
        <p className="text-sm text-muted-foreground">
          Customize the platform logo and company name
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewLogo}
                alt="Logo preview"
                className="max-h-20 w-auto object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload Logo
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: PNG or SVG, at least 200px wide. Displayed in the
              sidebar and login page.
            </p>
          </CardContent>
        </Card>

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
      </div>

      {/* Save */}
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
        <p className="text-xs text-muted-foreground">
          Changes are saved to your browser. Server-side storage coming in a
          future update.
        </p>
      </div>
    </div>
  );
}
