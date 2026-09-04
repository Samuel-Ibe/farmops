"use client";

import { useState, useEffect } from "react";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Textarea } from "@/components/ui/textarea";

interface RequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RequestForm({
  open,
  onOpenChange,
  onSuccess,
}: RequestFormProps) {
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [form, setForm] = useState({
    requestedById: "",
    farmId: "",
    warehouseId: "",
    itemId: "",
    quantity: "",
    unitOfMeasure: "bags",
    purpose: "",
    priority: "MEDIUM",
  });

  useEffect(() => {
    if (open) {
      Promise.all([
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/warehouses").then((r) => r.json()),
        fetch("/api/farms").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ])
        .then(([itemData, whData, farmData, userData]) => {
          setItems(itemData);
          setWarehouses(whData);
          setFarms(farmData);
          setUsers(userData);
        })
        .catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: parseInt(form.quantity),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create request");
    }

    onSuccess();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Resource Request"
      description="Request inventory items for farm operations"
      onSubmit={handleSubmit}
      submitLabel="Submit Request"
      successMessage="Request submitted successfully"
    >
      <div className="grid gap-4">
        <FormSelect
          label="Requested By"
          value={form.requestedById}
          onChange={(e) =>
            setForm({ ...form, requestedById: e.target.value })
          }
          options={users.map((u) => ({
            value: u.id,
            label: `${u.name} (${u.role})`,
          }))}
          placeholder="Select requester"
          required
        />

        <FormSelect
          label="Farm"
          value={form.farmId}
          onChange={(e) => setForm({ ...form, farmId: e.target.value })}
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Select farm"
          required
        />

        <FormSelect
          label="Item"
          value={form.itemId}
          onChange={(e) => setForm({ ...form, itemId: e.target.value })}
          options={items.map((i) => ({
            value: i.id,
            label: `${i.name} (${i.totalQuantity || 0} ${i.unitOfMeasure} available)`,
          }))}
          placeholder="Select item"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Quantity"
            type="number"
            placeholder="0"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
          />
          <FormSelect
            label="Priority"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={[
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "URGENT", label: "Urgent" },
            ]}
          />
        </div>

        <FormSelect
          label="Warehouse"
          value={form.warehouseId}
          onChange={(e) =>
            setForm({ ...form, warehouseId: e.target.value })
          }
          options={warehouses.map((w) => ({
            value: w.id,
            label: `${w.name} (${w.farm?.name || "Unknown"})`,
          }))}
          placeholder="Select warehouse (optional)"
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Purpose</label>
          <Textarea
            placeholder="Describe why you need this resource..."
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          />
        </div>
      </div>
    </FormDialog>
  );
}
