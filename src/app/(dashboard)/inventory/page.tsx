"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InventoryForm } from "@/components/forms/inventory-form";
import { BatchForm } from "@/components/forms/batch-form";
import { BatchSplitForm } from "@/components/forms/batch-split-form";
import { BatchTransferForm } from "@/components/forms/batch-transfer-form";
import { useToast } from "@/components/ui/toast";
import { CsvIO } from "@/components/shared/csv-io";
import {
  Plus,
  Package,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  FileDown,
  FileUp,
  Scissors,
  ArrowRightLeft,
} from "lucide-react";
import { isExpiringSoon } from "@/lib/utils";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [showCsvIO, setShowCsvIO] = useState(false);
  const [splitBatch, setSplitBatch] = useState<any>(null);
  const [transferBatch, setTransferBatch] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/inventory?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(Array.isArray(json) ? json : json?.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Fetch warehouses for transfer form
  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/inventory/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      const msg = await res.json();
      toast(msg.message === "Item deactivated" ? "Item deactivated (has batches)" : "Item deleted", "success");
      setDeleteTarget(null);
      fetchItems();
    } else {
      const err = await res.json();
      toast(err.error || "Failed to delete item", "error");
    }
  };

  const safeItems = Array.isArray(items) ? items : [];
  const filteredItems = safeItems.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = safeItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);
  const lowStockCount = safeItems.filter(
    (item) => (item.totalQuantity || 0) <= (item.minimumStockLevel || 0) && item.minimumStockLevel > 0
  ).length;
  const expiringCount = safeItems.filter((item) =>
    item.batches?.some((b: any) => b.expiryDate && isExpiringSoon(b.expiryDate))
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage all inventory items across farms and warehouses"
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCsvIO(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => setShowAddBatch(true)}>
            <Package className="h-4 w-4 mr-2" />
            Receive Stock
          </Button>
          <Button onClick={() => { setEditItem(null); setShowAddItem(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </PageHeader>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{safeItems.length}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">GH₵ {totalValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-xs text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search inventory items..."
        className="max-w-sm"
      />

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No inventory items found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add your first inventory item to get started"}
              </p>
              {!search && (
                <Button onClick={() => { setEditItem(null); setShowAddItem(true); }} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const isLow = (item.totalQuantity || 0) <= (item.minimumStockLevel || 0) && item.minimumStockLevel > 0;
                const hasExpiring = item.batches?.some(
                  (b: any) => b.expiryDate && isExpiringSoon(b.expiryDate)
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{item.name}</h3>
                          {item.category && (
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: (item.category.color || "#6b7280") + "20",
                                color: item.category.color || "#6b7280",
                                borderColor: (item.category.color || "#6b7280") + "40",
                              }}
                            >
                              {item.category.name}
                            </Badge>
                          )}
                          {isLow && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Low Stock
                            </Badge>
                          )}
                          {hasExpiring && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.batches?.length || 0} batch{(item.batches?.length || 0) !== 1 ? "es" : ""} across{" "}
                          {new Set(item.batches?.map((b: any) => b.warehouse?.farm?.name) || []).size} farm
                          {new Set(item.batches?.map((b: any) => b.warehouse?.farm?.name) || []).size !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {item.totalQuantity || 0} {item.unitOfMeasure}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            GH₵ {(item.totalValue || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditItem(item); setShowAddItem(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {item.batches?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {item.batches.slice(0, 5).map((batch: any) => (
                          <div
                            key={batch.id}
                            className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="font-mono">{batch.batchNumber}</span>
                              <span>•</span>
                              <span>
                                {batch.quantityRemaining} {item.unitOfMeasure}
                              </span>
                              <span>•</span>
                              <span>{batch.warehouse?.name}</span>
                              {batch.expiryDate && (
                                <>
                                  <span>•</span>
                                  <span>Exp: {new Date(batch.expiryDate).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                            {batch.status === "ACTIVE" && batch.quantityRemaining > 0 && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setSplitBatch(batch)}
                                >
                                  <Scissors className="h-3 w-3 mr-1" />
                                  Split
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setTransferBatch(batch)}
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  Transfer
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {item.batches.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            + {item.batches.length - 5} more batch{'es'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forms */}
      <InventoryForm
        open={showAddItem}
        onOpenChange={setShowAddItem}
        initialData={editItem}
        onSuccess={() => {
          setShowAddItem(false);
          setEditItem(null);
          fetchItems();
        }}
      />
      <BatchForm
        open={showAddBatch}
        onOpenChange={setShowAddBatch}
        onSuccess={() => {
          setShowAddBatch(false);
          fetchItems();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? ${deleteTarget?.batches?.length > 0 ? "This item has active batches and will be deactivated instead." : "This action cannot be undone."}`}
        onConfirm={handleDelete}
      />

      <CsvIO
        open={showCsvIO}
        onOpenChange={setShowCsvIO}
        type="inventory"
        onSuccess={() => {
          fetchItems();
        }}
      />

      {splitBatch && (
        <BatchSplitForm
          open={!!splitBatch}
          onClose={() => setSplitBatch(null)}
          batch={splitBatch}
          warehouses={warehouses}
          onSuccess={() => {
            setSplitBatch(null);
            fetchItems();
            toast("Batch split successfully", "success");
          }}
        />
      )}

      {transferBatch && (
        <BatchTransferForm
          open={!!transferBatch}
          onClose={() => setTransferBatch(null)}
          batch={transferBatch}
          warehouses={warehouses}
          onSuccess={() => {
            setTransferBatch(null);
            fetchItems();
            toast("Transfer completed", "success");
          }}
        />
      )}
    </div>
  );
}
