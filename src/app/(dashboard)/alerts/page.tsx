"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  Package,
  TrendingDown,
  RefreshCw,
  Bell,
  Trash2,
  ShoppingCart,
} from "lucide-react";

interface AlertItem {
  id: string;
  type: string;
  urgency: string;
  itemName: string;
  batchNumber?: string;
  unitOfMeasure: string;
  quantityRemaining?: number;
  currentStock?: number;
  warehouseName?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  estimatedValue?: number;
  reorderPoint?: number;
  minimumStockLevel?: number;
  reorderQuantity?: number;
  category?: string;
  totalValue?: number;
  batchCount?: number;
  warehouses?: string;
}

interface AlertSummary {
  totalAlerts: number;
  expiredCount: number;
  criticalCount: number;
  lowStockCount: number;
  expiryWarningCount: number;
  potentialWasteValue: number;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<{
    expiry: AlertItem[];
    lowStock: AlertItem[];
    criticalStock: AlertItem[];
    expiringBatches: AlertItem[];
  }>({ expiry: [], lowStock: [], criticalStock: [], expiringBatches: [] });
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "expiry" | "stock">("all");
  const [generating, setGenerating] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts?type=all&daysAhead=90");
      const data = await res.json();
      setAlerts(data.alerts);
      setSummary(data.summary);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const generateNotifications = async () => {
    setGenerating(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysAhead: 30 }),
      });
      fetchAlerts();
    } finally {
      setGenerating(false);
    }
  };

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case "EXPIRED":
      case "CRITICAL":
      case "OUT_OF_STOCK":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "HIGH":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  const allAlerts = [
    ...alerts.expiringBatches.map((a) => ({ ...a, category: "expiry" })),
    ...alerts.lowStock.map((a) => ({ ...a, category: "stock" })),
  ].sort((a, b) => {
    const urgencyOrder: Record<string, number> = {
      EXPIRED: 0,
      CRITICAL: 0,
      OUT_OF_STOCK: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return (
      (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4)
    );
  });

  const filteredAlerts =
    activeTab === "all"
      ? allAlerts
      : allAlerts.filter((a) =>
          activeTab === "expiry" ? a.category === "expiry" : a.category === "stock"
        );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts & Warnings</h1>
          <p className="text-muted-foreground">
            Expiry warnings, low stock alerts, and critical inventory notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={generateNotifications}
            disabled={generating}
            className="bg-green-600 hover:bg-green-700"
          >
            <Bell className="mr-2 h-4 w-4" />
            {generating ? "Generating..." : "Push Notifications"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Total Alerts
            </div>
            <div className="mt-2 text-3xl font-bold">{summary.totalAlerts}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <Clock className="h-4 w-4" />
              Expired / Critical
            </div>
            <div className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
              {summary.expiredCount + summary.criticalCount}
            </div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <Package className="h-4 w-4" />
              Expiry Warnings
            </div>
            <div className="mt-2 text-3xl font-bold text-orange-600 dark:text-orange-400">
              {summary.expiryWarningCount}
            </div>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <TrendingDown className="h-4 w-4" />
              Low Stock
            </div>
            <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {summary.lowStockCount}
            </div>
          </div>
        </div>
      )}

      {/* Potential Waste Value */}
      {summary && summary.potentialWasteValue > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-700 dark:text-red-400">
              Potential Waste Value: GH₵{" "}
              {summary.potentialWasteValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-sm text-red-600/70 dark:text-red-400/70">
              — from expiring batches within 90 days
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {[
          {
            key: "all" as const,
            label: "All Alerts",
            count: allAlerts.length,
          },
          {
            key: "expiry" as const,
            label: "Expiry",
            count: alerts.expiringBatches.length,
          },
          {
            key: "stock" as const,
            label: "Low Stock",
            count: alerts.lowStock.length,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <Package className="h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-semibold">All Clear!</h3>
          <p className="text-sm text-muted-foreground">
            No alerts found. Your inventory is in good shape.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={`${alert.category}-${alert.id}`}
              className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {alert.category === "expiry" ? (
                      <Clock className="h-4 w-4 text-orange-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-semibold">{alert.itemName}</span>
                    <Badge
                      variant="secondary"
                      className={urgencyColor(alert.urgency)}
                    >
                      {alert.urgency.replace("_", " ")}
                    </Badge>
                    {alert.category === "expiry" && (
                      <Badge variant="outline" className="text-xs">
                        Expiry Alert
                      </Badge>
                    )}
                    {alert.category === "stock" && (
                      <Badge variant="outline" className="text-xs">
                        Low Stock
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {alert.batchNumber && (
                      <span>
                        Batch: <span className="font-mono">{alert.batchNumber}</span>
                      </span>
                    )}
                    {alert.warehouseName && (
                      <span>Warehouse: {alert.warehouseName}</span>
                    )}
                    {alert.warehouses && (
                      <span>Warehouses: {alert.warehouses}</span>
                    )}
                    {alert.quantityRemaining !== undefined && (
                      <span>
                        Remaining:{" "}
                        <span className="font-medium text-foreground">
                          {alert.quantityRemaining} {alert.unitOfMeasure}
                        </span>
                      </span>
                    )}
                    {alert.currentStock !== undefined && (
                      <span>
                        Stock:{" "}
                        <span className="font-medium text-foreground">
                          {alert.currentStock} {alert.unitOfMeasure}
                        </span>
                      </span>
                    )}
                    {alert.category && (
                      <span className="capitalize">Type: {alert.category}</span>
                    )}
                  </div>

                  {/* Expiry-specific details */}
                  {alert.category === "expiry" && alert.expiryDate && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Expires:{" "}
                        {new Date(alert.expiryDate).toLocaleDateString()}
                      </span>
                      {alert.daysUntilExpiry !== undefined && (
                        <span
                          className={
                            alert.daysUntilExpiry <= 7
                              ? "font-medium text-red-600"
                              : alert.daysUntilExpiry <= 30
                                ? "font-medium text-orange-600"
                                : ""
                          }
                        >
                          {alert.daysUntilExpiry <= 0
                            ? "EXPIRED"
                            : `${alert.daysUntilExpiry} days left`}
                        </span>
                      )}
                      {alert.estimatedValue !== undefined && (
                        <span>
                          Est. value: GH₵ {alert.estimatedValue.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock-specific details */}
                  {alert.category === "stock" && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {alert.reorderPoint !== undefined && (
                        <span>Reorder point: {alert.reorderPoint}</span>
                      )}
                      {alert.reorderQuantity !== undefined && (
                        <span>Reorder qty: {alert.reorderQuantity}</span>
                      )}
                      {alert.totalValue !== undefined && (
                        <span>
                          Total value: GH₵ {alert.totalValue.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  {alert.category === "stock" &&
                    alert.reorderQuantity &&
                    alert.reorderQuantity > 0 && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            (window.location.href = `/purchase-orders?create=true&itemId=${alert.id}`)
                          }
                        >
                          <ShoppingCart className="mr-1 h-3 w-3" />
                          Create PO for {alert.reorderQuantity}{" "}
                          {alert.unitOfMeasure}
                        </Button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
