"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { formatCurrency } from "@/lib/utils";
import { WasteForm } from "@/components/forms/waste-form";
import {
  Plus,
  AlertTriangle,
  Package,
  Loader2,
} from "lucide-react";

export default function WastePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchWaste = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/waste");
      if (res.ok) { const json = await res.json(); setRecords(Array.isArray(json) ? json : json?.data || []); }
    } catch (err) {
      console.error("Failed to fetch waste records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaste();
  }, []);

  const safeRecords = Array.isArray(records) ? records : [];
  const filtered = safeRecords.filter(
    (r) =>
      r.batch?.item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCost = records.reduce((sum, r) => sum + Number(r.estimatedValue || 0), 0);

  const getReasonColor = (reason: string) => {
    switch (reason?.toUpperCase()) {
      case "EXPIRED":
      case "EXPIRING":
        return "bg-red-50 text-red-700 border-red-200";
      case "DAMAGED":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "STOLEN":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "LOST":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waste & Losses"
        description="Track expired, damaged, or lost inventory"
      >
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Report Waste
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{records.length}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCost.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Loss Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {safeRecords.filter((r) => r.wasteType?.toUpperCase() === "EXPIRED").length}
                </p>
                <p className="text-xs text-muted-foreground">Expired Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search waste records..."
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No waste records found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search" : "No waste recorded yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((record) => (
                <div key={record.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{record.batch?.item?.name || "Unknown Item"}</p>
                        <Badge variant="outline" className={getReasonColor(record.wasteType)}>
                          {record.wasteType || "Unknown"}
                        </Badge>
                      </div>                    <p className="text-sm text-muted-foreground mt-1">
                        {record.quantity} {record.batch?.item?.unitOfMeasure || "units"} — Batch: {" "}
                        {record.batch?.batchNumber || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">                      {formatCurrency(Number(record.estimatedValue || 0))}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.reportedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {record.reason && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{record.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WasteForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          fetchWaste();
        }}
      />
    </div>
  );
}
