"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface PurchaseOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  onSuccess: () => void;
}

export function PurchaseOrderForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: PurchaseOrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const { toast } = useToast();

  const [form, setForm] = useState({
    supplierId: "",
    farmId: "",
    expectedDeliveryDate: "",
    notes: "",
    items: [{ itemId: "", quantity: 1, unitPrice: 0 }] as {
      itemId: string;
      quantity: number;
      unitPrice: number;
    }[],
  });

  useEffect(() => {
    if (open) {
      Promise.all([
        fetch("/api/suppliers").then((r) => r.json()),
        fetch("/api/farms").then((r) => r.json()),
        fetch("/api/inventory").then((r) => r.json()),
      ]).then(([s, f, i]) => {
        setSuppliers(s);
        setFarms(f);
        setItems(i);
      });

      if (initialData) {
        setForm({
          supplierId: initialData.supplierId || "",
          farmId: initialData.farmId || "",
          expectedDeliveryDate: initialData.expectedDeliveryDate
            ? new Date(initialData.expectedDeliveryDate).toISOString().split("T")[0]
            : "",
          notes: initialData.notes || "",
          items: initialData.items?.map((item: any) => ({
            itemId: item.itemId || item.item?.id || "",
            quantity: item.quantity || 1,
            unitPrice: Number(item.unitPrice) || 0,
          })) || [{ itemId: "", quantity: 1, unitPrice: 0 }],
        });
      } else {
        setForm({
          supplierId: "",
          farmId: "",
          expectedDeliveryDate: "",
          notes: "",
          items: [{ itemId: "", quantity: 1, unitPrice: 0 }],
        });
      }
    }
  }, [open, initialData]);

  const totalAmount = form.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { itemId: "", quantity: 1, unitPrice: 0 }],
    });
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const newItems = [...form.items];
    (newItems[index] as any)[field] = value;
    setForm({ ...form, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.supplierId || !form.farmId) {
      toast("Please select a supplier and farm", "error");
      return;
    }

    const validItems = form.items.filter((item) => item.itemId && item.quantity > 0);
    if (validItems.length === 0) {
      toast("Please add at least one item", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: validItems,
          expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        }),
      });

      if (res.ok) {
        toast(initialData ? "Purchase order updated" : "Purchase order created", "success");
        onSuccess();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save purchase order", "error");
      }
    } catch {
      toast("Failed to save purchase order", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Purchase Order" : "New Purchase Order"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the purchase order details"
              : "Create a new purchase order for farm supplies"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <FormSelect
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select supplier"
              />
            </div>
            <div className="space-y-2">
              <Label>Farm *</Label>
              <FormSelect
                value={form.farmId}
                onChange={(e) => setForm({ ...form, farmId: e.target.value })}
                options={farms.map((f) => ({ value: f.id, label: f.name }))}
                placeholder="Select farm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={form.expectedDeliveryDate}
                onChange={(e) =>
                  setForm({ ...form, expectedDeliveryDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Order Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border p-2"
                >
                  <div className="flex-1">
                    <FormSelect
                      value={item.itemId}
                      onChange={(e) => updateItem(index, "itemId", e.target.value)}
                      options={items.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.unitOfMeasure})`,
                      }))}
                      placeholder="Select item"
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", parseInt(e.target.value) || 1)
                      }
                      placeholder="Qty"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                      }
                      placeholder="Price"
                    />
                  </div>
                  <p className="text-sm font-medium w-20 text-right">
                    GH₵ {(item.quantity * item.unitPrice).toLocaleString()}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <span className="font-medium">Total Amount</span>
            <span className="text-lg font-bold">
              GH₵ {totalAmount.toLocaleString()}
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initialData ? "Update Order" : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
