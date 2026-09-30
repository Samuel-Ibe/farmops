import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse } from "@/lib/pagination";
import { mutationGuard, requireAuth, resolveFarmScope } from "@/lib/api-auth";

/**
 * GET /api/alerts
 * Returns all active alerts: expiry warnings, low stock, and critical items.
 *
 * Query params:
 *   type: "expiry" | "low_stock" | "all" (default: all)
 *   daysAhead: number (default: 90 — days ahead to check for expiry)
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const daysAhead = parseInt(searchParams.get("daysAhead") || "90", 10);
    const farmScope = resolveFarmScope(user, searchParams.get("farmId"));
    // Non-admin with no farm matches nothing; admin with no filter sees all.
    const warehouseWhere =
      farmScope === null ? {} : { warehouse: { farmId: farmScope } };

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const alerts: { expiry: any[]; lowStock: any[]; criticalStock: any[]; expiringBatches: any[] } = {
      expiry: [],
      lowStock: [],
      criticalStock: [],
      expiringBatches: [],
    };

    // ─── Expiry Alerts ──────────────────────────────────
    if (type === "all" || type === "expiry") {
      const expiringBatches = await prisma.inventoryBatch.findMany({
        where: {
          status: "ACTIVE",
          expiryDate: { not: null, lte: futureDate },
          quantityRemaining: { gt: 0 },
          ...warehouseWhere,
        },
        include: {
          item: true,
          warehouse: true,
        },
        orderBy: { expiryDate: "asc" },
      });

      alerts.expiringBatches = expiringBatches.map((batch) => {
        const daysUntilExpiry = Math.ceil(
          (new Date(batch.expiryDate!).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const urgency =
          daysUntilExpiry <= 0
            ? "EXPIRED"
            : daysUntilExpiry <= 7
              ? "CRITICAL"
              : daysUntilExpiry <= 30
                ? "HIGH"
                : "MEDIUM";

        return {
          id: batch.id,
          type: "expiry",
          urgency,
          batchNumber: batch.batchNumber,
          itemName: batch.item.name,
          unitOfMeasure: batch.item.unitOfMeasure,
          quantityRemaining: batch.quantityRemaining,
          warehouseName: batch.warehouse.name,
          expiryDate: batch.expiryDate,
          daysUntilExpiry,
          estimatedValue:
            Number(batch.purchasePrice) * batch.quantityRemaining,
        };
      });

      alerts.expiry = alerts.expiringBatches;
    }

    // ─── Low Stock Alerts ───────────────────────────────
    if (type === "all" || type === "low_stock") {
      const items = await prisma.inventoryItem.findMany({
        where: {
          isActive: true,
          ...(farmScope === null
            ? {}
            : { batches: { some: { status: "ACTIVE", ...warehouseWhere } } }),
        },
        include: {
          category: true,
          batches: {
            where: {
              status: "ACTIVE",
              ...(farmScope === null ? {} : { warehouse: { farmId: farmScope } }),
            },
            include: { warehouse: true },
          },
        },
      });

      for (const item of items) {
        const totalQty = item.batches.reduce(
          (sum, b) => sum + b.quantityRemaining,
          0
        );
        const totalValue = item.batches.reduce(
          (sum, b) => sum + Number(b.purchasePrice) * b.quantityRemaining,
          0
        );

        // Check if below minimum stock level
        if (item.reorderPoint && totalQty <= item.reorderPoint) {
          const severity =
            totalQty === 0
              ? "OUT_OF_STOCK"
              : totalQty <= (item.minimumStockLevel || 0)
                ? "CRITICAL"
                : "LOW";

          alerts.lowStock.push({
            id: item.id,
            type: "low_stock",
            urgency: severity,
            itemName: item.name,
            category: item.category.name,
            currentStock: totalQty,
            reorderPoint: item.reorderPoint,
            minimumStockLevel: item.minimumStockLevel,
            maximumStockLevel: item.maximumStockLevel,
            reorderQuantity: item.reorderQuantity,
            unitOfMeasure: item.unitOfMeasure,
            totalValue,
            batchCount: item.batches.length,
            warehouses: [
              ...new Set(item.batches.map((b) => b.warehouse.name)),
            ].join(", "),
          });
        }

        // Check if critically low
        if (
          item.minimumStockLevel &&
          totalQty <= item.minimumStockLevel * 0.5
        ) {
          const existing = alerts.lowStock.find(
            (a: any) => a.id === item.id
          );
          if (existing) {
            existing.urgency = "CRITICAL";
          }
          alerts.criticalStock.push({
            id: item.id,
            type: "critical_stock",
            urgency: "CRITICAL",
            itemName: item.name,
            currentStock: totalQty,
            minimumStockLevel: item.minimumStockLevel,
            unitOfMeasure: item.unitOfMeasure,
          });
        }
      }
    }

    // ─── Summary ────────────────────────────────────────
    const summary = {
      totalAlerts:
        alerts.expiry.length + alerts.lowStock.length,
      expiredCount: alerts.expiringBatches.filter(
        (a: any) => a.urgency === "EXPIRED"
      ).length,
      criticalCount:
        alerts.criticalStock.length +
        alerts.expiringBatches.filter(
          (a: any) => a.urgency === "CRITICAL"
        ).length,
      lowStockCount: alerts.lowStock.length,
      expiryWarningCount: alerts.expiry.length,
      potentialWasteValue: alerts.expiry.reduce(
        (sum: number, a: any) =>
          sum + ((a.estimatedValue as number) || 0),
        0
      ),
    };

    return cachedJsonResponse({ alerts, summary }, 15);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Generate and store low-stock and expiry notifications for all users.
 * Typically called by a cron job or manually triggered.
 */
