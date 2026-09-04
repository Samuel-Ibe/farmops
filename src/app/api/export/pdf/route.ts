import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";

/**
 * GET /api/export/pdf
 * Export reports as PDF.
 *
 * Query params:
 *   type: "inventory" | "valuation" | "waste" | "summary"
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
      info: {
        Title: `FarmOps ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
        Author: "FarmOps",
        Creator: "FarmOps PDF Export",
      },
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    // ─── Report Title ───────────────────────────────────
    const greenColor = "#16a34a";
    const darkColor = "#111827";
    const mutedColor = "#6b7280";

    doc.fontSize(24).fillColor(greenColor).text("FarmOps", { align: "center" });
    doc.fontSize(14).fillColor(mutedColor).text(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, { align: "center" });
    doc.fontSize(10).fillColor(mutedColor).text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });
    doc.moveDown(2);

    // Draw divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(greenColor).lineWidth(2).stroke();
    doc.moveDown(1);

    // ─── Inventory Summary ──────────────────────────────
    if (type === "inventory" || type === "summary" || type === "valuation") {
      const items = await prisma.inventoryItem.findMany({
        where: { isActive: true },
        include: {
          category: true,
          batches: { where: { status: "ACTIVE" } },
        },
        orderBy: { name: "asc" },
      });

      const totalQty = items.reduce((sum, i) => sum + i.batches.reduce((s, b) => s + b.quantityRemaining, 0), 0);
      const totalValue = items.reduce((sum, i) => sum + i.batches.reduce((s, b) => s + Number(b.purchasePrice) * b.quantityRemaining, 0), 0);
      const totalBatches = items.reduce((sum, i) => sum + i.batches.length, 0);

      doc.fontSize(16).fillColor(darkColor).text("Summary");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor(mutedColor);
      doc.text(`Total Items: ${items.length}`);
      doc.text(`Total Batches: ${totalBatches}`);
      doc.text(`Total Quantity: ${totalQty.toLocaleString()} units`);
      doc.text(`Total Inventory Value: GH₵ ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
      doc.moveDown(1);

      // Category breakdown
      const categoryMap = new Map<string, { qty: number; value: number; count: number }>();
      for (const item of items) {
        const cat = item.category.name;
        const existing = categoryMap.get(cat) || { qty: 0, value: 0, count: 0 };
        existing.qty += item.batches.reduce((s, b) => s + b.quantityRemaining, 0);
        existing.value += item.batches.reduce((s, b) => s + Number(b.purchasePrice) * b.quantityRemaining, 0);
        existing.count++;
        categoryMap.set(cat, existing);
      }

      doc.fontSize(14).fillColor(darkColor).text("By Category");
      doc.moveDown(0.5);

      const catEntries = Array.from(categoryMap.entries()).sort((a, b) => b[1].value - a[1].value);
      for (const [cat, data] of catEntries) {
        doc.fontSize(11).fillColor(darkColor).text(cat, { continued: true });
        doc.fontSize(10).fillColor(mutedColor).text(`  — ${data.count} items, GH₵ ${data.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, { indent: 10 });
      }
      doc.moveDown(1);

      // Item list
      doc.fontSize(14).fillColor(darkColor).text("Item Details");
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const colWidths = [140, 80, 60, 80, 80, 70];
      const headers = ["Item", "Category", "Unit", "Qty", "Value (GH₵)", "Status"];
      
      doc.fontSize(8).fillColor(greenColor);
      let xPos = 50;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], xPos, tableTop, { width: colWidths[i], align: i === 0 ? "left" : "center" });
        xPos += colWidths[i];
      }

      doc.moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).strokeColor(greenColor).lineWidth(1).stroke();

      let y = tableTop + 18;
      for (const item of items) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        const qty = item.batches.reduce((s, b) => s + b.quantityRemaining, 0);
        const value = item.batches.reduce((s, b) => s + Number(b.purchasePrice) * b.quantityRemaining, 0);
        const isLow = item.reorderPoint ? qty <= item.reorderPoint : false;

        doc.fontSize(8).fillColor(isLow ? "#dc2626" : darkColor);
        xPos = 50;
        const rowData = [
          item.name,
          item.category.name,
          item.unitOfMeasure,
          qty.toLocaleString(),
          value.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          isLow ? "LOW" : "OK",
        ];
        for (let i = 0; i < rowData.length; i++) {
          doc.text(rowData[i], xPos, y, { width: colWidths[i], align: i === 0 ? "left" : "center" });
          xPos += colWidths[i];
        }
        y += 14;
      }

      doc.moveDown(1);
    }

    // ─── Waste Summary ──────────────────────────────────
    if (type === "waste" || type === "summary") {
      const waste = await prisma.wasteRecord.findMany({
        include: {
          batch: { include: { item: true } },
          farm: true,
          reportedBy: true,
        },
        orderBy: { reportedAt: "desc" },
      });

      if (doc.y > 600) {
        doc.addPage();
      }

      doc.fontSize(16).fillColor(darkColor).text("Waste Records");
      doc.moveDown(0.5);

      const totalWasteQty = waste.reduce((s, w) => s + w.quantity, 0);
      const totalWasteValue = waste.reduce((s, w) => s + Number(w.estimatedValue || 0), 0);

      doc.fontSize(11).fillColor(mutedColor);
      doc.text(`Total Waste Records: ${waste.length}`);
      doc.text(`Total Waste Quantity: ${totalWasteQty.toLocaleString()} units`);
      doc.text(`Total Estimated Loss: GH₵ ${totalWasteValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
      doc.moveDown(1);

      for (const w of waste) {
        if (doc.y > 730) {
          doc.addPage();
        }
        doc.fontSize(10).fillColor(darkColor)
          .text(`${w.batch.item.name} — ${w.quantity} ${w.batch.item.unitOfMeasure} (${w.wasteType})`, { indent: 10 });
        doc.fontSize(9).fillColor(mutedColor)
          .text(`  Batch: ${w.batch.batchNumber} | Farm: ${w.farm.name} | Date: ${w.reportedAt.toLocaleDateString()} | Value: GH₵ ${Number(w.estimatedValue || 0).toFixed(2)}`, { indent: 10 });
        if (w.reason) {
          doc.fontSize(8).fillColor(mutedColor).text(`  Reason: ${w.reason}`, { indent: 10 });
        }
        doc.moveDown(0.3);
      }
    }

    // ─── Footer ─────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(mutedColor);
      doc.text(
        `FarmOps Report — Page ${i + 1} of ${pageCount}`,
        50,
        doc.page.height - 40,
        { align: "center", width: 495 }
      );
    }

    doc.end();

    // Wait for PDF to finish
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const filename = `FarmOps-${type.charAt(0).toUpperCase() + type.slice(1)}-${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
