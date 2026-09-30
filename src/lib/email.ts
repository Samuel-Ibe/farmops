import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  // Allow self-signed certs in dev
  tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: options.from || process.env.SMTP_FROM || "FarmOps <noreply@farmops.com>",
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}

// ─── Email Templates ───────────────────────────────────

export function lowStockEmail(itemName: string, currentQty: number, unit: string, reorderPoint: number, reorderQty?: number) {
  const subject = `⚠️ Low Stock Alert: ${itemName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">🌾 FarmOps — Low Stock Alert</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #374151;">
          The following item has fallen below its reorder point:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Item</td>
            <td style="padding: 8px 12px; color: #111827;">${itemName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Current Stock</td>
            <td style="padding: 8px 12px; color: #dc2626; font-weight: bold;">${currentQty} ${unit}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Reorder Point</td>
            <td style="padding: 8px 12px; color: #111827;">${reorderPoint} ${unit}</td>
          </tr>
          ${reorderQty ? `
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Suggested Order</td>
            <td style="padding: 8px 12px; color: #16a34a; font-weight: bold;">${reorderQty} ${unit}</td>
          </tr>` : ""}
        </table>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/purchase-orders"
           style="display: inline-block; background: #16a34a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Create Purchase Order
        </a>
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
        FarmOps — Field operations & input stock control
      </p>
    </div>
  `;
  return { subject, html, text: `Low Stock: ${itemName} — ${currentQty} ${unit} remaining (reorder point: ${reorderPoint})` };
}

export function expiryWarningEmail(batchNumber: string, itemName: string, quantity: number, unit: string, daysLeft: number) {
  const subject = daysLeft <= 0
    ? `🔴 Expired: ${itemName} (Batch ${batchNumber})`
    : `⏰ Expiring Soon: ${itemName} — ${daysLeft} days left`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${daysLeft <= 7 ? "#dc2626" : "#f59e0b"}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${daysLeft <= 0 ? "🔴 Expired Batch" : "⏰ Expiry Warning"}</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Item</td>
            <td style="padding: 8px 12px;">${itemName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Batch</td>
            <td style="padding: 8px 12px; font-family: monospace;">${batchNumber}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Quantity</td>
            <td style="padding: 8px 12px; font-weight: bold;">${quantity} ${unit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Status</td>
            <td style="padding: 8px 12px; color: ${daysLeft <= 0 ? "#dc2626" : "#f59e0b"}; font-weight: bold;">
              ${daysLeft <= 0 ? "EXPIRED" : `${daysLeft} days until expiry`}
            </td>
          </tr>
        </table>
        <p style="color: #6b7280;">Consider issuing this batch for use, reporting it as waste, or arranging disposal.</p>
      </div>
    </div>
  `;
  return { subject, html, text: `${daysLeft <= 0 ? "Expired" : "Expiring"}: ${itemName} (Batch ${batchNumber}) — ${quantity} ${unit}, ${daysLeft} days left` };
}

export function poStatusEmail(orderNumber: string, status: string, supplierName: string, totalAmount: number) {
  const subject = `📋 PO ${orderNumber} — ${status}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">📋 Purchase Order Update</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Order</td>
            <td style="padding: 8px 12px; font-family: monospace;">${orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Status</td>
            <td style="padding: 8px 12px; font-weight: bold; color: #2563eb;">${status}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Supplier</td>
            <td style="padding: 8px 12px;">${supplierName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Total</td>
            <td style="padding: 8px 12px; font-weight: bold;">GH₵ ${totalAmount.toLocaleString()}</td>
          </tr>
        </table>
      </div>
    </div>
  `;
  return { subject, html, text: `PO ${orderNumber} is now ${status}. Supplier: ${supplierName}. Total: GH₵${totalAmount}` };
}

export function requestStatusEmail(
  requestNumber: string,
  itemName: string,
  status: "APPROVED" | "REJECTED" | "FULFILLED",
  reviewerName: string,
  note?: string
) {
  const color = status === "APPROVED" ? "#16a34a" : status === "REJECTED" ? "#dc2626" : "#2563eb";
  const subject = `📦 Request ${requestNumber} — ${status}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">📦 Resource Request ${status}</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Request <strong>${requestNumber}</strong> for <strong>${itemName}</strong> has been <strong style="color: ${color}">${status.toLowerCase()}</strong> by ${reviewerName}.</p>
        ${note ? `<p style="color: #6b7280; font-style: italic;">Note: "${note}"</p>` : ""}
      </div>
    </div>
  `;
  return { subject, html, text: `Request ${requestNumber} (${itemName}) ${status} by ${reviewerName}${note ? `. Note: ${note}` : ""}` };
}