export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json().catch(() => ({}));
    const daysAhead = body.daysAhead || 30;
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    let created = 0;

    // Notify only users in the caller's farm scope (admins can hit all farms)
    const farmScope = resolveFarmScope(guard);
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(farmScope === null ? {} : { farmId: farmScope }),
      },
    });
    if (users.length === 0) {
      return NextResponse.json({ message: "Created 0 notifications", expiringBatches: 0, lowStockItems: 0 });
    }

    // Check expiry alerts
    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        status: "ACTIVE",
        expiryDate: { not: null, lte: futureDate },
        quantityRemaining: { gt: 0 },
        ...(farmScope === null ? {} : { warehouse: { farmId: farmScope } }),
      },
      include: { item: true },
    });

    for (const batch of expiringBatches) {
      const daysUntilExpiry = Math.ceil(
        (new Date(batch.expiryDate!).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const title =
        daysUntilExpiry <= 0
          ? `Batch ${batch.batchNumber} has expired`
          : `Batch ${batch.batchNumber} expires in ${daysUntilExpiry} days`;
      const message =
        daysUntilExpiry <= 0
          ? `${batch.item.name} batch ${batch.batchNumber} has expired. ${batch.quantityRemaining} ${batch.item.unitOfMeasure} remaining.`
          : `${batch.item.name} batch ${batch.batchNumber} will expire in ${daysUntilExpiry} days. ${batch.quantityRemaining} ${batch.item.unitOfMeasure} remaining.`;

      // Avoid duplicate notifications for the same batch today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existing = await prisma.notification.findFirst({
        where: {
          entity: "InventoryBatch",
          entityId: batch.id,
          type: "EXPIRING",
          createdAt: { gte: todayStart },
        },
      });

      if (!existing) {
        for (const user of users) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "EXPIRING",
              title,
              message,
              entity: "InventoryBatch",
              entityId: batch.id,
            },
          });
          created++;
        }
      }
    }

    // Check low stock alerts
    const items = await prisma.inventoryItem.findMany({
      where: {
        isActive: true,
        reorderPoint: { not: null },
        ...(farmScope === null
          ? {}
          : {
              batches: {
                some: {
                  status: "ACTIVE",
                  warehouse: { farmId: farmScope },
                },
              },
            }),
      },
      include: {
        batches: {
          where: {
            status: "ACTIVE",
            ...(farmScope === null ? {} : { warehouse: { farmId: farmScope } }),
          },
        },
      },
    });

    for (const item of items) {
      const totalQty = item.batches.reduce(
        (sum, b) => sum + b.quantityRemaining,
        0
      );

      if (item.reorderPoint && totalQty <= item.reorderPoint) {
        const title =
          totalQty === 0
            ? `Out of stock: ${item.name}`
            : `Low stock: ${item.name} (${totalQty} ${item.unitOfMeasure})`;
        const message =
          totalQty === 0
            ? `${item.name} is completely out of stock. Reorder ${item.reorderQuantity || "now"}.`
            : `${item.name} is at ${totalQty} ${item.unitOfMeasure}, below reorder point of ${item.reorderPoint}. Consider reordering ${item.reorderQuantity || ""}.`;

        // Avoid duplicates
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const existing = await prisma.notification.findFirst({
          where: {
            entity: "InventoryItem",
            entityId: item.id,
            type: "LOW_STOCK",
            createdAt: { gte: todayStart },
          },
        });

        if (!existing) {
          for (const user of users) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: "LOW_STOCK",
                title,
                message,
                entity: "InventoryItem",
                entityId: item.id,
              },
            });
            created++;
          }
        }
      }
    }

    return NextResponse.json({
      message: `Created ${created} notifications`,
      expiringBatches: expiringBatches.length,
      lowStockItems: items.filter(
        (i) =>
          i.reorderPoint &&
          i.batches.reduce((s, b) => s + b.quantityRemaining, 0) <=
            i.reorderPoint
      ).length,
    });
  } catch (error) {
    console.error("Error generating alerts:", error);
    return NextResponse.json(
      { error: "Failed to generate alerts" },
      { status: 500 }
    );
  }
}
