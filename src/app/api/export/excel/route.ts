import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { requireAuth, resolveFarmScope } from "@/lib/api-auth";

/**
 * GET /api/export/excel
 * Export data as Excel (.xlsx) file.
 *
 * Query params:
 *   type: "inventory" | "transactions" | "batches" | "waste" | "purchase-orders" | "all"
 *   startDate: ISO date string
 *   endDate: ISO date string
 *   warehouseId: filter by warehouse
 *   farmId: filter by farm
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "inventory";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const warehouseId = searchParams.get("warehouseId");
    const farmId = resolveFarmScope(user, searchParams.get("farmId"));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FarmOps";
    workbook.created = new Date();

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ─── Inventory Sheet ────────────────────────────────
    if (type === "inventory" || type === "all") {
      const invBatchWhere: Record<string, unknown> = { status: "ACTIVE" };
      if (farmId) invBatchWhere.warehouse = { farmId };
      const items = await prisma.inventoryItem.findMany({
        where: {
          isActive: true,
          ...(farmId ? { batches: { some: invBatchWhere } } : {}),
        },
        include: {
          category: true,
          batches: {
            where: invBatchWhere,
            include: { warehouse: true, supplier: true },
          },
        },
        orderBy: { name: "asc" },
      });

      const ws = workbook.addWorksheet("Inventory", { properties: { tabColor: { argb: "16a34a" } } });

      ws.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Category", key: "category", width: 18 },
        { header: "Unit", key: "unit", width: 12 },
        { header: "Total Qty", key: "totalQty", width: 12 },
        { header: "Reorder Point", key: "reorderPoint", width: 14 },
        { header: "Min Stock", key: "minStock", width: 12 },
        { header: "Max Stock", key: "maxStock", width: 12 },
        { header: "Total Value (GH₵)", key: "totalValue", width: 18 },
        { header: "Batches", key: "batches", width: 10 },
        { header: "Shelf Life (days)", key: "shelfLife", width: 16 },
        { header: "Requires Expiry Tracking", key: "expiryTracking", width: 20 },
        { header: "Status", key: "status", width: 12 },
      ];

      // Style header
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "16a34a" } };

      for (const item of items) {
        const totalQty = item.batches.reduce((s, b) => s + b.quantityRemaining, 0);
        const totalValue = item.batches.reduce((s, b) => s + Number(b.purchasePrice) * b.quantityRemaining, 0);

        ws.addRow({
          name: item.name,
          category: item.category.name,
          unit: item.unitOfMeasure,
          totalQty,
          reorderPoint: item.reorderPoint || "",
          minStock: item.minimumStockLevel,
          maxStock: item.maximumStockLevel || "",
          totalValue: totalValue.toFixed(2),
          batches: item.batches.length,
          shelfLife: item.shelfLifeDays || "",
          expiryTracking: item.requiresExpiryTracking ? "Yes" : "No",
          status: totalQty <= (item.reorderPoint || 0) ? "LOW STOCK" : "OK",
        });
      }
    }

    // ─── Transactions Sheet ─────────────────────────────
    if (type === "transactions" || type === "all") {
      const where: Record<string, unknown> = {};
      if (farmId) where.farmId = farmId;
      if (hasDateFilter) where.createdAt = dateFilter;
      if (warehouseId) {
        where.OR = [
          { fromWarehouseId: warehouseId },
          { toWarehouseId: warehouseId },
        ];
      }

      const transactions = await prisma.stockTransaction.findMany({
        where,
        include: {
          batch: { include: { item: true } },
          fromWarehouse: true,
          toWarehouse: true,
          performedBy: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const ws = workbook.addWorksheet("Transactions", { properties: { tabColor: { argb: "2563eb" } } });

      ws.columns = [
        { header: "Date", key: "date", width: 18 },
        { header: "Type", key: "type", width: 14 },
        { header: "Item", key: "item", width: 28 },
        { header: "Batch", key: "batch", width: 20 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Unit Cost (GH₵)", key: "unitCost", width: 16 },
        { header: "Total Value (GH₵)", key: "totalValue", width: 18 },
        { header: "From Warehouse", key: "from", width: 20 },
        { header: "To Warehouse", key: "to", width: 20 },
        { header: "Performed By", key: "performedBy", width: 20 },
        { header: "Reason", key: "reason", width: 40 },
      ];

      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563eb" } };

      for (const t of transactions) {
        ws.addRow({
          date: t.createdAt.toISOString().split("T")[0],
          type: t.type,
          item: t.batch.item.name,
          batch: t.batch.batchNumber,
          quantity: t.quantity,
          unitCost: Number(t.unitCost || 0).toFixed(2),
          totalValue: Number(t.totalValue || 0).toFixed(2),
          from: t.fromWarehouse?.name || "",
          to: t.toWarehouse?.name || "",
          performedBy: t.performedBy.name,
          reason: t.reason || "",
        });
      }
    }

    // ─── Batches Sheet ──────────────────────────────────
    if (type === "batches" || type === "all") {
      const batchWhere: Record<string, unknown> = {};
      if (farmId) batchWhere.warehouse = { farmId };
      if (warehouseId) batchWhere.warehouseId = warehouseId;

      const batches = await prisma.inventoryBatch.findMany({
        where: batchWhere,
        include: {
          item: true,
          warehouse: true,
          supplier: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const ws = workbook.addWorksheet("Batches", { properties: { tabColor: { argb: "f59e0b" } } });

      ws.columns = [
        { header: "Batch Number", key: "batchNumber", width: 22 },
        { header: "Item", key: "item", width: 28 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Remaining", key: "remaining", width: 12 },
        { header: "Unit Cost (GH₵)", key: "unitCost", width: 16 },
        { header: "Warehouse", key: "warehouse", width: 22 },
        { header: "Supplier", key: "supplier", width: 22 },
        { header: "Expiry Date", key: "expiry", width: 14 },
        { header: "Status", key: "status", width: 12 },
        { header: "Notes", key: "notes", width: 30 },
      ];

      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "f59e0b" } };

      for (const b of batches) {
        ws.addRow({
          batchNumber: b.batchNumber,
          item: b.item.name,
          quantity: b.quantity,
          remaining: b.quantityRemaining,
          unitCost: Number(b.purchasePrice).toFixed(2),
          warehouse: b.warehouse.name,
          supplier: b.supplier?.name || "",
          expiry: b.expiryDate ? new Date(b.expiryDate).toISOString().split("T")[0] : "",
          status: b.status,
          notes: b.notes || "",
        });
      }
    }

    // ─── Waste Sheet ────────────────────────────────────
    if (type === "waste" || type === "all") {
      const wasteWhere: Record<string, unknown> = {};
      if (farmId) wasteWhere.farmId = farmId;
      if (hasDateFilter) wasteWhere.reportedAt = dateFilter;

      const waste = await prisma.wasteRecord.findMany({
        where: wasteWhere,
        include: {
          batch: { include: { item: true } },
          reportedBy: true,
          farm: true,
        },
        orderBy: { reportedAt: "desc" },
      });

      const ws = workbook.addWorksheet("Waste", { properties: { tabColor: { argb: "dc2626" } } });

      ws.columns = [
        { header: "Date", key: "date", width: 18 },
        { header: "Item", key: "item", width: 28 },
        { header: "Batch", key: "batch", width: 20 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Waste Type", key: "type", width: 14 },
        { header: "Est. Value (GH₵)", key: "value", width: 18 },
        { header: "Farm", key: "farm", width: 22 },
        { header: "Reported By", key: "reportedBy", width: 20 },
        { header: "Reason", key: "reason", width: 40 },
      ];

      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "dc2626" } };

      for (const w of waste) {
        ws.addRow({
          date: w.reportedAt.toISOString().split("T")[0],
          item: w.batch.item.name,
          batch: w.batch.batchNumber,
          quantity: w.quantity,
          type: w.wasteType,
          value: Number(w.estimatedValue || 0).toFixed(2),
          farm: w.farm.name,
          reportedBy: w.reportedBy.name,
          reason: w.reason || "",
        });
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const typeLabels: Record<string, string> = {
      inventory: "Inventory",
      transactions: "Transactions",
      batches: "Batches",
      waste: "Waste",
      all: "FarmOps-All-Data",
    };

    const filename = `${typeLabels[type] || "Export"}-${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: "Failed to generate Excel file" }, { status: 500 });
  }
}
