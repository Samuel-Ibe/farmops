"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FarmForm } from "@/components/forms/farm-form";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Tractor,
  MapPin,
  Warehouse,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

export default function FarmsPage() {
  const [farms, setFarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editFarm, setEditFarm] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const { toast } = useToast();

  const fetchFarms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/farms");
      if (res.ok) setFarms(await res.json());
    } catch (err) {
      console.error("Failed to fetch farms:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFarms();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/farms/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Farm deleted successfully", "success");
      setDeleteTarget(null);
      fetchFarms();
    } else {
      const err = await res.json();
      toast(err.error || "Failed to delete farm", "error");
    }
  };

  const filtered = farms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farms"
        description="Manage your farm locations and operations"
      >
        <Button onClick={() => { setEditFarm(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Farm
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search farms..."
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tractor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No farms found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search" : "Add your first farm"}
            </p>
            {!search && (
              <Button onClick={() => { setEditFarm(null); setShowForm(true); }} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Farm
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((farm) => (
            <Card key={farm.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <Tractor className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{farm.name}</CardTitle>
                      {farm.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {farm.location}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditFarm(farm); setShowForm(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(farm)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {farm.acreage && (
                    <p className="text-sm text-muted-foreground">
                      Size: {farm.acreage} acres
                    </p>
                  )}
                  {farm._count && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Warehouse className="h-4 w-4" />
                      {farm._count.warehouses || 0} warehouse
                      {(farm._count.warehouses || 0) !== 1 ? "es" : ""}
                    </div>
                  )}
                  {farm.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {farm.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FarmForm
        open={showForm}
        onOpenChange={setShowForm}
        initialData={editFarm}
        onSuccess={() => {
          setShowForm(false);
          setEditFarm(null);
          fetchFarms();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Farm"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This may deactivate the farm instead if it has associated data.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
