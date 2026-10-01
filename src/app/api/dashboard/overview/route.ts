import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, resolveFarmScope } from "@/lib/api-auth";
import { cachedJsonResponse } from "@/lib/pagination";
import { logRouteError } from "@/lib/logger";

/**
 * GET /api/dashboard/overview
 *
 * Server-side dashboard aggregation (was: 7 parallel API fetches aggregated
 * in the browser). One authorization-sensitive round trip, scope resolved
 * exclusively from the session — a client-supplied farmId is ignored — and a
 * dedicated DTO the dashboard renders directly.
 */

export interface DashboardOverviewDTO {
  totalItems: number;
  inventoryValue: number;
  lowStockItems: number;
  expiringSoon: number;
  pendingRequests: number;
  activeFarms: number;
  totalWarehouses: number;
  totalTransactions: number;
  recentTransactions: unknown[];
  lowStockAlerts: unknown[];
  inventoryValueByCategory: { name: string; value: number; color: string }[];
  transactionTrends: { name: string; received: number; issued: number; wasted: number }[];
  wasteBreakdown: { name: string; value: number }[];
  topSuppliers: { name: string; orders: number; value: number }[];
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;

    // Session-derived scope only; admins see everything, everyone else is
    // pinned (fail-closed via NO_FARM_MATCH for unassigned users).
    const farmId = resolveFarmScope(user);
    const farmFilter = farmId ? { farmId } : {};
    const warehouseFarmFilter = farmId ? { warehouse: { farmId } } : {};
    const batchFilter = { status: "ACTIVE" as const, ...warehouseFarmFilter };

    const expiryHorizon = new Date();
    expiryHorizon.setDate(expiryHorizon.getDate() + 30);

    const [items, pendingRequests, transactions, totalTransactions, activeFarms, totalWarehouses, expiringSoon, pos, waste] =
      await Promise.all([
        prisma.inventoryItem.findMany({
          where: { isActive: true },
          include: {
            category: true,
            batches: {
              where: batchFilter,
              include: { warehouse: { include: { farm: true } } },
            },
            _count: { select: { batches: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.resourceRequest.count({ where: { status: "PENDING", ...farmFilter } }),
        prisma.stockTransaction.findMany({
          where: farmFilter,
          include: {
            batch: { include: { item: true } },
            fromWarehouse: true,
            toWarehouse: true,
            performedBy: { select: { name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.stockTransaction.count({ where: farmFilter }),
        prisma.farm.count({ where: farmId ? { id: farmId } : {} }),
        prisma.warehouse.count({ where: farmId ? { farmId } : {} }),
        prisma.inventoryBatch.count({
          where: {
            status: "ACTIVE",
            expiryDate: { lte: expiryHorizon },
            ...warehouseFarmFilter,
          },
        }),
        prisma.purchaseOrder.findMany({
          where: farmFilter,
          include: { supplier: { select: { name: true } } },
        }),
        prisma.wasteRecord.findMany({
          where: farmFilter,
          select: { wasteType: true, quantity: true },
        }),
      ]);

    const itemsWithTotals = items.map((item) => ({
      ...item,
      totalQuantity: item.batches.reduce((sum, b) => sum + b.quantityRemaining, 0),
      totalValue: item.batches.reduce(
        (sum, b) => sum + Number(b.purchasePrice) * b.quantityRemaining,
        0
      ),
    }));

    const inventoryValue = itemsWithTotals.reduce((sum, item) => sum + item.totalValue, 0);
    const lowStock = itemsWithTotals.filter(
      (item) =>
        item.totalQuantity <= (item.minimumStockLevel || 0) && item.minimumStockLevel > 0
    );

    // Category value breakdown
    const catMap = new Map<string, { value: number; color: string }>();
    itemsWithTotals.forEach((item) => {
      const cat = item.category?.name || "Other";
      const existing = catMap.get(cat) || { value: 0, color: item.category?.color || "#6b7280" };
      catMap.set(cat, { value: existing.value + item.totalValue, color: existing.color });
    });

    // Transaction trends (last 6 months)
    const monthlyData: Record<string, { received: number; issued: number; wasted: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString("default", { month: "short" });
      monthlyData[key] = { received: 0, issued: 0, wasted: 0 };
    }
    transactions.forEach((tx) => {
      const month = new Date(tx.createdAt).toLocaleString("default", { month: "short" });
      if (monthlyData[month]) {
        if (tx.type === "RECEIVED" || tx.type === "RETURNED") monthlyData[month].received += tx.quantity || 0;
        else if (tx.type === "ISSUED" || tx.type === "TRANSFERRED") monthlyData[month].issued += tx.quantity || 0;
        else if (tx.type === "WASTED") monthlyData[month].wasted += tx.quantity || 0;
      }
    });

    // Waste breakdown
    const wasteMap = new Map<string, number>();
    waste.forEach((w) => {
      const type = w.wasteType || "Other";
      wasteMap.set(type, (wasteMap.get(type) || 0) + (w.quantity || 0));
    });

    // Supplier stats
    const supplierMap = new Map<string, { orders: number; value: number }>();
    pos.forEach((po) => {
      const name = po.supplier?.name || "Unknown";
      const existing = supplierMap.get(name) || { orders: 0, value: 0 };
      supplierMap.set(name, {
        orders: existing.orders + 1,
        value: existing.value + Number(po.totalAmount || 0),
      });
    });

    const dto: DashboardOverviewDTO = {
      totalItems: itemsWithTotals.length,
      inventoryValue,
      lowStockItems: lowStock.length,
      expiringSoon,
      pendingRequests,
      activeFarms,
      totalWarehouses,
      totalTransactions,
      recentTransactions: transactions.slice(0, 5),
      lowStockAlerts: lowStock.slice(0, 5),
      inventoryValueByCategory: Array.from(catMap.entries()).map(([name, { value, color }]) => ({ name, value, color })),
      transactionTrends: Object.entries(monthlyData).map(([name, data]) => ({ name, ...data })),
      wasteBreakdown: Array.from(wasteMap.entries()).map(([name, value]) => ({ name, value })),
      topSuppliers: Array.from(supplierMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    };

    return cachedJsonResponse(dto, 15);
  } catch (error) {
    logRouteError(request, "Error aggregating dashboard overview", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
