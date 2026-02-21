"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User, Mail, Phone, Shield, ShieldCheck, Clock, Lock, Briefcase,
  Check, Pencil, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const roleColors: Record<string, string> = {
  ADMIN: "destructive",
  MANAGER: "warning",
  USER: "default",
  CLIENT: "secondary",
};

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { data: profile, isLoading, refetch } = trpc.user.getProfile.useQuery();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState(false);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      refetch();
      updateSession(); // Refresh session to pick up name change
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setTitle(profile.title || "");
    }
  }, [profile]);

  function handleSave() {
    updateProfile.mutate({ name, phone, title });
  }

  function handleCancel() {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setTitle(profile.title || "");
    }
    setEditing(false);
  }

  const initials = profile?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p className="text-sm text-muted-foreground">
          View and update your profile information.
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              {profile.avatar && <AvatarImage src={profile.avatar} alt={profile.name || ""} />}
              <AvatarFallback className="text-2xl bg-red-500/10 text-red-500">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold truncate">{profile.name || profile.email}</h3>
                <Badge variant={roleColors[profile.role] as any}>{profile.role}</Badge>
                {profile.totpEnabled && (
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">MFA</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
              {profile.title && (
                <p className="text-sm text-muted-foreground mt-0.5">{profile.title}</p>
              )}

              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  {profile.authMethod === "ENTRA" ? "Microsoft SSO" : "Local Account"}
                </div>
                {profile.lastLoginAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Last login: {new Date(profile.lastLoginAt).toLocaleDateString()}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Member since: {new Date(profile.createdAt).toLocaleDateString()}
                </div>
              </div>

              {profile.permissionRoles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {profile.permissionRoles.map((roleName) => (
                    <Badge key={roleName} variant="secondary" className="gap-1 text-xs">
                      <ShieldCheck className="h-3 w-3" />
                      {roleName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Profile Details</CardTitle>
              <CardDescription>Update your display name, job title, and contact information.</CardDescription>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending} className="gap-1.5">
                  {updateProfile.isPending ? "Saving..." : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          {saved && (
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <Check className="h-3 w-3" />
              Profile updated successfully
            </p>
          )}
          {updateProfile.error && (
            <p className="text-xs text-red-400 mt-1">{updateProfile.error.message}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <User className="h-3.5 w-3.5" />
                Display Name
              </label>
              {editing ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              ) : (
                <p className="text-sm px-3 py-2 rounded-md bg-muted/50">{profile.name || "—"}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email Address
              </label>
              <p className="text-sm px-3 py-2 rounded-md bg-muted/50 text-muted-foreground">
                {profile.email}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Email is managed by your {profile.authMethod === "ENTRA" ? "Microsoft 365" : "administrator"}
              </p>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Job Title
              </label>
              {editing ? (
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Technician" />
              ) : (
                <p className="text-sm px-3 py-2 rounded-md bg-muted/50">{profile.title || "—"}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Phone className="h-3.5 w-3.5" />
                Phone Number
              </label>
              {editing ? (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. (555) 123-4567" />
              ) : (
                <p className="text-sm px-3 py-2 rounded-md bg-muted/50">{profile.phone || "—"}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Your account security settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Authentication Method</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.authMethod === "ENTRA" ? "Microsoft Entra ID (SSO)" : "Local credentials"}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{profile.authMethod}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.totpEnabled
                      ? "Authenticator app is configured"
                      : profile.authMethod === "ENTRA"
                      ? "Managed by Microsoft Entra ID"
                      : "Not configured"}
                  </p>
                </div>
              </div>
              {profile.totpEnabled ? (
                <Badge variant="success" className="gap-1">
                  <Check className="h-3 w-3" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {profile.authMethod === "ENTRA" ? "SSO" : "Disabled"}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
