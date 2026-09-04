"use client";

import { useState, useEffect } from "react";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { Textarea } from "@/components/ui/textarea";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  type?: string;
}

export function TransactionForm({
  open,
  onOpenChange,
  onSuccess,
  type: initialType = "RECEIVED",
}: TransactionFormProps) {
  const [batches, setBatches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [form, setForm] = useState({
    type: initialType,
    batchId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    quantity: "",
    reason: "",
    referenceNumber: "",
    performedById: "",
    farmId: "",
  });

  useEffect(() => {
    if (open) {
      Promise.all([
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/warehouses").then((r) => r.json()),
        fetch("/api/farms").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ])
        .then(([inventoryItems, whData, farmData, userData]) => {
          // Flatten all batches from inventory items
          const allBatches = inventoryItems.flatMap((item: any) =>
            item.batches.map((b: any) => ({
              ...b,
              itemName: item.name,
              unitOfMeasure: item.unitOfMeasure,
            }))
          );
          setBatches(allBatches);
          setWarehouses(whData);
          setFarms(farmData);
          setUsers(userData);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, type: initialType }));
  }, [initialType]);

  const showTransferFields = form.type === "TRANSFERRED";
  const showFromField = form.type === "ISSUED" || form.type === "TRANSFERRED";
  const showToField =
    form.type === "RECEIVED" || form.type === "TRANSFERRED";

  const selectedBatch = batches.find((b) => b.id === form.batchId);

  const handleSubmit = async () => {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: parseInt(form.quantity),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create transaction");
    }

    onSuccess();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`New Stock ${
        form.type === "RECEIVED"
          ? "Receipt"
          : form.type === "ISSUED"
          ? "Issue"
          : form.type === "TRANSFERRED"
          ? "Transfer"
          : "Adjustment"
      }`}
      description={`Record a stock ${form.type.toLowerCase()} transaction`}
      onSubmit={handleSubmit}
      submitLabel="Record Transaction"
      successMessage="Stock transaction recorded"
    >
      <div className="grid gap-4">
        <FormSelect
          label="Transaction Type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          options={[
            { value: "RECEIVED", label: "Received (Stock In)" },
            { value: "ISSUED", label: "Issued (Stock Out)" },
            { value: "TRANSFERRED", label: "Transfer" },
            { value: "ADJUSTED", label: "Adjustment" },
            { value: "RETURNED", label: "Returned" },
          ]}
        />

        <FormSelect
          label="Inventory Batch"
          value={form.batchId}
          onChange={(e) => setForm({ ...form, batchId: e.target.value })}
          options={batches.map((b) => ({
            value: b.id,
            label: `${b.itemName} — ${b.batchNumber} (${b.quantityRemaining} remaining)`,
          }))}
          placeholder="Select batch"
        />

        {selectedBatch && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p>
              <span className="font-medium">Item:</span> {selectedBatch.itemName}
            </p>
            <p>
              <span className="font-medium">Batch:</span>{" "}
              {selectedBatch.batchNumber}
            </p>
            <p>
              <span className="font-medium">Available:</span>{" "}
              {selectedBatch.quantityRemaining} {selectedBatch.unitOfMeasure}
            </p>
            {selectedBatch.expiryDate && (
              <p>
                <span className="font-medium">Expires:</span>{" "}
                {new Date(selectedBatch.expiryDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        <FormField
          label="Quantity"
          type="number"
          placeholder="Enter quantity"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          required
        />

        {showFromField && (
          <FormSelect
            label="From Warehouse"
            value={form.fromWarehouseId}
            onChange={(e) =>
              setForm({ ...form, fromWarehouseId: e.target.value })
            }
            options={warehouses.map((w) => ({
              value: w.id,
              label: `${w.name} (${w.farm?.name || "Unknown"})`,
            }))}
            placeholder="Select source warehouse"
          />
        )}

        {showToField && (
          <FormSelect
            label="To Warehouse"
            value={form.toWarehouseId}
            onChange={(e) =>
              setForm({ ...form, toWarehouseId: e.target.value })
            }
            options={warehouses.map((w) => ({
              value: w.id,
              label: `${w.name} (${w.farm?.name || "Unknown"})`,
            }))}
            placeholder="Select destination warehouse"
          />
        )}

        <FormSelect
          label="Farm"
          value={form.farmId}
          onChange={(e) => setForm({ ...form, farmId: e.target.value })}
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Select farm (optional)"
        />

        <FormSelect
          label="Performed By"
          value={form.performedById}
          onChange={(e) =>
            setForm({ ...form, performedById: e.target.value })
          }
          options={users.map((u) => ({
            value: u.id,
            label: `${u.name} (${u.role})`,
          }))}
          placeholder="Select user"
        />

        <FormField
          label="Reference Number"
          placeholder="e.g. PO-2026-001 or delivery note"
          value={form.referenceNumber}
          onChange={(e) =>
            setForm({ ...form, referenceNumber: e.target.value })
          }
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason / Notes</label>
          <Textarea
            placeholder="Optional reason for this transaction"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </div>
      </div>
    </FormDialog>
  );
}
