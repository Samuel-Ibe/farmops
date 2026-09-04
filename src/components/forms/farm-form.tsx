"use client";

import { useState, useEffect } from "react";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

interface FarmFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: any;
}

export function FarmForm({
  open,
  onOpenChange,
  onSuccess,
  initialData,
}: FarmFormProps) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    acreage: "",
    description: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        location: initialData.location || "",
        acreage: initialData.acreage?.toString() || "",
        description: initialData.description || "",
      });
    } else {
      setForm({ name: "", location: "", acreage: "", description: "" });
    }
  }, [initialData, open]);

  const handleSubmit = async () => {
    const url = initialData ? `/api/farms/${initialData.id}` : "/api/farms";
    const method = initialData ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        acreage: form.acreage ? parseFloat(form.acreage) : null,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save farm");
    }

    onSuccess();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Edit Farm" : "Add New Farm"}
      description="Configure a farm location"
      onSubmit={handleSubmit}
      submitLabel={initialData ? "Update Farm" : "Add Farm"}
      successMessage={initialData ? "Farm updated" : "Farm created"}
    >
      <div className="grid gap-4">
        <FormField
          label="Farm Name"
          placeholder="e.g. Kumasi Farm"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <FormField
          label="Location"
          placeholder="e.g. Kumasi, Ashanti Region"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          required
        />

        <FormField
          label="Acreage"
          type="number"
          placeholder="e.g. 50"
          value={form.acreage}
          onChange={(e) => setForm({ ...form, acreage: e.target.value })}
          description="Farm size in acres"
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            placeholder="Optional description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </div>
    </FormDialog>
  );
}
