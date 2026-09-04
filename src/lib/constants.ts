// User Roles
export const USER_ROLES = {
  ADMIN: "ADMIN",
  FARM_MANAGER: "FARM_MANAGER",
  WAREHOUSE_MANAGER: "WAREHOUSE_MANAGER",
  FIELD_WORKER: "FIELD_WORKER",
  ACCOUNTANT: "ACCOUNTANT",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  FARM_MANAGER: "Farm Manager",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  FIELD_WORKER: "Field Worker",
  ACCOUNTANT: "Accountant",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full system access. Manages users, farms, and system configuration.",
  FARM_MANAGER: "Manages farm operations. Views inventory, approves requests, views analytics.",
  WAREHOUSE_MANAGER: "Manages warehouse operations. Receives, issues, and transfers stock.",
  FIELD_WORKER: "Submits resource requests. Scans inventory. Views assigned resources.",
  ACCOUNTANT: "Views costs, inventory valuation, and financial reports.",
};

// Transaction Types
export const TRANSACTION_TYPES = {
  RECEIVED: "RECEIVED",
  ISSUED: "ISSUED",
  TRANSFERRED: "TRANSFERRED",
  ADJUSTED: "ADJUSTED",
  WASTED: "WASTED",
  EXPIRED: "EXPIRED",
  RETURNED: "RETURNED",
} as const;

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  RECEIVED: "Received",
  ISSUED: "Issued",
  TRANSFERRED: "Transferred",
  ADJUSTED: "Adjusted",
  WASTED: "Wasted",
  EXPIRED: "Expired",
  RETURNED: "Returned",
};

export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  RECEIVED: "bg-green-100 text-green-800",
  ISSUED: "bg-blue-100 text-blue-800",
  TRANSFERRED: "bg-purple-100 text-purple-800",
  ADJUSTED: "bg-amber-100 text-amber-800",
  WASTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-orange-100 text-orange-800",
  RETURNED: "bg-teal-100 text-teal-800",
};

// Batch Status
export const BATCH_STATUSES = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  DEPLETED: "DEPLETED",
  RECALLED: "RECALLED",
} as const;

export const BATCH_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  DEPLETED: "Depleted",
  RECALLED: "Recalled",
};

export const BATCH_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  EXPIRED: "bg-red-100 text-red-800",
  DEPLETED: "bg-gray-100 text-gray-800",
  RECALLED: "bg-orange-100 text-orange-800",
};

// Request Status
export const REQUEST_STATUSES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
} as const;

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export const REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  FULFILLED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

// Request Priority
export const REQUEST_PRIORITIES = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export const REQUEST_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const REQUEST_PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

// Units of Measure
export const UNITS_OF_MEASURE = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "ton", label: "Metric Tons" },
  { value: "bags", label: "Bags" },
  { value: "liters", label: "Liters" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "units", label: "Units" },
  { value: "boxes", label: "Boxes" },
  { value: "cartons", label: "Cartons" },
  { value: "sacks", label: "Sacks" },
  { value: "pieces", label: "Pieces" },
  { value: "gallons", label: "Gallons" },
  { value: "drums", label: "Drums" },
];

// Warehouse Types
export const WAREHOUSE_TYPES = {
  PHYSICAL: "PHYSICAL",
  COLD_STORAGE: "COLD_STORAGE",
  VIRTUAL: "VIRTUAL",
} as const;

export const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Physical Warehouse",
  COLD_STORAGE: "Cold Storage",
  VIRTUAL: "Virtual Location",
};

// Waste Types
export const WASTE_TYPES = {
  EXPIRED: "EXPIRED",
  DAMAGED: "DAMAGED",
  SPOILED: "SPOILED",
  LOST: "LOST",
  STOLEN: "STOLEN",
} as const;

export const WASTE_TYPE_LABELS: Record<string, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  SPOILED: "Spoiled",
  LOST: "Lost",
  STOLEN: "Stolen",
};

// PO Status
export const PO_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  SHIPPED: "SHIPPED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;

export const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

// Season Status
export const SEASON_STATUSES = {
  PLANNING: "PLANNING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;

export const SEASON_STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

// Navigation
export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Inventory", href: "/inventory", icon: "Package" },
  { label: "Warehouses", href: "/warehouses", icon: "Warehouse" },
  { label: "Transactions", href: "/transactions", icon: "ArrowLeftRight" },
  { label: "Requests", href: "/requests", icon: "ClipboardList" },
  { label: "Farms", href: "/farms", icon: "Tractor" },
  { label: "Suppliers", href: "/suppliers", icon: "Truck" },
  { label: "QR Scanner", href: "/qr", icon: "QrCode" },
  { label: "Intelligence", href: "/intelligence", icon: "Brain" },
  { label: "Alerts", href: "/alerts", icon: "AlertTriangle" },
  { label: "Purchase Orders", href: "/purchase-orders", icon: "FileText" },
  { label: "Waste", href: "/waste", icon: "Trash2" },
  { label: "Stock Count", href: "/stock-count", icon: "ClipboardCheck" },
  { label: "Seasons", href: "/seasons", icon: "Calendar" },
  { label: "Notifications", href: "/notifications", icon: "Bell" },
  { label: "Reports", href: "/reports", icon: "BarChart3" },
  { label: "Audit Log", href: "/audit-log", icon: "ScrollText" },
  { label: "Settings", href: "/settings", icon: "Settings" },
] as const;
