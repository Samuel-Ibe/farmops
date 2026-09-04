import { z } from "zod";

// ─── User ────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  role: z.enum(["ADMIN", "FARM_MANAGER", "WAREHOUSE_MANAGER", "FIELD_WORKER", "ACCOUNTANT"]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ─── Farm ────────────────────────────────────────────────

export const farmSchema = z.object({
  name: z.string().min(1, "Farm name is required"),
  location: z.string().min(1, "Location is required"),
  description: z.string().optional(),
  acreage: z.number().positive().optional(),
});

// ─── Warehouse ───────────────────────────────────────────

export const warehouseSchema = z.object({
  name: z.string().min(1, "Warehouse name is required"),
  farmId: z.string().min(1, "Farm is required"),
  location: z.string().optional(),
  type: z.enum(["PHYSICAL", "COLD_STORAGE", "VIRTUAL"]),
  capacity: z.number().positive().optional(),
});

// ─── Category ────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

// ─── Supplier ────────────────────────────────────────────

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

// ─── Inventory Item ──────────────────────────────────────

export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  categoryId: z.string().min(1, "Category is required"),
  unitOfMeasure: z.string().min(1, "Unit of measure is required"),
  description: z.string().optional(),
  minimumStockLevel: z.number().min(0).default(0),
  maximumStockLevel: z.number().positive().optional(),
  reorderPoint: z.number().positive().optional(),
  reorderQuantity: z.number().positive().optional(),
  defaultSupplierId: z.string().optional(),
  shelfLifeDays: z.number().positive().optional(),
  requiresExpiryTracking: z.boolean().default(false),
});

// ─── Inventory Batch ─────────────────────────────────────

export const inventoryBatchSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  batchNumber: z.string().min(1, "Batch number is required"),
  supplierId: z.string().optional(),
  purchasePrice: z.number().min(0, "Price must be positive"),
  quantity: z.number().positive("Quantity must be positive"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  expiryDate: z.string().optional(),
  manufacturedDate: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Stock Transaction ───────────────────────────────────

export const stockTransactionSchema = z.object({
  type: z.enum(["RECEIVED", "ISSUED", "TRANSFERRED", "ADJUSTED", "WASTED", "EXPIRED", "RETURNED"]),
  batchId: z.string().min(1, "Batch is required"),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  reason: z.string().optional(),
  referenceNumber: z.string().optional(),
  farmId: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === "TRANSFERRED") {
      return data.fromWarehouseId && data.toWarehouseId;
    }
    return true;
  },
  {
    message: "Transfer requires both source and destination warehouses",
    path: ["toWarehouseId"],
  }
);

// ─── Resource Request ────────────────────────────────────

export const resourceRequestSchema = z.object({
  farmId: z.string().min(1, "Farm is required"),
  warehouseId: z.string().optional(),
  itemId: z.string().min(1, "Item is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitOfMeasure: z.string().min(1, "Unit is required"),
  purpose: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

// ─── Purchase Order ──────────────────────────────────────

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  farmId: z.string().min(1, "Farm is required"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
  })).min(1, "At least one item is required"),
});

// ─── Waste Record ────────────────────────────────────────

export const wasteRecordSchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  quantity: z.number().positive("Quantity must be positive"),
  wasteType: z.enum(["EXPIRED", "DAMAGED", "SPOILED", "LOST", "STOLEN"]),
  reason: z.string().optional(),
  farmId: z.string().min(1, "Farm is required"),
});

// ─── Stock Count ─────────────────────────────────────────

export const stockCountSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z.array(z.object({
    batchId: z.string().min(1),
    countedQuantity: z.number().min(0),
    notes: z.string().optional(),
  })).min(1),
});

// ─── Season ──────────────────────────────────────────────

export const seasonSchema = z.object({
  name: z.string().min(1, "Season name is required"),
  farmId: z.string().min(1, "Farm is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  cropType: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED"]).default("PLANNING"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type FarmInput = z.infer<typeof farmSchema>;
export type WarehouseInput = z.infer<typeof warehouseSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type InventoryBatchInput = z.infer<typeof inventoryBatchSchema>;
export type StockTransactionInput = z.infer<typeof stockTransactionSchema>;
export type ResourceRequestInput = z.infer<typeof resourceRequestSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type WasteRecordInput = z.infer<typeof wasteRecordSchema>;
export type StockCountInput = z.infer<typeof stockCountSchema>;
export type SeasonInput = z.infer<typeof seasonSchema>;
