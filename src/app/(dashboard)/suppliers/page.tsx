"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SupplierForm } from "@/components/forms/supplier-form";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Building2,
  Mail,
  Phone,
  Star,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const { toast } = useToast();

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/suppliers/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Supplier deleted successfully", "success");
      setDeleteTarget(null);
      fetchSuppliers();
    } else {
      const err = await res.json();
      toast(err.error || "Failed to delete supplier", "error");
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage your supplier directory"
      >
        <Button onClick={() => { setEditSupplier(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search suppliers..."
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No suppliers found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search" : "Add your first supplier"}
            </p>
            {!search && (
              <Button onClick={() => { setEditSupplier(null); setShowForm(true); }} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((supplier) => (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-50 p-2">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{supplier.name}</CardTitle>
                      {supplier.contactPerson && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {supplier.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditSupplier(supplier); setShowForm(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(supplier)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {supplier.email}
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {supplier.phone}
                    </div>
                  )}
                  {supplier.rating && (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(supplier.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        {supplier.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {supplier.address && (
                    <p className="text-xs text-muted-foreground">{supplier.address}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SupplierForm
        open={showForm}
        onOpenChange={setShowForm}
        initialData={editSupplier}
        onSuccess={() => {
          setShowForm(false);
          setEditSupplier(null);
          fetchSuppliers();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Supplier"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? ${deleteTarget?.batches?.length > 0 ? "This supplier has associated inventory and will be deactivated." : "This action cannot be undone."}`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
