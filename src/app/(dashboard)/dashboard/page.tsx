"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import {
  Package,
  Warehouse,
  TrendingUp,
  AlertTriangle,
  Clock,
  ClipboardList,
  Tractor,
  DollarSign,
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const COLORS = ["#16a34a", "#ca8a04", "#dc2626", "#2563eb", "#7c3aed", "#0891b2", "#d946ef"];

interface DashboardData {
  totalItems: number;
  inventoryValue: number;
  lowStockItems: number;
  expiringSoon: number;
  pendingRequests: number;
  activeFarms: number;
  totalWarehouses: number;
  totalTransactions: number;
  recentTransactions: any[];
  lowStockAlerts: any[];
  inventoryValueByCategory: { name: string; value: number; color: string }[];
  transactionTrends: { name: string; received: number; issued: number; wasted: number }[];
  wasteBreakdown: { name: string; value: number }[];
  topSuppliers: { name: string; orders: number; value: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      // One server-side aggregated request; farm scope comes from the
      // session inside the route — never from query parameters.
      const res = await fetch("/api/dashboard/overview");
      if (!res.ok) throw new Error(`Dashboard request failed: ${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <Button onClick={fetchDashboard} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const stats = [
    { title: "Total Items", value: data.totalItems.toString(), icon: Package, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950" },
    { title: "Inventory Value", value: `GH₵ ${data.inventoryValue.toLocaleString()}`, icon: DollarSign, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950" },
    { title: "Low Stock Items", value: data.lowStockItems.toString(), icon: AlertTriangle, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950" },
    { title: "Pending Requests", value: data.pendingRequests.toString(), icon: ClipboardList, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950" },
    { title: "Active Farms", value: data.activeFarms.toString(), icon: Tractor, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950" },
    { title: "Transactions", value: data.totalTransactions.toString(), icon: ArrowRightLeft, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your farm inventory and operations"
      >
        <Button variant="outline" onClick={fetchDashboard}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transaction Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Transaction Trends
            </CardTitle>
            <CardDescription>Stock movements over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.transactionTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="received" fill="#16a34a" name="Received" radius={[2, 2, 0, 0]} />
                <Bar dataKey="issued" fill="#2563eb" name="Issued" radius={[2, 2, 0, 0]} />
                <Bar dataKey="wasted" fill="#dc2626" name="Wasted" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Inventory Value by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value by Category</CardTitle>
            <CardDescription>Current stock value distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {data.inventoryValueByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No inventory data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.inventoryValueByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {data.inventoryValueByCategory.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `GH₵ ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Items below minimum stock level</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lowStockAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">All items are well-stocked</p>
            ) : (
              <div className="space-y-3">
                {data.lowStockAlerts.map((alert: any) => {
                  const current = alert.totalQuantity || 0;
                  const minimum = alert.minimumStockLevel || 1;
                  const pct = Math.min((current / minimum) * 100, 100);
                  const isCritical = pct < 50;

                  return (
                    <div key={alert.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{alert.name}</p>
                        <Badge variant="outline" className={isCritical ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"}>
                          {isCritical ? "critical" : "warning"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{current} / {minimum} {alert.unitOfMeasure}</span>
                        <span>{alert.batches?.[0]?.warehouse?.name || "N/A"}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className={`h-full rounded-full ${isCritical ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waste Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Waste Breakdown
            </CardTitle>
            <CardDescription>Waste recorded by type</CardDescription>
          </CardHeader>
          <CardContent>
            {data.wasteBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No waste recorded</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.wasteBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={100} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Suppliers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-500" />
              Top Suppliers
            </CardTitle>
            <CardDescription>Purchase order value by supplier</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No purchase orders yet</p>
            ) : (
              <div className="space-y-3">
                {data.topSuppliers.map((supplier, i) => {
                  const maxVal = data.topSuppliers[0]?.value || 1;
                  const pct = (supplier.value / maxVal) * 100;
                  return (
                    <div key={supplier.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{supplier.name}</span>
                        <span className="text-muted-foreground">
                          {supplier.orders} orders • GH₵ {supplier.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest stock movements across all farms</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      {tx.type === "RECEIVED" && <ArrowDown className="h-4 w-4 text-green-600" />}
                      {tx.type === "ISSUED" && <ArrowUp className="h-4 w-4 text-blue-600" />}
                      {tx.type === "TRANSFERRED" && <ArrowRightLeft className="h-4 w-4 text-purple-600" />}
                      {tx.type === "WASTED" && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      {tx.type === "ADJUSTED" && <TrendingUp className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {tx.batch?.item?.name || tx.batchNumber || "Unknown"}
                        </p>
                        <StatusBadge status={tx.type} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tx.quantity} {tx.batch?.item?.unitOfMeasure || "units"} •{" "}
                        {tx.fromWarehouse?.name || tx.toWarehouse?.name || "N/A"}
                        {tx.performedBy?.name && ` • ${tx.performedBy.name}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
