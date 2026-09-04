import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toCSV(rows: Record<string, any>[], headers: string[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "inventory";
    const farmId = searchParams.get("farmId");

    if (type === "inventory") {
      const items = await prisma.inventoryItem.findMany({
        where: { isActive: true },
        include: {
          category: true,
          defaultSupplier: true,
          batches: {
            where: { status: "ACTIVE" },
            include: { warehouse: { include: { farm: true } } },
          },
        },
        orderBy: { name: "asc" },
      });

      const headers = [
        "ID",
        "Name",
        "Category",
        "Unit of Measure",
        "Description",
        "Min Stock Level",
        "Max Stock Level",
        "Reorder Point",
        "Reorder Quantity",
        "Default Supplier",
        "Shelf Life (Days)",
        "Requires Expiry Tracking",
        "Total Quantity",
        "Total Value",
        "Active Batches",
        "Status",
      ];

      const rows = items.map((item) => ({
        ID: item.id,
        Name: item.name,
        "Category": item.category?.name || "",
        "Unit of Measure": item.unitOfMeasure,
        Description: item.description || "",
        "Min Stock Level": item.minimumStockLevel,
        "Max Stock Level": item.maximumStockLevel || "",
        "Reorder Point": item.reorderPoint || "",
        "Reorder Quantity": item.reorderQuantity || "",
        "Default Supplier": item.defaultSupplier?.name || "",
        "Shelf Life (Days)": item.shelfLifeDays || "",
        "Requires Expiry Tracking": item.requiresExpiryTracking ? "Yes" : "No",
        "Total Quantity": item.batches.reduce((s, b) => s + b.quantityRemaining, 0),
        "Total Value": item.batches.reduce(
          (s, b) => s + Number(b.purchasePrice) * b.quantityRemaining,
          0
        ),
        "Active Batches": item.batches.length,
        Status: "Active",
      }));

      const csv = toCSV(rows, headers);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="farmops-inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (type === "transactions") {
      const where: any = {};
      if (farmId) where.farmId = farmId;

      const transactions = await prisma.stockTransaction.findMany({
        where,
        include: {
          batch: { include: { item: true } },
          fromWarehouse: true,
          toWarehouse: true,
          performedBy: { select: { name: true } },
          farm: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "ID",
        "Type",
        "Item",
        "Batch Number",
        "Quantity",
        "Unit",
        "Unit Cost",
        "Total Value",
        "From Warehouse",
        "To Warehouse",
        "Reason",
        "Reference",
        "Performed By",
        "Farm",
        "Date",
      ];

      const rows = transactions.map((tx) => ({
        ID: tx.id,
        Type: tx.type,
        Item: tx.batch?.item?.name || "",
        "Batch Number": tx.batch?.batchNumber || "",
        Quantity: tx.quantity,
        Unit: tx.batch?.item?.unitOfMeasure || "",
        "Unit Cost": tx.unitCost || 0,
        "Total Value": tx.totalValue || 0,
        "From Warehouse": tx.fromWarehouse?.name || "",
        "To Warehouse": tx.toWarehouse?.name || "",
        Reason: tx.reason || "",
        Reference: tx.referenceNumber || "",
        "Performed By": tx.performedBy?.name || "",
        Farm: tx.farm?.name || "",
        Date: tx.createdAt.toISOString(),
      }));

      const csv = toCSV(rows, headers);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="farmops-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid export type. Use 'inventory' or 'transactions'." }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
