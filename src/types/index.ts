import { User as PrismaUser } from "@prisma/client";

// Extended user type with role
export type User = PrismaUser;

// Session user type
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Dashboard stats
export interface DashboardStats {
  totalItems: number;
  totalBatches: number;
  totalValue: number;
  lowStockCount: number;
  expiringCount: number;
  pendingRequestCount: number;
  totalFarms: number;
  totalWarehouses: number;
}

// Inventory with details
export interface InventoryWithDetails {
  id: string;
  name: string;
  unitOfMeasure: string;
  minimumStockLevel: number;
  category: { id: string; name: string; color?: string | null };
  batches: {
    id: string;
    batchNumber: string;
    quantityRemaining: number;
    purchasePrice: any;
    expiryDate: Date | null;
    status: string;
    warehouse: { id: string; name: string; farm: { id: string; name: string } };
  }[];
  totalQuantity: number;
  totalValue: number;
}

// Transaction with details
export interface TransactionWithDetails {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  referenceNumber: string | null;
  createdAt: Date;
  batch: {
    id: string;
    batchNumber: string;
    item: { name: string; unitOfMeasure: string };
  };
  fromWarehouse: { name: string } | null;
  toWarehouse: { name: string } | null;
  performedBy: { name: string; role: string };
  farm: { name: string } | null;
}

// Chart data point
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

// Notification
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entity: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date;
}

// Low stock alert
export interface LowStockAlert {
  itemId: string;
  itemName: string;
  categoryName: string;
  currentQuantity: number;
  minimumLevel: number;
  unit: string;
  reorderQuantity: number | null;
  warehouse: string;
  farm: string;
}

// Expiry alert
export interface ExpiryAlert {
  batchId: string;
  batchNumber: string;
  itemName: string;
  quantityRemaining: number;
  expiryDate: Date;
  daysUntilExpiry: number;
  warehouse: string;
  farm: string;
}

// Forecast data
export interface ConsumptionForecast {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  averageConsumption: number; // per week
  daysUntilStockout: number | null;
  reorderQuantity: number | null;
  status: "ok" | "warning" | "critical";
}
