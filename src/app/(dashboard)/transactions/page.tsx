"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { TransactionForm } from "@/components/forms/transaction-form";
import { formatCurrency } from "@/lib/utils";
import { CsvIO } from "@/components/shared/csv-io";
import {
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  AlertTriangle,
  Loader2,
  Filter,
  FileDown,
} from "lucide-react";

const TX_TYPES = ["RECEIVED", "ISSUED", "TRANSFERRED", "ADJUSTED", "RETURNED", "WASTED"];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("RECEIVED");
  const [showCsvIO, setShowCsvIO] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) { const json = await res.json(); setTransactions(Array.isArray(json) ? json : json?.data || []); }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const filtered = safeTransactions.filter(
    (tx) =>
      tx.batch?.item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.batchNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "RECEIVED":
        return <ArrowDown className="h-5 w-5 text-green-600" />;
      case "ISSUED":
        return <ArrowUp className="h-5 w-5 text-blue-600" />;
      case "TRANSFERRED":
        return <ArrowRightLeft className="h-5 w-5 text-purple-600" />;
      case "WASTED":
      case "RETURNED":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <ArrowRightLeft className="h-5 w-5 text-gray-600" />;
    }
  };

  const openNewTransaction = (type: string) => {
    setFormType(type);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transactions"
        description="Track all stock movements across your warehouses"
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCsvIO(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => openNewTransaction("ISSUED")}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Issue Stock
          </Button>
          <Button onClick={() => openNewTransaction("TRANSFERRED")}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfer
          </Button>
        </div>
      </PageHeader>

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTypeFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            !typeFilter ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
          }`}
        >
          All
        </button>
        {TX_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              typeFilter === type
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search transactions..."
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
              <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search" : "Record your first transaction to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                    {getTypeIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {tx.batch?.item?.name || "Unknown Item"}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          tx.type === "RECEIVED"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : tx.type === "ISSUED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : tx.type === "TRANSFERRED"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }
                      >
                        {tx.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.quantity} {tx.batch?.item?.unitOfMeasure || "units"} •{" "}
                      {tx.fromWarehouse?.name || tx.toWarehouse?.name || "N/A"}
                      {tx.batch?.batchNumber && ` • Batch: ${tx.batch.batchNumber}`}
                      {tx.performedBy?.name && ` • By: ${tx.performedBy.name}`}
                    </p>
                    {tx.reason && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {tx.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(tx.totalValue || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={showForm}
        onOpenChange={setShowForm}
        type={formType}
        onSuccess={() => {
          setShowForm(false);
          fetchTransactions();
        }}
      />

      <CsvIO
        open={showCsvIO}
        onOpenChange={setShowCsvIO}
        type="transactions"
        onSuccess={() => {
          fetchTransactions();
        }}
      />
    </div>
  );
}
