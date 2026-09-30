import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// ─── Consumption Forecasting ───────────────────────────────
// Uses weighted moving average of monthly consumption over last 6 months
// to predict future monthly usage per item.

async function computeForecasting() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Get all active items with their batches and transactions
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    include: {
      category: true,
      batches: {
        where: { status: "ACTIVE" },
      },
    },
  });

  // Get all ISSUED transactions in the last 6 months
  const transactions = await prisma.stockTransaction.findMany({
    where: {
      type: { in: ["ISSUED", "WASTED", "TRANSFERRED"] },
      createdAt: { gte: sixMonthsAgo },
    },
    include: { batch: { include: { item: true } } },
  });

  // Group consumption by item and month
  const consumptionByItem = new Map<string, number[]>();

  for (const tx of transactions) {
    const itemId = tx.batch?.itemId;
    if (!itemId) continue;

    const monthKey = tx.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!consumptionByItem.has(itemId)) {
      consumptionByItem.set(itemId, new Array(6).fill(0));
    }
    const monthsAgo = 5 - Math.floor((Date.now() - new Date(monthKey + "-01").getTime()) / (30 * 24 * 60 * 60 * 1000));
    const idx = Math.max(0, Math.min(5, monthsAgo));
    const arr = consumptionByItem.get(itemId)!;
    arr[idx] += tx.quantity;
  }

  // Forecast next 3 months using weighted moving average
  const forecasts = items.map((item) => {
    const monthlyUsage = consumptionByItem.get(item.id) || new Array(6).fill(0);
    const totalRemaining = item.batches.reduce((s, b) => s + b.quantityRemaining, 0);

    // Weights: more recent months have higher weight
    const weights = [1, 1.5, 2, 2.5, 3, 3.5];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedAvg = monthlyUsage.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight;

    const forecast3Months = weightedAvg * 3;
    const forecast6Months = weightedAvg * 6;
    const monthsOfStockLeft = weightedAvg > 0 ? totalRemaining / weightedAvg : Infinity;

    return {
      itemId: item.id,
      itemName: item.name,
      category: item.category?.name || "Unknown",
      unit: item.unitOfMeasure,
      currentStock: totalRemaining,
      avgMonthlyConsumption: Math.round(weightedAvg * 100) / 100,
      forecast3Months: Math.round(forecast3Months * 100) / 100,
      forecast6Months: Math.round(forecast6Months * 100) / 100,
      monthsOfStockLeft: Math.round(monthsOfStockLeft * 10) / 10,
      monthlyUsage,
    };
  });

  return forecasts;
}

