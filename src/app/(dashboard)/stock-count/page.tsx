"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StockCountForm } from "@/components/forms/stock-count-form";
import {
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function StockCountPage() {
  const [counts, setCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-count");
      if (res.ok) { const json = await res.json(); setCounts(Array.isArray(json) ? json : json?.data || []); }
    } catch (err) {
      console.error("Failed to fetch stock counts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const safeCounts = Array.isArray(counts) ? counts : [];
  const filtered = safeCounts.filter(
    (c) =>
      c.warehouse?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.countedBy?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Physical Stock Counts"
        description="Compare system inventory with physical counts"
      >
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Count
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search stock counts..."
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
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No stock counts found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search" : "Start your first physical stock count"}
              </p>
              {!search && (
                <Button onClick={() => setShowForm(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  New Stock Count
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((count) => {
                const totalItems = count.items?.length || 0;
                const discrepancies = count.items?.filter(
                  (i: any) => Math.abs(i.variance || 0) > 0
                ).length || 0;
                const totalVariance = count.items?.reduce(
                  (sum: number, i: any) => sum + (i.variance || 0),
                  0
                ) || 0;
                const isExpanded = expandedId === count.id;

                return (
                  <div key={count.id} className="rounded-lg border overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : count.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          discrepancies > 0 ? "bg-amber-50" : "bg-green-50"
                        }`}>
                          {discrepancies > 0 ? (
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {count.warehouse?.name || "Unknown Warehouse"}
                            </p>
                            <Badge
                              variant="outline"
                              className={
                                discrepancies > 0
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                              }
                            >
                              {discrepancies > 0 ? `${discrepancies} discrepancies` : "All matched"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Counted by {count.countedBy?.name || "Unknown"} •{" "}
                            {new Date(count.countDate || count.createdAt).toLocaleDateString()} •{" "}
                            {totalItems} batch{totalItems !== 1 ? "es" : ""} counted
                            {totalVariance !== 0 && (
                              <span className={totalVariance > 0 ? "text-green-600" : "text-red-600"}>
                                {" "}• Net variance: {totalVariance > 0 ? "+" : ""}{totalVariance}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {count.status && (
                            <Badge variant="outline" className="text-xs">
                              {count.status}
                            </Badge>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && count.items && count.items.length > 0 && (
                      <div className="border-t bg-gray-50/50 p-4">
                        <div className="grid gap-2">
                          {count.items.map((item: any) => {
                            const variance = item.variance || 0;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between text-sm py-2 px-3 rounded ${
                                  variance !== 0 ? "bg-amber-50 border border-amber-100" : "bg-white border"
                                }`}
                              >
                                <div>
                                  <span className="font-medium">{item.batch?.item?.name || "Unknown"}</span>
                                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                                    {item.batch?.batchNumber}
                                  </span>
                                </div>
                                <div className="flex items-center gap-6 text-xs">
                                  <span>System: <strong>{item.systemQuantity}</strong></span>
                                  <span>Counted: <strong>{item.countedQuantity}</strong></span>
                                  <span className={`font-bold ${
                                    variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-muted-foreground"
                                  }`}>
                                    Variance: {variance > 0 ? "+" : ""}{variance}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {count.notes && (
                          <p className="text-xs text-muted-foreground mt-3 italic">{count.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <StockCountForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          fetchCounts();
        }}
      />
    </div>
  );
}
