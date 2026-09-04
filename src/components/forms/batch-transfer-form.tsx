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
import { ArrowRightLeft } from "lucide-react";
import type { InventoryBatch, Warehouse } from "@prisma/client";

interface BatchTransferFormProps {
  open: boolean;
  onClose: () => void;
  batch: InventoryBatch & {
    item: { name: string; unitOfMeasure: string };
    warehouse: { name: string };
  };
  warehouses: Warehouse[];
  onSuccess: () => void;
}

export function BatchTransferForm({
  open,
  onClose,
  batch,
  warehouses,
  onSuccess,
}: BatchTransferFormProps) {
  const [quantity, setQuantity] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const otherWarehouses = warehouses.filter(
    (w) => w.isActive && w.id !== batch.warehouseId
  );

  useEffect(() => {
    if (open) {
      setQuantity("");
      setToWarehouseId(otherWarehouses[0]?.id || "");
      setNotes("");
      setError("");
    }
  }, [open, otherWarehouses]);

  const transferQty = parseFloat(quantity) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferQty || transferQty <= 0) {
      setError("Quantity must be positive");
      return;
    }
    if (!toWarehouseId) {
      setError("Please select a destination warehouse");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/batches/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.id,
          toWarehouseId,
          quantity: transferQty,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to transfer");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer stock");
    } finally {
      setLoading(false);
    }
  };

  const destWarehouse = warehouses.find((w) => w.id === toWarehouseId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            Transfer Stock
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <div className="font-medium">{batch.item.name}</div>
          <div className="mt-1 text-muted-foreground">
            Batch: <span className="font-mono">{batch.batchNumber}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {batch.warehouse.name}
            </span>
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {destWarehouse?.name || "Select destination"}
            </span>
          </div>
          <div className="mt-2 text-muted-foreground">
            Available:{" "}
            <span className="font-semibold text-foreground">
              {batch.quantityRemaining} {batch.item.unitOfMeasure}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="transferQty">
              Quantity ({batch.item.unitOfMeasure})
            </Label>
            <Input
              id="transferQty"
              type="number"
              step="0.01"
              min="0.01"
              max={batch.quantityRemaining}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity to transfer"
              className="mt-1"
              required
            />
            {transferQty > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Source: {(batch.quantityRemaining - transferQty).toFixed(2)}{" "}
                remaining
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="toWarehouse">Destination Warehouse</Label>
            <select
              id="toWarehouse"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select warehouse...</option>
              {otherWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.location || w.type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="transferNotes">Notes</Label>
            <Input
              id="transferNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer..."
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !transferQty || transferQty <= 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Transferring..." : "Transfer Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
