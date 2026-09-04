"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/ui/toast";
import {
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Activity,
  RefreshCw,
  Loader2,
  Brain,
  Package,
  ArrowDown,
  Clock,
  Zap,
  Target,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function IntelligencePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("forecast");
  const { toast } = useToast();

  const fetchIntelligence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence?analysis=all");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch intelligence data:", err);
      toast("Failed to load intelligence data", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory Intelligence" description="AI-powered forecasting and recommendations" />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
            <p className="mt-4 text-muted-foreground">Analyzing inventory data...</p>
            <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">No intelligence data available</p>
        <Button onClick={fetchIntelligence} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const forecasts = data.forecasting || [];
  const reorderRecs = data.reorderRecommendations || [];
  const anomalies = data.anomalies || [];
  const summary = data.summary || {};

  const criticalCount = reorderRecs.filter((r: any) => r.urgency === "critical").length;
  const warningCount = reorderRecs.filter((r: any) => r.urgency === "warning").length;
  const highAnomalies = anomalies.filter((a: any) => a.severity === "critical" || a.severity === "high").length;
  const itemsAtRisk = forecasts.filter((f: any) => f.monthsOfStockLeft < 3).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Intelligence"
        description="AI-powered forecasting, reorder recommendations, and anomaly detection"
      >
        <Button variant="outline" onClick={fetchIntelligence}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Analysis
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalItems || 0}</p>
                <p className="text-xs text-muted-foreground">Items Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalCount + warningCount}</p>
                <p className="text-xs text-muted-foreground">Items to Reorder</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highAnomalies}</p>
                <p className="text-xs text-muted-foreground">Anomalies Detected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{itemsAtRisk}</p>
                <p className="text-xs text-muted-foreground">Stockout Risk (&lt;3 mo)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Consumption Forecast
          </TabsTrigger>
          <TabsTrigger value="reorder" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Reorder Alerts
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Anomalies
          </TabsTrigger>
        </TabsList>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consumption Forecasting</CardTitle>
              <CardDescription>
                Weighted moving average prediction based on 6 months of transaction data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {forecasts.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No forecasting data available yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {forecasts
                    .sort((a: any, b: any) => a.monthsOfStockLeft - b.monthsOfStockLeft)
                    .map((f: any) => {
                      const riskLevel =
                        f.monthsOfStockLeft < 1 ? "critical" :
                        f.monthsOfStockLeft < 3 ? "warning" :
                        f.monthsOfStockLeft < 6 ? "low" : "safe";

                      return (
                        <ForecastRow key={f.itemId} forecast={f} riskLevel={riskLevel} />
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reorder Tab */}
        <TabsContent value="reorder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reorder Recommendations</CardTitle>
              <CardDescription>
                Items that need restocking based on current levels and consumption patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reorderRecs.filter((r: any) => r.urgency !== "none").length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-10 w-10 mx-auto text-green-500 mb-3" />
                  <p className="font-medium">All items are well-stocked!</p>
                  <p className="text-sm text-muted-foreground mt-1">No reorder actions needed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reorderRecs
                    .filter((r: any) => r.urgency !== "none")
                    .map((rec: any) => (
                      <ReorderCard key={rec.itemId} rec={rec} />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection</CardTitle>
              <CardDescription>
                Unusual patterns detected in consumption, waste, and stock levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-10 w-10 mx-auto text-green-500 mb-3" />
                  <p className="font-medium">No anomalies detected</p>
                  <p className="text-sm text-muted-foreground mt-1">All inventory patterns look normal</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((anomaly: any, i: number) => (
                    <AnomalyCard key={i} anomaly={anomaly} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────

function ForecastRow({ forecast, riskLevel }: { forecast: any; riskLevel: string }) {
  const [expanded, setExpanded] = useState(false);

  const riskColors: Record<string, { badge: string; bar: string; text: string }> = {
    critical: { badge: "bg-red-50 text-red-700 border-red-200", bar: "bg-red-500", text: "text-red-600" },
    warning: { badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500", text: "text-amber-600" },
    low: { badge: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-blue-500", text: "text-blue-600" },
    safe: { badge: "bg-green-50 text-green-700 border-green-200", bar: "bg-green-500", text: "text-green-600" },
  };

  const colors = riskColors[riskLevel] || riskColors.safe;
  const maxMonthly = Math.max(...forecast.monthlyUsage, 1);
  const barWidth = Math.min((forecast.avgMonthlyConsumption / maxMonthly) * 100, 100);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{forecast.itemName}</h4>
            <Badge variant="outline" className="text-xs">{forecast.category}</Badge>
            <Badge variant="outline" className={`text-xs ${colors.badge}`}>
              {riskLevel === "critical" ? "At Risk" : riskLevel === "warning" ? "Watch" : riskLevel === "low" ? "Monitor" : "Healthy"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>Stock: <strong className="text-foreground">{forecast.currentStock}</strong> {forecast.unit}</span>
            <span>Avg/month: <strong className="text-foreground">{forecast.avgMonthlyConsumption}</strong></span>
            <span className={colors.text}>
              {forecast.monthsOfStockLeft === Infinity ? "∞" : `${forecast.monthsOfStockLeft}`} months left
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">3-month forecast</p>
          <p className="font-bold">{forecast.forecast3Months} {forecast.unit}</p>
        </div>
      </div>

      {/* Consumption bar */}
      <div className="mt-3">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Hide" : "Show"} monthly usage
      </button>

      {expanded && (
        <div className="mt-2 flex gap-2">
          {forecast.monthlyUsage.map((v: number, i: number) => {
            const monthDate = new Date();
            monthDate.setMonth(monthDate.getMonth() - (5 - i));
            const monthName = monthDate.toLocaleString("default", { month: "short" });
            const pct = maxMonthly > 0 ? (v / maxMonthly) * 100 : 0;
            return (
              <div key={i} className="flex-1 text-center">
                <div className="h-16 relative bg-gray-50 rounded">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-blue-400 rounded-b"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] mt-1">{monthName}</p>
                <p className="text-[10px] font-medium">{v}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReorderCard({ rec }: { rec: any }) {
  const urgencyStyles: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
    critical: { bg: "bg-red-50/50", border: "border-red-200", icon: "text-red-600", badge: "bg-red-100 text-red-700" },
    warning: { bg: "bg-amber-50/50", border: "border-amber-200", icon: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
    low: { bg: "bg-blue-50/50", border: "border-blue-200", icon: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
  };

  const style = urgencyStyles[rec.urgency] || urgencyStyles.low;

  return (
    <div className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {rec.urgency === "critical" ? (
              <AlertTriangle className={`h-5 w-5 ${style.icon}`} />
            ) : rec.urgency === "warning" ? (
              <Clock className={`h-5 w-5 ${style.icon}`} />
            ) : (
              <Package className={`h-5 w-5 ${style.icon}`} />
            )}
            <h4 className="font-semibold">{rec.itemName}</h4>
            <Badge className={`text-xs ${style.badge}`}>{rec.urgency}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Current Stock</p>
              <p className="font-medium">{rec.currentStock} {rec.unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reorder Point</p>
              <p className="font-medium">{rec.reorderPoint} {rec.unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Order Quantity</p>
              <p className="font-bold text-green-700">{rec.recommendedQuantity} {rec.unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Supplier</p>
              <p className="font-medium">{rec.defaultSupplier || "N/A"}</p>
            </div>
          </div>
          {rec.expiryWarnings?.length > 0 && (
            <div className="mt-3 rounded bg-amber-50 border border-amber-100 p-2">
              <p className="text-xs font-medium text-amber-800">⚠ Expiry warnings:</p>
              {rec.expiryWarnings.map((w: any, i: number) => (
                <p key={i} className="text-xs text-amber-700">
                  Batch {w.batchNumber}: {w.quantityRemaining} {rec.unit} expires in {w.daysUntilExpiry} days
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnomalyCard({ anomaly }: { anomaly: any }) {
  const severityStyles: Record<string, { bg: string; border: string; icon: React.ReactNode; badge: string }> = {
    critical: {
      bg: "bg-red-50/50",
      border: "border-red-200",
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      badge: "bg-red-100 text-red-700",
    },
    high: {
      bg: "bg-orange-50/50",
      border: "border-orange-200",
      icon: <Zap className="h-5 w-5 text-orange-600" />,
      badge: "bg-orange-100 text-orange-700",
    },
    medium: {
      bg: "bg-amber-50/50",
      border: "border-amber-200",
      icon: <Activity className="h-5 w-5 text-amber-600" />,
      badge: "bg-amber-100 text-amber-700",
    },
  };

  const style = severityStyles[anomaly.severity] || severityStyles.medium;

  const typeLabels: Record<string, string> = {
    CONSUMPTION_SPIKE: "Consumption Spike",
    HIGH_WASTE: "High Waste",
    NEAR_DEPLETION: "Near Depletion",
  };

  return (
    <div className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        {style.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{typeLabels[anomaly.type] || anomaly.type}</h4>
            <Badge className={`text-xs ${style.badge}`}>{anomaly.severity}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{anomaly.message}</p>
          {anomaly.type === "CONSUMPTION_SPIKE" && (
            <div className="mt-2 flex gap-4 text-sm">
              <span>Average: {anomaly.average}</span>
              <span>Actual: <strong>{anomaly.value}</strong></span>
              <span className="font-medium text-red-600">+{anomaly.deviation}%</span>
            </div>
          )}
          {anomaly.type === "HIGH_WASTE" && (
            <div className="mt-2 text-sm">
              <span>Waste ratio: <strong className="text-red-600">{anomaly.wasteRatio}%</strong></span>
              <span className="ml-4">Wasted: {anomaly.wasteQuantity} units</span>
            </div>
          )}
          {anomaly.type === "NEAR_DEPLETION" && (
            <div className="mt-2 text-sm">
              <span>Batch: <strong className="font-mono">{anomaly.batchNumber}</strong></span>
              <span className="ml-4">Remaining: <strong className="text-red-600">{anomaly.remaining}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
