import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { mutationGuard, resolveFarmScope } from "@/lib/api-auth";
import { applyStockDelta, transactionTypeDelta } from "@/lib/stock";
import { logRouteError } from "@/lib/logger";

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
      // Transactions are attributed to the authenticated importer (never an
      // arbitrary row from the users table) and stamped with their farm.
      const importer = guard;
      const farmScope = resolveFarmScope(importer);
      const scopeFilter = farmScope ? { farmId: farmScope } : {};

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

          // Find batch — scoped to the importer's farm so a CSV can never
          // reference another tenant's stock by batch number
          const batch = await prisma.inventoryBatch.findFirst({
            where: { batchNumber, ...scopeFilter, ...(farmScope ? { warehouse: { farmId: farmScope } } : {}) },
            include: { warehouse: true },
          });
          if (!batch) {
            results.skipped++;
            results.errors.push(`Batch ${batchNumber} not found`);
            continue;
          }

          // Find or default warehouses — each independently farm-scoped
          let fromWarehouseId: string | undefined;
          let toWarehouseId: string | undefined;

          const fromWhName = row["From Warehouse"]?.trim();
          const toWhName = row["To Warehouse"]?.trim();

          if (fromWhName) {
            const wh = await prisma.warehouse.findFirst({
              where: { name: fromWhName, ...scopeFilter },
            });
            if (wh) fromWarehouseId = wh.id;
          }
          if (toWhName) {
            const wh = await prisma.warehouse.findFirst({
              where: { name: toWhName, ...scopeFilter },
            });
            if (wh) toWarehouseId = wh.id;
          }

          const unitCost = Number(batch.purchasePrice);
          const totalValue = unitCost * quantity;

          // Quantity change and transaction record commit atomically; a lost
          // race or insufficient stock skips the row instead of clamping.
          const outcome = await prisma.$transaction(async (tx) => {
            const adjustment = await applyStockDelta(
              tx,
              batch.id,
              transactionTypeDelta(typeVal, quantity)
            );
            if (!adjustment.ok) return { error: adjustment } as const;

            await tx.stockTransaction.create({
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
                performedById: importer.id,
                farmId: batch.warehouse?.farmId || importer.farmId || undefined,
              },
            });
            return { ok: true } as const;
          });

          if (outcome.error) {
            results.skipped++;
            results.errors.push(
              outcome.error.reason === "INSUFFICIENT_STOCK"
                ? `Row skipped: insufficient stock in batch ${batchNumber}`
                : `Row skipped: batch ${batchNumber} unavailable`
            );
            continue;
          }

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
    logRouteError(request, "Import error", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
