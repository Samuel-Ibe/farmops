"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import {
  Settings,
  User,
  Bell,
  Shield,
  Users,
  Palette,
  ArrowRight,
  Save,
  Webhook,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  FARM_MANAGER: "Farm Manager",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  FIELD_WORKER: "Field Worker",
  ACCOUNTANT: "Accountant",
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const userRole = (session?.user as any)?.role || "FIELD_WORKER";
  const isAdmin = hydrated && userRole === "ADMIN";

  const [profile, setProfile] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });
  const [notifications, setNotifications] = useState({
    lowStock: true,
    expiry: true,
    requests: true,
  });
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast("Settings saved", "success");
  };

  const managementLinks = [
    {
      href: "/settings/users",
      icon: Users,
      title: "User Management",
      description: "Manage user accounts, roles, and permissions",
      color: "bg-blue-50 text-blue-600",
      adminOnly: true,
    },
    {
      href: "/settings/categories",
      icon: Palette,
      title: "Categories",
      description: "Manage inventory item categories and labels",
      color: "bg-purple-50 text-purple-600",
      adminOnly: false,
    },
    {
      href: "/settings/integrations",
      icon: Webhook,
      title: "Integrations",
      description: "Webhooks, API keys, email, and data exports",
      color: "bg-green-50 text-green-600",
      adminOnly: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences"
      />

      {/* Quick Management Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {managementLinks.map((link) => (
          <div key={link.href} hidden={!isAdmin && link.adminOnly}>
            <Link href={link.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${link.color}`}>
                        <link.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{link.title}</p>
                        <p className="text-xs text-muted-foreground">{link.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your personal information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
            <FormField
              label="Email"
              type="email"
              value={profile.email}
              disabled
            />
          </div>
          <div className="flex items-center gap-2" hidden={!isAdmin}>
            <span className="text-sm font-medium text-muted-foreground">Role:</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Shield className="h-3 w-3 mr-1" />
              {ROLE_LABELS[userRole] || userRole}
            </Badge>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {saved ? "✓ Saved!" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "lowStock", label: "Low Stock Alerts", desc: "When inventory falls below minimum levels" },
            { key: "expiry", label: "Expiry Warnings", desc: "When items are about to expire" },
            { key: "requests", label: "Request Updates", desc: "When resource requests are approved or rejected" },
          ].map((pref) => (
            <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{pref.label}</p>
                <p className="text-xs text-muted-foreground">{pref.desc}</p>
              </div>
              <button
                onClick={() =>
                  setNotifications({
                    ...notifications,
                    [pref.key]: !notifications[pref.key as keyof typeof notifications],
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications[pref.key as keyof typeof notifications]
                    ? "bg-green-600"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications[pref.key as keyof typeof notifications]
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {saved ? "✓ Saved!" : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>

      {/* Security - Admin only */}
      <Card hidden={!isAdmin}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Current Password" type="password" placeholder="Enter current password" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="New Password" type="password" placeholder="Enter new password" />
            <FormField label="Confirm Password" type="password" placeholder="Confirm new password" />
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {saved ? "✓ Saved!" : "Update Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