// ─── Reorder Recommendations ───────────────────────────────
async function computeReorderRecommendations() {
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    include: {
      category: true,
      defaultSupplier: true,
      batches: {
        where: { status: "ACTIVE" },
      },
    },
  });

  const recommendations = items.map((item) => {
    const totalRemaining = item.batches.reduce((s, b) => s + b.quantityRemaining, 0);
    const reorderPoint = item.reorderPoint || item.minimumStockLevel || 0;
    const reorderQuantity = item.reorderQuantity || item.minimumStockLevel || 10;
    const maxStock = item.maximumStockLevel || reorderQuantity * 2;

    let urgency: "critical" | "warning" | "low" | "none" = "none";
    let recommendedQuantity = 0;

    if (totalRemaining <= 0) {
      urgency = "critical";
      recommendedQuantity = maxStock;
    } else if (reorderPoint > 0 && totalRemaining <= reorderPoint * 0.5) {
      urgency = "critical";
      recommendedQuantity = maxStock - totalRemaining;
    } else if (reorderPoint > 0 && totalRemaining <= reorderPoint) {
      urgency = "warning";
      recommendedQuantity = reorderQuantity;
    } else if (reorderPoint > 0 && totalRemaining <= reorderPoint * 1.5) {
      urgency = "low";
      recommendedQuantity = Math.min(reorderQuantity, maxStock - totalRemaining);
    }

    const expiryWarnings = item.batches
      .filter((b) => b.expiryDate)
      .map((b) => {
        const daysUntilExpiry = Math.ceil(
          (new Date(b.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return {
          batchNumber: b.batchNumber,
          quantityRemaining: b.quantityRemaining,
          expiryDate: b.expiryDate,
          daysUntilExpiry,
        };
      })
      .filter((e) => e.daysUntilExpiry <= 90);

    return {
      itemId: item.id,
      itemName: item.name,
      category: item.category?.name || "Unknown",
      unit: item.unitOfMeasure,
      currentStock: totalRemaining,
      reorderPoint,
      reorderQuantity,
      maxStock,
      urgency,
      recommendedQuantity: Math.round(recommendedQuantity),
      defaultSupplier: item.defaultSupplier?.name || null,
      supplierContact: item.defaultSupplier?.phone || null,
      expiryWarnings,
    };
  });

  // Sort: critical first, then warning, then low
  const urgencyOrder = { critical: 0, warning: 1, low: 2, none: 3 };
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return recommendations;
}

// ─── Anomaly Detection ─────────────────────────────────────
// Detects unusual patterns: sudden spikes in consumption,
// negative stock anomalies, unusually high waste, and transaction outliers.

async function computeAnomalies() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Get all ISSUED transactions
  const transactions = await prisma.stockTransaction.findMany({
    where: {
      createdAt: { gte: threeMonthsAgo },
    },
    include: {
      batch: { include: { item: true } },
      performedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by item per month
  const monthlyByItem = new Map<string, { month: string; total: number; transactions: any[] }[]>();
  const anomalies: any[] = [];

  for (const tx of transactions) {
    const itemId = tx.batch?.itemId;
    if (!itemId) continue;
    const month = tx.createdAt.toISOString().slice(0, 7);
    const key = `${itemId}`;
    if (!monthlyByItem.has(key)) monthlyByItem.set(key, []);

    const months = monthlyByItem.get(key)!;
    let existing = months.find((m) => m.month === month);
    if (!existing) {
      existing = { month, total: 0, transactions: [] };
      months.push(existing);
    }
    existing.total += tx.quantity;
    existing.transactions.push(tx);
  }

  // Detect anomalies
  for (const [itemId, months] of monthlyByItem) {
    const itemName = months[0]?.transactions[0]?.batch?.item?.name || "Unknown";
    const consumptions = months.map((m) => m.total);

    if (consumptions.length < 2) continue;

    const avg = consumptions.reduce((a, b) => a + b, 0) / consumptions.length;
    const maxDeviation = consumptions.reduce((m, v) => Math.max(m, Math.abs(v - avg)), 0);
    const threshold = Math.max(avg * 1.5, 10); // 150% of average or minimum 10

    for (const monthData of months) {
      if (monthData.total > avg + threshold && consumptions.length >= 2) {
        anomalies.push({
          type: "CONSUMPTION_SPIKE",
          severity: "high",
          itemId,
          itemName,
          month: monthData.month,
          value: monthData.total,
          average: Math.round(avg * 100) / 100,
          deviation: Math.round(((monthData.total - avg) / avg) * 100),
          message: `Unusual consumption spike for ${itemName} in ${monthData.month}: ${monthData.total} (avg: ${Math.round(avg)})`,
        });
      }
    }
  }

  // High waste detection
  const wasteTransactions = transactions.filter((tx) => tx.type === "WASTED");
  const wasteByItem = new Map<string, number>();
  for (const tx of wasteTransactions) {
    const itemId = tx.batch?.itemId;
    if (!itemId) continue;
    wasteByItem.set(itemId, (wasteByItem.get(itemId) || 0) + tx.quantity);
  }

  for (const [itemId, wasteQty] of wasteByItem) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { batches: { where: { status: "ACTIVE" } } },
    });
    if (!item) continue;

    const totalStock = item.batches.reduce((s, b) => s + b.quantityRemaining, 0);
    const wasteRatio = totalStock > 0 ? wasteQty / (totalStock + wasteQty) : 0;

    if (wasteRatio > 0.1) {
      anomalies.push({
        type: "HIGH_WASTE",
        severity: wasteRatio > 0.2 ? "critical" : "medium",
        itemId,
        itemName: item.name,
        wasteQuantity: wasteQty,
        wasteRatio: Math.round(wasteRatio * 100),
        message: `High waste ratio (${Math.round(wasteRatio * 100)}%) for ${item.name} in the last 3 months`,
      });
    }
  }

  // Near-zero stock (items that were recently depleted)
  const depletedItems = await prisma.inventoryBatch.findMany({
    where: { status: "ACTIVE", quantityRemaining: { lte: 2 } },
    include: { item: true },
  });

  for (const batch of depletedItems) {
    anomalies.push({
      type: "NEAR_DEPLETION",
      severity: batch.quantityRemaining === 0 ? "critical" : "high",
      itemId: batch.itemId,
      itemName: batch.item.name,
      batchNumber: batch.batchNumber,
      remaining: batch.quantityRemaining,
      message: `Batch ${batch.batchNumber} of ${batch.item.name} has only ${batch.quantityRemaining} ${batch.item.unitOfMeasure} remaining`,
    });
  }

  return anomalies;
}

// ─── Main Handler ──────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // Cross-farm analytics: admin only. Farm-scoped dashboards use /api/reports.
    const guard = await requireRole(["ADMIN"]);
    if (guard instanceof NextResponse) return guard;
    const { searchParams } = new URL(request.url);
    const analysis = searchParams.get("analysis") || "all";

    const result: Record<string, any> = {};

    if (analysis === "all" || analysis === "forecast") {
      result.forecasting = await computeForecasting();
    }
    if (analysis === "all" || analysis === "reorder") {
      result.reorderRecommendations = await computeReorderRecommendations();
    }
    if (analysis === "all" || analysis === "anomalies") {
      result.anomalies = await computeAnomalies();
    }

    // Summary stats
    if (analysis === "all") {
      const allItems = await prisma.inventoryItem.findMany({
        where: { isActive: true },
        include: { batches: { where: { status: "ACTIVE" } } },
      });

      const totalStock = allItems.reduce(
        (s, item) => s + item.batches.reduce((b, batch) => b + batch.quantityRemaining, 0),
        0
      );
      const totalValue = allItems.reduce(
        (s, item) =>
          s +
          item.batches.reduce(
            (b, batch) => b + Number(batch.purchasePrice) * batch.quantityRemaining,
            0
          ),
        0
      );

      const itemsBelowReorder = (result.reorderRecommendations || []).filter(
        (r: any) => r.urgency !== "none"
      ).length;

      const criticalAnomalies = (result.anomalies || []).filter(
        (a: any) => a.severity === "critical" || a.severity === "high"
      ).length;

      result.summary = {
        totalItems: allItems.length,
        totalStock,
        totalValue,
        itemsBelowReorder,
        criticalAnomalies,
        forecastAccuracy: "weighted-moving-average",
        dataRange: "6 months",
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Intelligence error:", error);
    return NextResponse.json({ error: "Intelligence analysis failed" }, { status: 500 });
  }
}
