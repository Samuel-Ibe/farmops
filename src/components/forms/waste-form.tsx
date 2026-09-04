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
import { Loader2 } from "lucide-react";

interface WasteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WasteForm({ open, onOpenChange, onSuccess }: WasteFormProps) {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const { toast } = useToast();

  const [form, setForm] = useState({
    batchId: "",
    quantity: 0,
    wasteType: "EXPIRED",
    reason: "",
    farmId: "",
    estimatedValue: 0,
  });

  useEffect(() => {
    if (open) {
      Promise.all([
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/farms").then((r) => r.json()),
      ]).then(([items, f]) => {
        // Flatten batches from all items
        const allBatches = items.flatMap((item: any) =>
          (item.batches || [])
            .filter((b: any) => b.status === "ACTIVE")
            .map((b: any) => ({
              ...b,
              itemName: item.name,
              unit: item.unitOfMeasure,
            }))
        );
        setBatches(allBatches);
        setFarms(f);
      });

      setForm({
        batchId: "",
        quantity: 0,
        wasteType: "EXPIRED",
        reason: "",
        farmId: "",
        estimatedValue: 0,
      });
    }
  }, [open]);

  const selectedBatch = batches.find((b) => b.id === form.batchId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.batchId || !form.farmId) {
      toast("Please select a batch and farm", "error");
      return;
    }
    if (form.quantity <= 0) {
      toast("Quantity must be positive", "error");
      return;
    }
    if (selectedBatch && form.quantity > selectedBatch.quantityRemaining) {
      toast("Quantity exceeds available stock", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast("Waste recorded successfully", "success");
        onSuccess();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to record waste", "error");
      }
    } catch {
      toast("Failed to record waste", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Waste / Loss</DialogTitle>
          <DialogDescription>
            Record expired, damaged, spoiled, lost, or stolen inventory
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Inventory Batch *</Label>
            <FormSelect
              value={form.batchId}
              onChange={(e) => {
                const batch = batches.find((b) => b.id === e.target.value);
                setForm({
                  ...form,
                  batchId: e.target.value,
                  estimatedValue: batch
                    ? Number(batch.purchasePrice) * form.quantity
                    : 0,
                });
              }}
              options={batches.map((b) => ({
                value: b.id,
                label: `${b.itemName} — ${b.batchNumber} (${b.quantityRemaining} ${b.unit} left)`,
              }))}
              placeholder="Select batch"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={form.quantity || ""}
                onChange={(e) => {
                  const qty = parseFloat(e.target.value) || 0;
                  setForm({
                    ...form,
                    quantity: qty,
                    estimatedValue: selectedBatch
                      ? Number(selectedBatch.purchasePrice) * qty
                      : 0,
                  });
                }}
                placeholder="0"
              />
              {selectedBatch && (
                <p className="text-xs text-muted-foreground">
                  Max: {selectedBatch.quantityRemaining} {selectedBatch.unit}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Waste Type *</Label>
              <FormSelect
                value={form.wasteType}
                onChange={(e) => setForm({ ...form, wasteType: e.target.value })}
                options={[
                  { value: "EXPIRED", label: "Expired" },
                  { value: "DAMAGED", label: "Damaged" },
                  { value: "SPOILED", label: "Spoiled" },
                  { value: "LOST", label: "Lost" },
                  { value: "STOLEN", label: "Stolen" },
                ]}
              />
            </div>
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

          <div className="space-y-2">
            <Label>Estimated Value (GH₵)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.estimatedValue || ""}
              onChange={(e) =>
                setForm({ ...form, estimatedValue: parseFloat(e.target.value) || 0 })
              }
            />
            {selectedBatch && (
              <p className="text-xs text-muted-foreground">
                Auto-calculated: {form.quantity} × GH₵{Number(selectedBatch.purchasePrice)} = GH₵{form.estimatedValue}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason / Notes</Label>
            <Textarea
              placeholder="Describe what happened..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
            />
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
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Waste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
