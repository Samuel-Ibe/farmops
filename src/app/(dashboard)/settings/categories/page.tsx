"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Palette,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";

const COLORS = [
  "#16a34a", "#ca8a04", "#dc2626", "#2563eb", "#7c3aed",
  "#0891b2", "#d946ef", "#ea580c", "#6b7280", "#059669",
  "#e11d48", "#0284c7",
];

const ICONS = ["🌱", "🧪", "🐛", "🌿", "🐄", "⛽", "🔧", "📦", "🌾", "💊", "💧", "🏗️"];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formIcon, setFormIcon] = useState(ICONS[0]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (res.ok) setCategories(await res.json());
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openNew = () => {
    setEditCategory(null);
    setFormName("");
    setFormDescription("");
    setFormColor(COLORS[0]);
    setFormIcon(ICONS[0]);
    setShowForm(true);
  };

  const openEdit = (cat: any) => {
    setEditCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description || "");
    setFormColor(cat.color || COLORS[0]);
    setFormIcon(cat.icon || ICONS[0]);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast("Category name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const url = editCategory ? `/api/categories/${editCategory.id}` : "/api/categories";
      const method = editCategory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          color: formColor,
          icon: formIcon,
        }),
      });
      if (res.ok) {
        toast(editCategory ? "Category updated" : "Category created", "success");
        setShowForm(false);
        fetchCategories();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save category", "error");
      }
    } catch {
      toast("Failed to save category", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Category deleted", "success");
        setDeleteTarget(null);
        fetchCategories();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete", "error");
      }
    } catch {
      toast("Failed to delete category", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage inventory item categories"
      >
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No categories found</p>
            <Button onClick={openNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
                      style={{ backgroundColor: (cat.color || "#6b7280") + "20" }}
                    >
                      {cat.icon || "📦"}
                    </div>
                    <div>
                      <p className="font-semibold">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{cat.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cat._count?.items || 0} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editCategory ? "Edit Category" : "New Category"}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Category name"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormIcon(icon)}
                      className={`h-10 w-10 rounded-lg border-2 text-xl flex items-center justify-center transition-colors ${
                        formIcon === icon ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        formColor === color ? "border-gray-900 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editCategory ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? ${
          (deleteTarget?._count?.items || 0) > 0
            ? "This category has items and cannot be deleted. Rename it instead."
            : "This action cannot be undone."
        }`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
