import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse } from "@/lib/pagination";
import { requireAuth, resolveFarmScope } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "dashboard";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const farmId = resolveFarmScope(user, searchParams.get("farmId"));

    const txDateFilter: any = {};
    if (startDate) txDateFilter.gte = new Date(startDate);
    if (endDate) txDateFilter.lte = new Date(endDate + "T23:59:59");
    const hasDateFilter = Object.keys(txDateFilter).length > 0;

    if (type === "dashboard") {
      const [totalItems, totalBatches, farms, warehouses, pendingRequests] = await Promise.all([
        prisma.inventoryItem.count({ where: { isActive: true } }),
        prisma.inventoryBatch.count({ where: { status: "ACTIVE" } }),
        prisma.farm.count({ where: { isActive: true } }),
        prisma.warehouse.count({ where: { isActive: true } }),
        prisma.resourceRequest.count({ where: { status: "PENDING" } }),
      ]);
      const batches = await prisma.inventoryBatch.findMany({ where: { status: "ACTIVE" }, select: { purchasePrice: true, quantityRemaining: true } });
      const totalValue = batches.reduce((s, b) => s + Number(b.purchasePrice) * b.quantityRemaining, 0);
      const items = await prisma.inventoryItem.findMany({ where: { isActive: true }, include: { batches: { where: { status: "ACTIVE" }, select: { quantityRemaining: true } } } });
      const lowStockCount = items.filter((i) => i.batches.reduce((s, b) => s + b.quantityRemaining, 0) <= i.minimumStockLevel).length;
      const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
      const expiringCount = await prisma.inventoryBatch.count({ where: { status: "ACTIVE", expiryDate: { not: null, lte: thirtyDays } } });
      const recentTransactions = await prisma.stockTransaction.findMany({ take: 10, include: { batch: { include: { item: true } }, performedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" } });
      const categories = await prisma.category.findMany({ include: { items: { include: { batches: { where: { status: "ACTIVE" }, select: { purchasePrice: true, quantityRemaining: true } } } } } });
      const inventoryValueByCategory = categories.map((c) => ({ name: c.name, color: c.color || "#6b7280", value: c.items.reduce((s, i) => s + i.batches.reduce((bs, b) => bs + Number(b.purchasePrice) * b.quantityRemaining, 0), 0) })).filter((c) => c.value > 0);
      return cachedJsonResponse({ totalItems, totalBatches, totalValue, lowStockCount, expiringCount, pendingRequestCount: pendingRequests, totalFarms: farms, totalWarehouses: warehouses, recentTransactions, inventoryValueByCategory }, 15);
    }

    if (type === "transactions") {
      const where: any = {};
      if (hasDateFilter) where.createdAt = txDateFilter;
      if (farmId) where.farmId = farmId;
      const [txs, total] = await Promise.all([
        prisma.stockTransaction.findMany({ where, include: { batch: { include: { item: true } }, fromWarehouse: true, toWarehouse: true, performedBy: { select: { name: true } }, farm: true }, orderBy: { createdAt: "desc" }, take: 500 }),
        prisma.stockTransaction.count({ where }),
      ]);
      const byType: Record<string, number> = {};
      const byFarm: Record<string, number> = {};
      const monthly: Record<string, { received: number; issued: number; value: number }> = {};
      const items: Record<string, { received: number; issued: number; wasted: number }> = {};
      for (const tx of txs) {
        byType[tx.type] = (byType[tx.type] || 0) + tx.quantity;
        const fn = tx.farm?.name || "Unknown"; byFarm[fn] = (byFarm[fn] || 0) + (Number(tx.totalValue) || 0);
        const m = tx.createdAt.toISOString().slice(0, 7);
        if (!monthly[m]) monthly[m] = { received: 0, issued: 0, value: 0 };
        if (tx.type === "RECEIVED" || tx.type === "RETURNED") monthly[m].received += tx.quantity; else monthly[m].issued += tx.quantity;
        monthly[m].value += Number(tx.totalValue) || 0;
        const nm = tx.batch?.item?.name || "Unknown";
        if (!items[nm]) items[nm] = { received: 0, issued: 0, wasted: 0 };
        if (tx.type === "RECEIVED") items[nm].received += tx.quantity; else if (tx.type === "ISSUED") items[nm].issued += tx.quantity; else if (tx.type === "WASTED") items[nm].wasted += tx.quantity;
      }
      return cachedJsonResponse({ transactions: txs.slice(0, 100), total, summary: { byType, byFarm, monthlyTrends: Object.entries(monthly).map(([month, d]) => ({ month, ...d })), topItems: Object.entries(items).map(([name, d]) => ({ name, ...d })).sort((a, b) => (b.received + b.issued) - (a.received + a.issued)).slice(0, 10), totalValue: txs.reduce((s, tx) => s + (Number(tx.totalValue) || 0), 0), totalTransactions: total } }, 15);
    }

    if (type === "waste") {
      const wasteWhere: any = {};
      if (startDate) wasteWhere.reportedAt = { gte: new Date(startDate) };
      if (endDate) wasteWhere.reportedAt = { ...wasteWhere.reportedAt, lte: new Date(endDate + "T23:59:59") };
      if (farmId) wasteWhere.farmId = farmId;
      const records = await prisma.wasteRecord.findMany({ where: wasteWhere, include: { batch: { include: { item: true, warehouse: true } }, reportedBy: { select: { name: true } }, farm: true }, orderBy: { reportedAt: "desc" }, take: 200 });
      const byType: Record<string, number> = {}; const byFarm: Record<string, { quantity: number; value: number }> = {};
      const byItem: Record<string, { quantity: number; value: number; types: string[] }> = {};
      for (const r of records) {
        byType[r.wasteType] = (byType[r.wasteType] || 0) + r.quantity;
        const fn = r.farm?.name || "Unknown"; if (!byFarm[fn]) byFarm[fn] = { quantity: 0, value: 0 }; byFarm[fn].quantity += r.quantity; byFarm[fn].value += Number(r.estimatedValue) || 0;
        const nm = r.batch?.item?.name || "Unknown"; if (!byItem[nm]) byItem[nm] = { quantity: 0, value: 0, types: [] }; byItem[nm].quantity += r.quantity; byItem[nm].value += Number(r.estimatedValue) || 0; if (!byItem[nm].types.includes(r.wasteType)) byItem[nm].types.push(r.wasteType);
      }
      return cachedJsonResponse({ records: records.slice(0, 50), summary: { totalRecords: records.length, totalQuantity: records.reduce((s, r) => s + r.quantity, 0), totalValue: records.reduce((s, r) => s + (Number(r.estimatedValue) || 0), 0), byType: Object.entries(byType).map(([name, quantity]) => ({ name, quantity })), byFarm: Object.entries(byFarm).map(([name, d]) => ({ name, ...d })), topItems: Object.entries(byItem).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value).slice(0, 10) } }, 15);
    }

    if (type === "suppliers") {
      const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, include: { purchaseOrders: { include: { items: true }, orderBy: { createdAt: "desc" } }, batches: { orderBy: { createdAt: "desc" } } } });
      const performance = suppliers.map((s) => {
        const orders = s.purchaseOrders; const totalOrders = orders.length; const totalValue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const delivered = orders.filter((o) => o.status === "RECEIVED"); const onTime = delivered.filter((o) => !o.expectedDeliveryDate || !o.actualDeliveryDate || new Date(o.actualDeliveryDate) <= new Date(o.expectedDeliveryDate));
        const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0); const totalReceived = orders.reduce((sum, o) => sum + o.items.reduce((is, i) => is + i.quantityReceived, 0), 0);
        return { id: s.id, name: s.name, rating: s.rating, contactPerson: s.contactPerson, totalOrders, totalValue, avgOrderValue: totalOrders > 0 ? Math.round(totalValue / totalOrders) : 0, deliveryRate: totalOrders > 0 ? Math.round((delivered.length / totalOrders) * 100) : 0, onTimeRate: delivered.length > 0 ? Math.round((onTime.length / delivered.length) * 100) : 0, fulfillmentRate: totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0, batchCount: s.batches.length };
      });
      performance.sort((a, b) => b.totalValue - a.totalValue);
      return cachedJsonResponse({ suppliers: performance, summary: { totalSuppliers: performance.length, avgRating: Math.round(performance.reduce((s, sp) => s + (sp.rating || 0), 0) / Math.max(performance.length, 1) * 10) / 10, topSupplier: performance[0]?.name || "N/A" } }, 30);
    }

    if (type === "valuation") {
      const categories = await prisma.category.findMany({ include: { items: { include: { batches: { where: { status: "ACTIVE" }, select: { purchasePrice: true, quantityRemaining: true } } } } } });
      const valuation = categories.map((c) => ({ name: c.name, color: c.color, value: c.items.reduce((s, i) => s + i.batches.reduce((bs, b) => bs + Number(b.purchasePrice) * b.quantityRemaining, 0), 0), items: c.items.reduce((s, i) => s + i.batches.reduce((bs, b) => bs + b.quantityRemaining, 0), 0) }));
      const grandTotal = valuation.reduce((s, v) => s + v.value, 0);
      return cachedJsonResponse({ totalValue: grandTotal, categories: valuation.map((v) => ({ ...v, percentage: grandTotal > 0 ? (v.value / grandTotal) * 100 : 0 })) }, 30);
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
