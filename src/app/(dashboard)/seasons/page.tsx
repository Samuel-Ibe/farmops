"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SeasonForm } from "@/components/forms/season-form";
import { useToast } from "@/components/ui/toast";
import {
  Plus, Calendar, Loader2, Sun, Cloud, Pencil, Trash2,
} from "lucide-react";

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editSeason, setEditSeason] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const { toast } = useToast();

  const fetchSeasons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seasons");
      if (res.ok) setSeasons(await res.json());
    } catch (err) {
      console.error("Failed to fetch seasons:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/seasons/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Season deleted", "success");
      setDeleteTarget(null);
      fetchSeasons();
    } else {
      const err = await res.json();
      toast(err.error || "Failed to delete", "error");
    }
  };

  const filtered = seasons.filter(
    (s) => s.name?.toLowerCase().includes(search.toLowerCase()) || s.cropType?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300";
      case "PLANNING": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "COMPLETED": return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Seasons" description="Track farming seasons and plan inventory needs">
        <Button onClick={() => { setEditSeason(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Season
        </Button>
      </PageHeader>

      <SearchInput value={search} onChange={setSearch} placeholder="Search seasons..." className="max-w-sm" />

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No seasons found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search" : "Create your first farming season"}
            </p>
            {!search && (
              <Button onClick={() => { setEditSeason(null); setShowForm(true); }} className="mt-4">
                <Plus className="h-4 w-4 mr-2" /> New Season
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((season) => (
            <Card key={season.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {season.cropType?.toLowerCase().includes("rice") ? (
                      <Cloud className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Sun className="h-5 w-5 text-amber-600" />
                    )}
                    <CardTitle className="text-base">{season.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditSeason(season); setShowForm(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(season)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="outline" className={getStatusColor(season.status)}>{season.status}</Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(season.startDate).toLocaleDateString()} — {new Date(season.endDate).toLocaleDateString()}
                  </div>
                  {season.cropType && (
                    <p className="text-sm">Crop: <span className="font-medium">{season.cropType}</span></p>
                  )}
                  {season.farm?.name && (
                    <p className="text-xs text-muted-foreground">Farm: {season.farm.name}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SeasonForm
        open={showForm}
        onOpenChange={setShowForm}
        initialData={editSeason}
        onSuccess={() => { setShowForm(false); setEditSeason(null); fetchSeasons(); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Season"
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
