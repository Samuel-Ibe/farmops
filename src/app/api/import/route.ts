import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { mutationGuard } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "inventory";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: "CSV parse error", details: parsed.errors.slice(0, 5) },
        { status: 400 }
      );
    }

    const rows = parsed.data as Record<string, string>[];

    if (type === "inventory") {
      // Find or create categories and suppliers
      const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

      for (const row of rows) {
        try {
          const name = row["Name"]?.trim();
          if (!name) {
            results.skipped++;
            results.errors.push(`Row skipped: missing name`);
            continue;
          }

          const categoryName = row["Category"]?.trim();
          let categoryId = "";

          if (categoryName) {
            let category = await prisma.category.findFirst({
              where: { name: categoryName },
            });
            if (!category) {
              category = await prisma.category.create({
                data: { name: categoryName },
              });
            }
            categoryId = category.id;
          }

          // Find default supplier
          let defaultSupplierId: string | undefined;
          const supplierName = row["Default Supplier"]?.trim();
          if (supplierName) {
            const supplier = await prisma.supplier.findFirst({
              where: { name: supplierName },
            });
            if (supplier) defaultSupplierId = supplier.id;
          }

          // Check if item already exists
          const existing = await prisma.inventoryItem.findFirst({
            where: { name, isActive: true },
          });

          if (existing) {
            await prisma.inventoryItem.update({
              where: { id: existing.id },
              data: {
                ...(categoryId && { categoryId }),
                unitOfMeasure: row["Unit of Measure"]?.trim() || existing.unitOfMeasure,
                description: row["Description"]?.trim() || existing.description,
                minimumStockLevel: row["Min Stock Level"]
                  ? parseFloat(row["Min Stock Level"]) || existing.minimumStockLevel
                  : existing.minimumStockLevel,
                maximumStockLevel: row["Max Stock Level"]
                  ? parseFloat(row["Max Stock Level"]) || existing.maximumStockLevel
                  : existing.maximumStockLevel,
                reorderPoint: row["Reorder Point"]
                  ? parseFloat(row["Reorder Point"]) || existing.reorderPoint
                  : existing.reorderPoint,
                reorderQuantity: row["Reorder Quantity"]
                  ? parseFloat(row["Reorder Quantity"]) || existing.reorderQuantity
                  : existing.reorderQuantity,
                ...(defaultSupplierId && { defaultSupplierId }),
                shelfLifeDays: row["Shelf Life (Days)"]
                  ? parseInt(row["Shelf Life (Days)"]) || existing.shelfLifeDays
                  : existing.shelfLifeDays,
                requiresExpiryTracking:
                  row["Requires Expiry Tracking"]?.toLowerCase() === "yes"
                    ? true
                    : existing.requiresExpiryTracking,
              },
            });
            results.updated++;
          } else {
            await prisma.inventoryItem.create({
              data: {
                name,
                categoryId: categoryId || (await prisma.category.findFirstOrThrow({ where: {} })).id,
                unitOfMeasure: row["Unit of Measure"]?.trim() || "units",
                description: row["Description"]?.trim() || undefined,
                minimumStockLevel: row["Min Stock Level"] ? parseFloat(row["Min Stock Level"]) || 0 : 0,
                maximumStockLevel: row["Max Stock Level"] ? parseFloat(row["Max Stock Level"]) : undefined,
                reorderPoint: row["Reorder Point"] ? parseFloat(row["Reorder Point"]) : undefined,
                reorderQuantity: row["Reorder Quantity"] ? parseFloat(row["Reorder Quantity"]) : undefined,
                defaultSupplierId: defaultSupplierId || undefined,
                shelfLifeDays: row["Shelf Life (Days)"] ? parseInt(row["Shelf Life (Days)"]) : undefined,
                requiresExpiryTracking: row["Requires Expiry Tracking"]?.toLowerCase() === "yes",
              },
            });
            results.created++;
          }
        } catch (err: any) {
          results.skipped++;
          results.errors.push(`Row error: ${err.message}`);
        }
      }

      return NextResponse.json({
        message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
        ...results,
      });
    }

    if (type === "transactions") {
      const results = { created: 0, skipped: 0, errors: [] as string[] };
      // Get the first user to attribute transactions to
      const defaultUser = await prisma.user.findFirst({ where: { isActive: true } });

      for (const row of rows) {
        try {
          const typeVal = row["Type"]?.trim();
          const itemName = row["Item"]?.trim();
          const batchNumber = row["Batch Number"]?.trim();
          const quantity = parseFloat(row["Quantity"]);

          if (!typeVal || !batchNumber || !quantity || quantity <= 0) {
            results.skipped++;
            results.errors.push(`Skipped row: missing type, batch, or quantity`);
            continue;
          }

          // Find batch
          const batch = await prisma.inventoryBatch.findFirst({
            where: { batchNumber },
          });
          if (!batch) {
            results.skipped++;
            results.errors.push(`Batch ${batchNumber} not found`);
            continue;
          }

          // Find or default warehouses
          let fromWarehouseId: string | undefined;
          let toWarehouseId: string | undefined;

          const fromWhName = row["From Warehouse"]?.trim();
          const toWhName = row["To Warehouse"]?.trim();

          if (fromWhName) {
            const wh = await prisma.warehouse.findFirst({ where: { name: fromWhName } });
            if (wh) fromWarehouseId = wh.id;
          }
          if (toWhName) {
            const wh = await prisma.warehouse.findFirst({ where: { name: toWhName } });
            if (wh) toWarehouseId = wh.id;
          }

          const unitCost = Number(batch.purchasePrice);
          const totalValue = unitCost * quantity;

          await prisma.stockTransaction.create({
            data: {
              type: typeVal as any,
              batchId: batch.id,
              fromWarehouseId: fromWarehouseId || batch.warehouseId,
              toWarehouseId: toWarehouseId,
              quantity,
              unitCost,
              totalValue,
              reason: row["Reason"]?.trim() || undefined,
              referenceNumber: row["Reference"]?.trim() || undefined,
              performedById: defaultUser?.id || "",
            },
          });

          // Update batch quantity
          let newQty = batch.quantityRemaining;
          if (typeVal === "RECEIVED" || typeVal === "RETURNED") {
            newQty += quantity;
          } else {
            newQty -= quantity;
          }

          await prisma.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              quantityRemaining: Math.max(0, newQty),
              status: newQty <= 0 ? "DEPLETED" : batch.status,
            },
          });

          results.created++;
        } catch (err: any) {
          results.skipped++;
          results.errors.push(`Row error: ${err.message}`);
        }
      }

      return NextResponse.json({
        message: `Import complete: ${results.created} created, ${results.skipped} skipped`,
        ...results,
      });
    }

    return NextResponse.json({ error: "Invalid import type. Use 'inventory' or 'transactions'." }, { status: 400 });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
