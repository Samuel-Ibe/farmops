"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PurchaseOrderForm } from "@/components/forms/po-form";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  FileText,
  Loader2,
  CheckCircle,
  Truck,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase-orders");
      if (res.ok) { const json = await res.json(); setOrders(Array.isArray(json) ? json : json?.data || []); }
    } catch (err) {
      console.error("Failed to fetch purchase orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const safeOrders = Array.isArray(orders) ? orders : [];
  const filtered = safeOrders.filter(
    (o) =>
      (statusFilter === "" || o.status === statusFilter) &&
      (o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        o.supplier?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast(`Order ${newStatus.toLowerCase()}`, "success");
        fetchOrders();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update", "error");
      }
    } catch {
      toast("Failed to update order", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT": return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: <FileText className="h-4 w-4" /> };
      case "SUBMITTED": return { color: "bg-blue-100 text-blue-700 border-blue-200", icon: <Clock className="h-4 w-4" /> };
      case "CONFIRMED": return { color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: <CheckCircle className="h-4 w-4" /> };
      case "SHIPPED": return { color: "bg-purple-100 text-purple-700 border-purple-200", icon: <Truck className="h-4 w-4" /> };
      case "RECEIVED": return { color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle className="h-4 w-4" /> };
      case "CANCELLED": return { color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="h-4 w-4" /> };
      default: return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: <FileText className="h-4 w-4" /> };
    }
  };

  const getNextActions = (status: string) => {
    switch (status) {
      case "DRAFT": return [{ label: "Submit", action: "SUBMITTED", color: "text-blue-600 border-blue-200 hover:bg-blue-50" }];
      case "SUBMITTED": return [{ label: "Confirm", action: "CONFIRMED", color: "text-indigo-600 border-indigo-200 hover:bg-indigo-50" }];
      case "CONFIRMED": return [{ label: "Ship", action: "SHIPPED", color: "text-purple-600 border-purple-200 hover:bg-purple-50" }];
      case "SHIPPED": return [{ label: "Receive", action: "RECEIVED", color: "text-green-600 border-green-200 hover:bg-green-50" }];
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Track and manage purchase orders"
      >
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New PO
        </Button>
      </PageHeader>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: "", label: "All" }, { value: "DRAFT", label: "Draft" }, { value: "SUBMITTED", label: "Submitted" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "SHIPPED", label: "Shipped" }, { value: "RECEIVED", label: "Received" }, { value: "CANCELLED", label: "Cancelled" }].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              statusFilter === s.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search purchase orders..."
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No purchase orders found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || statusFilter ? "Try a different search" : "Create your first purchase order"}
              </p>
              {!search && !statusFilter && (
                <Button onClick={() => setShowForm(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  New Purchase Order
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const nextActions = getNextActions(order.status);
                const isExpanded = expandedId === order.id;

                return (
                  <div key={order.id} className="rounded-lg border overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                          {statusConfig.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-medium">{order.orderNumber}</p>
                            <Badge variant="outline" className={statusConfig.color}>
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {order.supplier?.name || "Unknown supplier"} •{" "}
                            {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                            {order.farm?.name && ` • ${order.farm.name}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(order.totalAmount || 0)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {nextActions.map((a) => (
                            <Button
                              key={a.action}
                              size="sm"
                              variant="outline"
                              className={`text-xs ${a.color}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdate(order.id, a.action);
                              }}
                              disabled={processingId === order.id}
                            >
                              {processingId === order.id ? "..." : a.label}
                            </Button>
                          ))}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 p-4 space-y-3">
                        {order.expectedDeliveryDate && (
                          <p className="text-sm text-muted-foreground">
                            Expected delivery: {new Date(order.expectedDeliveryDate).toLocaleDateString()}
                          </p>
                        )}
                        {order.notes && (
                          <p className="text-sm text-muted-foreground italic">{order.notes}</p>
                        )}
                        {order.items && order.items.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Order Items</p>
                            <div className="space-y-1">
                              {order.items.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                                  <span>{item.item?.name || "Unknown Item"}</span>
                                  <div className="flex items-center gap-4 text-muted-foreground">
                                    <span>{item.quantity} × {formatCurrency(item.unitPrice || 0)}</span>
                                    <span className="font-medium">{formatCurrency(item.totalPrice || 0)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Created by: {order.createdBy?.name || "Unknown"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PurchaseOrderForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          fetchOrders();
        }}
      />
    </div>
  );
}
