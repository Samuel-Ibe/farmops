import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  labels?: Record<string, string>;
  colors?: Record<string, string>;
}

const defaultLabels: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  DEPLETED: "Depleted",
  RECALLED: "Recalled",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  RECEIVED: "Received",
  PLANNING: "Planning",
  COMPLETED: "Completed",
};

const defaultColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  EXPIRED: "bg-red-100 text-red-800",
  DEPLETED: "bg-gray-100 text-gray-800",
  RECALLED: "bg-orange-100 text-orange-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  FULFILLED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  DRAFT: "bg-gray-100 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  RECEIVED: "bg-green-100 text-green-800",
  PLANNING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
};

export function StatusBadge({
  status,
  labels = defaultLabels,
  colors = defaultColors,
}: StatusBadgeProps) {
  const label = labels[status] || status;
  const colorClass = colors[status] || "bg-gray-100 text-gray-800";

  return (
    <Badge variant="outline" className={cn("font-medium", colorClass)}>
      {label}
    </Badge>
  );
}
