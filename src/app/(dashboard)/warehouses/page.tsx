"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { WarehouseForm } from "@/components/forms/warehouse-form";
import { useToast } from "@/components/ui/toast";
import { Plus, Warehouse, Package, MapPin, Loader2, Pencil, Trash2 } from "lucide-react";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const { toast } = useToast();

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/warehouses");
      if (res.ok) setWarehouses(await res.json());
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/warehouses/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Warehouse deleted successfully", "success");
      setDeleteTarget(null);
      fetchWarehouses();
    } else {
      const err = await res.json();
      toast(err.error || "Failed to delete warehouse", "error");
    }
  };

  const filtered = warehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.farm?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage storage locations across all farms"
      >
        <Button onClick={() => { setEditWarehouse(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Warehouse
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search warehouses..."
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No warehouses found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search" : "Add your first warehouse to get started"}
            </p>
            {!search && (
              <Button onClick={() => { setEditWarehouse(null); setShowForm(true); }} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Warehouse
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((warehouse) => (
            <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-green-50 p-2">
                      <Warehouse className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{warehouse.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{warehouse.farm?.name || "No farm"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditWarehouse(warehouse); setShowForm(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(warehouse)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {warehouse.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {warehouse.location}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{warehouse._count?.batches || 0}</span>
                      <span className="text-muted-foreground">batches</span>
                    </div>
                    <Badge variant="outline" className={
                      warehouse.type === "COLD_STORAGE"
                        ? "bg-blue-50 text-blue-700"
                        : warehouse.type === "SILO"
                        ? "bg-purple-50 text-purple-700"
                        : ""
                    }>
                      {warehouse.type?.replace("_", " ").toLowerCase() || "physical"}
                    </Badge>
                  </div>
                  {warehouse.capacity && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacity</span>
                        <span className="font-medium">{warehouse.capacity} units</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WarehouseForm
        open={showForm}
        onOpenChange={setShowForm}
        initialData={editWarehouse}
        onSuccess={() => {
          setShowForm(false);
          setEditWarehouse(null);
          fetchWarehouses();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Warehouse"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? ${deleteTarget?.batches?.length > 0 ? "This warehouse has inventory and will be deactivated." : "This action cannot be undone."}`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
