"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Scissors } from "lucide-react";
import type { InventoryBatch, Warehouse } from "@prisma/client";

interface BatchSplitFormProps {
  open: boolean;
  onClose: () => void;
  batch: InventoryBatch & {
    item: { name: string; unitOfMeasure: string };
    warehouse: { name: string };
  };
  warehouses: Warehouse[];
  onSuccess: () => void;
}

export function BatchSplitForm({
  open,
  onClose,
  batch,
  warehouses,
  onSuccess,
}: BatchSplitFormProps) {
  const [splitQuantity, setSplitQuantity] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [newBatchNumber, setNewBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSplitQuantity("");
      setTargetWarehouseId(batch.warehouseId);
      setNewBatchNumber("");
      setNotes("");
      setError("");
    }
  }, [open, batch.warehouseId]);

  const splitQty = parseFloat(splitQuantity) || 0;
  const remaining = batch.quantityRemaining - splitQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitQty || splitQty <= 0 || splitQty >= batch.quantityRemaining) {
      setError("Split quantity must be positive and less than remaining quantity");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/batches/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.id,
          splitQuantity: splitQty,
          targetWarehouseId: targetWarehouseId || undefined,
          newBatchNumber: newBatchNumber || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to split batch");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to split batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-green-600" />
            Split Batch
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <div className="font-medium">{batch.item.name}</div>
          <div className="mt-1 text-muted-foreground">
            Batch: <span className="font-mono">{batch.batchNumber}</span>
          </div>
          <div className="mt-1 text-muted-foreground">
            Remaining:{" "}
            <span className="font-semibold text-foreground">
              {batch.quantityRemaining} {batch.item.unitOfMeasure}
            </span>
          </div>
          <div className="mt-1 text-muted-foreground">
            Location: {batch.warehouse.name}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="splitQty">
              Quantity to Split ({batch.item.unitOfMeasure})
            </Label>
            <Input
              id="splitQty"
              type="number"
              step="0.01"
              min="0.01"
              max={batch.quantityRemaining - 0.01}
              value={splitQuantity}
              onChange={(e) => setSplitQuantity(e.target.value)}
              placeholder="Enter quantity to split off"
              className="mt-1"
              required
            />
            {splitQty > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Source will have {remaining.toFixed(2)} remaining • New batch:{" "}
                {splitQty.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="targetWarehouse">Target Warehouse</Label>
            <select
              id="targetWarehouse"
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {warehouses
                .filter((w) => w.isActive)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.id === batch.warehouseId ? " (current)" : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <Label htmlFor="newBatchNumber">
              New Batch Number{" "}
              <span className="text-muted-foreground">(auto-generated if empty)</span>
            </Label>
            <Input
              id="newBatchNumber"
              value={newBatchNumber}
              onChange={(e) => setNewBatchNumber(e.target.value)}
              placeholder={`${batch.batchNumber}-S...`}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="splitNotes">Notes</Label>
            <Input
              id="splitNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for split..."
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !splitQty || splitQty <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? "Splitting..." : "Split Batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
