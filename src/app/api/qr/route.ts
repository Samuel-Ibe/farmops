import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, requireAuth, resolveFarmScope } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || "";

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Non-admins only ever see batches inside their own farm
    const farmScope = resolveFarmScope(user);
    const scopeWhere = farmScope !== null ? { warehouse: { farmId: farmScope } } : {};

    // Try to find by batch number first
    let batch = await prisma.inventoryBatch.findFirst({
      where: { batchNumber: { contains: code, mode: "insensitive" }, ...scopeWhere },
      include: {
        item: {
          include: { category: true },
        },
        warehouse: {
          include: { farm: true },
        },
        supplier: true,
      },
    });

    // Try by barcode
    if (!batch) {
      batch = await prisma.inventoryBatch.findFirst({
        where: { barcode: { contains: code, mode: "insensitive" }, ...scopeWhere },
        include: {
          item: { include: { category: true } },
          warehouse: { include: { farm: true } },
          supplier: true,
        },
      });
    }

    // Try by QR code data
    if (!batch) {
      batch = await prisma.inventoryBatch.findFirst({
        where: { qrCodeData: { contains: code, mode: "insensitive" }, ...scopeWhere },
        include: {
          item: { include: { category: true } },
          warehouse: { include: { farm: true } },
          supplier: true,
        },
      });
    }

    // Try to find by item name (fuzzy)
    if (!batch) {
      const item = await prisma.inventoryItem.findFirst({
        where: {
          name: { contains: code, mode: "insensitive" },
          ...(farmScope !== null && { batches: { some: { status: "ACTIVE", ...scopeWhere } } }),
        },
        include: {
          category: true,
          batches: {
            where: { status: "ACTIVE", ...scopeWhere },
            include: {
              warehouse: { include: { farm: true } },
            },
          },
        },
      });

      if (item) {
        // Get recent transactions for this item
        const recentTransactions = await prisma.stockTransaction.findMany({
          where: {
            batch: { itemId: item.id },
          },
          include: {
            performedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        return NextResponse.json({
          found: true,
          matchType: "item",
          item: {
            ...item,
            totalQuantity: item.batches.reduce((s, b) => s + b.quantityRemaining, 0),
            totalValue: item.batches.reduce(
              (s, b) => s + Number(b.purchasePrice) * b.quantityRemaining,
              0
            ),
          },
          recentTransactions,
        });
      }
    }

    if (!batch) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    // Get recent transactions for this batch
    const recentTransactions = await prisma.stockTransaction.findMany({
      where: { batchId: batch.id },
      include: {
        performedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get all active batches for this item
    const relatedBatches = await prisma.inventoryBatch.findMany({
      where: { itemId: batch.itemId, status: "ACTIVE" },
      include: { warehouse: { include: { farm: true } } },
    });

    return NextResponse.json({
      found: true,
      matchType: "batch",
      batch,
      item: batch.item,
      relatedBatches,
      recentTransactions,
    });
  } catch (error) {
    console.error("QR scan error:", error);
    return NextResponse.json({ error: "Scan lookup failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json();
    const { batchId } = body;

    // Generate QR code data for a batch
    const batch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: { item: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Create QR code data URL with batch info
    const QRCode = (await import("qrcode")).default;
    const qrData = JSON.stringify({
      type: "farmops-batch",
      batchNumber: batch.batchNumber,
      itemName: batch.item.name,
      batchId: batch.id,
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    // Save QR code data to batch
    await prisma.inventoryBatch.update({
      where: { id: batchId },
      data: { qrCodeData: qrData },
    });

    return NextResponse.json({
      batchNumber: batch.batchNumber,
      itemName: batch.item.name,
      qrDataUrl,
      qrData,
    });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}
