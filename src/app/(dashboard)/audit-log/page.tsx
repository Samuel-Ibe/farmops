"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { formatCurrency } from "@/lib/utils";
import { ScrollText, Loader2 } from "lucide-react";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit-log");
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (log) =>
      log.entity?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.user?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getActionColor = (action: string) => {
    switch (action?.toUpperCase()) {
      case "CREATE":
        return "bg-green-50 text-green-700 border-green-200";
      case "UPDATE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "DELETE":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all system changes and user actions"
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search audit logs..."
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
              <ScrollText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search" : "No activity recorded yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => (
                <div key={log.id} className="flex items-start gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{log.action}</p>
                      <Badge variant="outline" className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline">{log.entityType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">                      By: {log.user?.name || "System"} • Entity: {log.entity} {" "}
                      {log.entityId && `• ID: ${log.entityId.slice(0, 8)}...`}
                    </p>
                    {log.oldValues && log.newValues && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Changes recorded
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
