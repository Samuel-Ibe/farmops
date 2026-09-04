import { prisma } from "./prisma";

type NotificationType =
  | "LOW_STOCK"
  | "EXPIRING"
  | "REQUEST_PENDING"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "STOCK_ADJUSTED"
  | "PO_RECEIVED";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entity: params.entity,
      entityId: params.entityId,
    },
  });
}

export async function createLowStockAlert(
  userId: string,
  itemName: string,
  currentQuantity: number,
  minimumLevel: number,
  unit: string,
  warehouseName: string,
  itemId: string
) {
  return createNotification({
    userId,
    type: "LOW_STOCK",
    title: `Low Stock Alert: ${itemName}`,
    message: `${itemName} stock at ${warehouseName} is at ${currentQuantity} ${unit}, below minimum level of ${minimumLevel} ${unit}.`,
    entity: "InventoryItem",
    entityId: itemId,
  });
}

export async function createExpiryAlert(
  userId: string,
  itemName: string,
  batchNumber: string,
  expiryDate: Date,
  daysLeft: number,
  batchId: string
) {
  return createNotification({
    userId,
    type: "EXPIRING",
    title: `Expiry Warning: ${itemName}`,
    message: `Batch ${batchNumber} expires in ${daysLeft} days (${expiryDate.toLocaleDateString()}). Consider using first.`,
    entity: "InventoryBatch",
    entityId: batchId,
  });
}

export async function createRequestNotification(
  userId: string,
  type: "REQUEST_PENDING" | "REQUEST_APPROVED" | "REQUEST_REJECTED",
  requestNumber: string,
  requesterName: string,
  itemName: string,
  quantity: number,
  unit: string,
  requestId: string
) {
  const messages: Record<string, string> = {
    REQUEST_PENDING: `${requesterName} requested ${quantity} ${unit} of ${itemName}.`,
    REQUEST_APPROVED: `Your request ${requestNumber} for ${itemName} has been approved.`,
    REQUEST_REJECTED: `Your request ${requestNumber} for ${itemName} has been rejected.`,
  };

  return createNotification({
    userId,
    type,
    title: `${type.replace(/_/g, " ").toLowerCase()}: ${requestNumber}`,
    message: messages[type],
    entity: "ResourceRequest",
    entityId: requestId,
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}
