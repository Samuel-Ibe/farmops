"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { RequestForm } from "@/components/forms/request-form";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/requests?${params}`);
      if (res.ok) { const json = await res.json(); setRequests(Array.isArray(json) ? json : json?.data || []); }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const safeRequests = Array.isArray(requests) ? requests : [];
  const filtered = safeRequests.filter(
    (req) =>
      req.item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      req.requestNumber?.toLowerCase().includes(search.toLowerCase()) ||
      req.requestedBy?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) {
        toast("Request approved and stock issued", "success");
        fetchRequests();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to approve request", "error");
      }
    } catch (err) {
      toast("Failed to approve request", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (res.ok) {
        toast("Request rejected", "success");
        fetchRequests();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to reject request", "error");
      }
    } catch (err) {
      toast("Failed to reject request", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "APPROVED":
        return "bg-green-50 text-green-700 border-green-200";
      case "REJECTED":
        return "bg-red-50 text-red-700 border-red-200";
      case "FULFILLED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-50 text-red-700 border-red-200";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "MEDIUM":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resource Requests"
        description="Manage inventory requests from field workers"
      >
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </PageHeader>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["", "PENDING", "APPROVED", "REJECTED", "FULFILLED"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              statusFilter === status
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {status || "All"}
          </button>
        ))}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search requests..."
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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No requests found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search" : "No resource requests yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((req) => (
                <div key={req.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-medium">{req.requestNumber}</p>
                        <Badge variant="outline" className={getStatusColor(req.status)}>
                          {req.status}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(req.priority)}>
                          {req.priority}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">
                        <span className="font-medium">{req.item?.name}</span> — {req.quantity} {req.unitOfMeasure}
                      </p>
                    </div>
                    {req.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId === req.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {processingId === req.id ? "..." : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {processingId === req.id ? "..." : "Reject"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>By: {req.requestedBy?.name || "Unknown"}</span>
                    {req.farm?.name && <span>Farm: {req.farm.name}</span>}
                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    {req.reviewedBy?.name && (
                      <span>Reviewed by: {req.reviewedBy.name}</span>
                    )}
                  </div>
                  {req.purpose && (
                    <p className="text-sm text-muted-foreground italic">{req.purpose}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RequestForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          fetchRequests();
        }}
      />
    </div>
  );
}
