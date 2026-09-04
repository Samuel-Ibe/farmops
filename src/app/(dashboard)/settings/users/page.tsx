"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { useToast } from "@/components/ui/toast";
import {
  Users,
  Loader2,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Calendar,
} from "lucide-react";

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  ADMIN: { label: "Administrator", color: "bg-red-50 text-red-700 border-red-200", description: "Full system access" },
  FARM_MANAGER: { label: "Farm Manager", color: "bg-green-50 text-green-700 border-green-200", description: "Manages farm operations" },
  WAREHOUSE_MANAGER: { label: "Warehouse Manager", color: "bg-blue-50 text-blue-700 border-blue-200", description: "Manages warehouse operations" },
  FIELD_WORKER: { label: "Field Worker", color: "bg-amber-50 text-amber-700 border-amber-200", description: "Submits requests, scans inventory" },
  ACCOUNTANT: { label: "Accountant", color: "bg-purple-50 text-purple-700 border-purple-200", description: "Views costs and financial reports" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("FIELD_WORKER");
  const [formPassword, setFormPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("FIELD_WORKER");
    setFormPassword("");
    setShowForm(true);
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormPassword("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast("Name and email are required", "error");
      return;
    }
    if (!editingUser && !formPassword) {
      toast("Password is required for new users", "error");
      return;
    }

    setSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/auth/register";
      const method = editingUser ? "PUT" : "POST";
      const body: any = {
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
      };
      if (!editingUser) {
        body.password = formPassword;
        body.confirmPassword = formPassword;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast(editingUser ? "User updated" : "User created", "success");
        setShowForm(false);
        fetchUsers();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save user", "error");
      }
    } catch {
      toast("Failed to save user", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        toast(`User ${user.isActive ? "deactivated" : "activated"}`, "success");
        fetchUsers();
      }
    } catch {
      toast("Failed to update user", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage user accounts and role assignments"
      >
        <Button onClick={openNew}>
          <Users className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </PageHeader>

      {/* Role Legend */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
          <Badge key={key} variant="outline" className={config.color}>
            {config.label}
          </Badge>
        ))}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search users..."
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((user) => {
                const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.FIELD_WORKER;
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-4 rounded-lg border p-4 ${
                      !user.isActive ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700">
                      {user.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.name}</p>
                        {!user.isActive && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className={roleConfig.color}>
                      <Shield className="h-3 w-3 mr-1" />
                      {roleConfig.label}
                    </Badge>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{user._count?.performedTransactions || 0} transactions</p>
                      <p>{user._count?.requestedResources || 0} requests</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={user.isActive ? "text-red-600" : "text-green-600"}
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">
                {editingUser ? "Edit User" : "New User"}
              </h2>

              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@example.com"
                  disabled={!!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label>Role *</Label>
                <FormSelect
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  options={Object.entries(ROLE_CONFIG).map(([value, config]) => ({
                    value,
                    label: `${config.label} — ${config.description}`,
                  }))}
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingUser ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
