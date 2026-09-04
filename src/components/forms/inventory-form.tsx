"use client";

import { useState, useEffect } from "react";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Textarea } from "@/components/ui/textarea";

interface InventoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: any;
}

export function InventoryForm({
  open,
  onOpenChange,
  onSuccess,
  initialData,
}: InventoryFormProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    unitOfMeasure: "bags",
    description: "",
    minimumStockLevel: "0",
    maximumStockLevel: "",
    reorderPoint: "",
    reorderQuantity: "",
    defaultSupplierId: "",
    shelfLifeDays: "",
    requiresExpiryTracking: false,
  });

  useEffect(() => {
    if (open) {
      fetch("/api/categories")
        .then((r) => r.json())
        .then(setCategories)
        .catch(() => {});
      fetch("/api/suppliers")
        .then((r) => r.json())
        .then(setSuppliers)
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        categoryId: initialData.categoryId || "",
        unitOfMeasure: initialData.unitOfMeasure || "bags",
        description: initialData.description || "",
        minimumStockLevel: initialData.minimumStockLevel?.toString() || "0",
        maximumStockLevel: initialData.maximumStockLevel?.toString() || "",
        reorderPoint: initialData.reorderPoint?.toString() || "",
        reorderQuantity: initialData.reorderQuantity?.toString() || "",
        defaultSupplierId: initialData.defaultSupplierId || "",
        shelfLifeDays: initialData.shelfLifeDays?.toString() || "",
        requiresExpiryTracking: initialData.requiresExpiryTracking || false,
      });
    } else {
      setForm({
        name: "",
        categoryId: "",
        unitOfMeasure: "bags",
        description: "",
        minimumStockLevel: "0",
        maximumStockLevel: "",
        reorderPoint: "",
        reorderQuantity: "",
        defaultSupplierId: "",
        shelfLifeDays: "",
        requiresExpiryTracking: false,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async () => {
    const url = initialData
      ? `/api/inventory/${initialData.id}`
      : "/api/inventory";
    const method = initialData ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        minimumStockLevel: parseInt(form.minimumStockLevel) || 0,
        maximumStockLevel: form.maximumStockLevel
          ? parseInt(form.maximumStockLevel)
          : null,
        reorderPoint: form.reorderPoint ? parseInt(form.reorderPoint) : null,
        reorderQuantity: form.reorderQuantity
          ? parseInt(form.reorderQuantity)
          : null,
        shelfLifeDays: form.shelfLifeDays
          ? parseInt(form.shelfLifeDays)
          : null,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save item");
    }

    onSuccess();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Edit Inventory Item" : "Add New Inventory Item"}
      description="Fill in the details for this inventory item"
      onSubmit={handleSubmit}
      submitLabel={initialData ? "Update Item" : "Add Item"}
      successMessage={initialData ? "Item updated successfully" : "Item created successfully"}
    >
      <div className="grid gap-4">
        <FormField
          label="Item Name"
          placeholder="e.g. NPK 15-15-15 Fertilizer"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            label="Category"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select category"
            required
          />
          <FormSelect
            label="Unit of Measure"
            value={form.unitOfMeasure}
            onChange={(e) =>
              setForm({ ...form, unitOfMeasure: e.target.value })
            }
            options={[
              { value: "bags", label: "Bags" },
              { value: "kg", label: "Kilograms" },
              { value: "liters", label: "Liters" },
              { value: "units", label: "Units" },
              { value: "tons", label: "Tons" },
              { value: "bottles", label: "Bottles" },
              { value: "boxes", label: "Boxes" },
              { value: "pieces", label: "Pieces" },
            ]}
          />
        </div>

        <FormField
          label="Description"
          placeholder="Optional description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Minimum Stock Level"
            type="number"
            value={form.minimumStockLevel}
            onChange={(e) =>
              setForm({ ...form, minimumStockLevel: e.target.value })
            }
            description="Trigger low-stock alert below this"
          />
          <FormField
            label="Maximum Stock Level"
            type="number"
            placeholder="Optional"
            value={form.maximumStockLevel}
            onChange={(e) =>
              setForm({ ...form, maximumStockLevel: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Reorder Point"
            type="number"
            placeholder="Optional"
            value={form.reorderPoint}
            onChange={(e) =>
              setForm({ ...form, reorderPoint: e.target.value })
            }
          />
          <FormField
            label="Reorder Quantity"
            type="number"
            placeholder="Optional"
            value={form.reorderQuantity}
            onChange={(e) =>
              setForm({ ...form, reorderQuantity: e.target.value })
            }
          />
        </div>

        <FormSelect
          label="Default Supplier"
          value={form.defaultSupplierId}
          onChange={(e) =>
            setForm({ ...form, defaultSupplierId: e.target.value })
          }
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="Select supplier"
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Shelf Life (days)"
            type="number"
            placeholder="Optional"
            value={form.shelfLifeDays}
            onChange={(e) =>
              setForm({ ...form, shelfLifeDays: e.target.value })
            }
            description="Days until product expires"
          />
          <div className="flex items-center space-x-2 pt-6">
            <input
              type="checkbox"
              id="expiry"
              checked={form.requiresExpiryTracking}
              onChange={(e) =>
                setForm({
                  ...form,
                  requiresExpiryTracking: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="expiry" className="text-sm font-medium">
              Track expiry dates
            </label>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
