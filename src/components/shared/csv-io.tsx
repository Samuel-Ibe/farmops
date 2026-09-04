"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Download,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

interface CsvIOProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "inventory" | "transactions";
  onSuccess?: () => void;
}

export function CsvIO({ open, onOpenChange, type, onSuccess }: CsvIOProps) {
  const [mode, setMode] = useState<"choose" | "importing" | "exporting" | "result">("choose");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const typeName = type === "inventory" ? "Inventory Items" : "Stock Transactions";

  const handleExport = async () => {
    setMode("exporting");
    setLoading(true);
    try {
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `farmops-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResult({ success: true, message: `${typeName} exported successfully!` });
      setMode("result");
      toast(`${typeName} exported`, "success");
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Export failed" });
      setMode("result");
      toast("Export failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setMode("importing");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      setMode("result");
      toast(data.message, "success");
      onSuccess?.();
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Import failed" });
      setMode("result");
      toast("Import failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode("choose");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
          e.target.value = "";
        }}
      />

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          {mode === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {typeName} — CSV Import/Export
                </DialogTitle>
                <DialogDescription>
                  Import or export {typeName.toLowerCase()} using CSV files.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4">
                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-4 rounded-lg border p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="rounded-lg bg-blue-50 p-3">
                    <Download className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Export to CSV</p>
                    <p className="text-sm text-muted-foreground">
                      Download all {typeName.toLowerCase()} as a CSV file
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-4 rounded-lg border p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="rounded-lg bg-green-50 p-3">
                    <Upload className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Import from CSV</p>
                    <p className="text-sm text-muted-foreground">
                      Upload a CSV file to import {typeName.toLowerCase()}
                    </p>
                  </div>
                </button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}

          {(mode === "importing" || mode === "exporting") && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {mode === "importing" ? "Importing..." : "Exporting..."}
                </DialogTitle>
                <DialogDescription>
                  {mode === "importing"
                    ? "Processing your CSV file. This may take a moment."
                    : "Generating your CSV export file."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
                  <p className="mt-4 text-sm text-muted-foreground">Please wait...</p>
                </div>
              </div>
            </>
          )}

          {mode === "result" && result && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {result.success !== false ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  {result.success !== false ? "Success" : "Error"}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <p className="text-sm">{result.message}</p>

                {result.created !== undefined && (
                  <div className="flex gap-2 flex-wrap">
                    {result.created > 0 && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {result.created} created
                      </Badge>
                    )}
                    {result.updated > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {result.updated} updated
                      </Badge>
                    )}
                    {result.skipped > 0 && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        {result.skipped} skipped
                      </Badge>
                    )}
                  </div>
                )}

                {result.errors?.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 max-h-32 overflow-y-auto">
                    {result.errors.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-red-600">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
