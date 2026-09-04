"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, isExpiringSoon, isExpired, daysUntilExpiry } from "@/lib/utils";
import {
  QrCode,
  Search,
  Package,
  Clock,
  AlertTriangle,
  Loader2,
  Camera,
  CameraOff,
  ScanLine,
  X,
  ChevronDown,
  ChevronUp,
  Boxes,
} from "lucide-react";

export default function QRPage() {
  const [scanInput, setScanInput] = useState("");
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [showBatches, setShowBatches] = useState(true);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((res) => setItems(Array.isArray(res) ? res : res?.data || []))
      .catch(() => {});
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setScanResult("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}
        scannerRef.current = null;
      }

      const container = scannerContainerRef.current;
      if (!container) return;

      // Clear previous content
      container.innerHTML = "";

      const scanner = new Html5Qrcode("qr-scanner-container");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // On successful scan
          setScanResult(decodedText);
          setScanInput(decodedText);
          handleScanCode(decodedText);

          // Stop camera after successful scan
          scanner.stop().then(() => {
            setCameraActive(false);
          }).catch(() => {});
        },
        () => {} // Ignore scan errors (no code found is normal)
      );

      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(
        err?.message?.includes("NotAllowedError")
          ? "Camera access denied. Please allow camera permissions."
          : err?.message?.includes("NotFoundError")
          ? "No camera found on this device."
          : "Failed to start camera. Try using the search input instead."
      );
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [cameraActive, startCamera, stopCamera]);

  const handleScanCode = async (code: string) => {
    if (!code.trim()) return;
    setScanLoading(true);
    setScannedItem(null);

    try {
      // Try QR API first
      const qrRes = await fetch(`/api/qr?code=${encodeURIComponent(code)}`);
      if (qrRes.ok) {
        const data = await qrRes.json();
        if (data.found) {
          setScannedItem(data);
          toast(`Found: ${data.item?.name || data.batch?.batchNumber}`, "success");
          setScanLoading(false);
          return;
        }
      }

      // Fallback to inventory search
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(code)}`);
      if (res.ok) {
        const results = await res.json();
        if (results.length > 0) {
          setScannedItem({ found: true, matchType: "item", item: results[0] });
          toast(`Found: ${results[0].name}`, "success");
        } else {
          toast("No item found for this code", "warning");
        }
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast("Scan lookup failed", "error");
    } finally {
      setScanLoading(false);
    }
  };

  const handleManualScan = () => {
    handleScanCode(scanInput);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR / Barcode Scanner"
        description="Scan or search for inventory items by QR code, barcode, or batch number"
      />

      {/* Camera Scanner */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Scanner
            </div>
            <div className="flex gap-2">
              {!cameraActive ? (
                <Button size="sm" onClick={startCamera}>
                  <Camera className="h-4 w-4 mr-2" />
                  Start Camera
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopCamera}>
                  <CameraOff className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cameraError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
              <p className="text-sm text-amber-800">{cameraError}</p>
            </div>
          )}

          {/* Scanner viewport */}
          <div
            ref={scannerContainerRef}
            id="qr-scanner-container"
            className={`relative rounded-lg overflow-hidden bg-gray-900 ${
              cameraActive ? "min-h-[300px]" : "min-h-[120px]"
            } flex items-center justify-center`}
          >
            {!cameraActive && (
              <div className="text-center py-8">
                <ScanLine className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-sm">
                  Click &quot;Start Camera&quot; to begin scanning QR codes and barcodes
                </p>
              </div>
            )}
          </div>

          {scanResult && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-green-600" />
              <span className="text-sm font-mono text-green-800">{scanResult}</span>
            </div>
          )}

          {cameraActive && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 relative">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Scanned code will appear here..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualScan()}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button size="sm" onClick={handleManualScan} disabled={scanLoading || !scanInput.trim()}>
                {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look Up"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Search Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Manual Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Enter batch number, item name, or barcode..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualScan()}
                className="flex h-12 w-full rounded-md border border-input bg-background px-4 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button onClick={handleManualScan} disabled={scanLoading} size="lg">
              {scanLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5 mr-2" />
              )}
              Look Up
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanned Item Details */}
      {scannedItem && scannedItem.found && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Package className="h-5 w-5" />
              {scannedItem.matchType === "batch" ? "Batch Found" : "Item Found"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Batch-specific info */}
              {scannedItem.batch && (
                <div className="rounded-lg border p-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Batch Number</p>
                      <p className="font-mono text-lg font-bold">{scannedItem.batch.batchNumber}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        scannedItem.batch.status === "ACTIVE"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }
                    >
                      {scannedItem.batch.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="font-medium">
                        {scannedItem.batch.quantityRemaining} / {scannedItem.batch.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unit Cost</p>
                      <p className="font-medium">{formatCurrency(scannedItem.batch.purchasePrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Warehouse</p>
                      <p className="font-medium">{scannedItem.batch.warehouse?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Farm</p>
                      <p className="font-medium">{scannedItem.batch.warehouse?.farm?.name}</p>
                    </div>
                  </div>
                  {scannedItem.batch.expiryDate && (
                    <div className="mt-3 flex items-center gap-2">
                      {isExpired(scannedItem.batch.expiryDate) ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : isExpiringSoon(scannedItem.batch.expiryDate) ? (
                        <Clock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          isExpired(scannedItem.batch.expiryDate)
                            ? "text-red-600 font-medium"
                            : isExpiringSoon(scannedItem.batch.expiryDate)
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        Expires: {new Date(scannedItem.batch.expiryDate).toLocaleDateString()}
                        {isExpired(scannedItem.batch.expiryDate)
                          ? " (EXPIRED)"
                          : isExpiringSoon(scannedItem.batch.expiryDate)
                          ? ` (${daysUntilExpiry(scannedItem.batch.expiryDate)} days left)`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Item overview */}
              <div>
                <h3 className="text-xl font-bold">{scannedItem.item?.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {scannedItem.item?.category && (
                    <Badge variant="outline">{scannedItem.item.category.name}</Badge>
                  )}
                  {scannedItem.item?.totalQuantity !== undefined && (
                    <Badge variant="outline">
                      {scannedItem.item.totalQuantity} {scannedItem.item.unitOfMeasure} available
                    </Badge>
                  )}
                  {scannedItem.item?.totalValue !== undefined && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {formatCurrency(scannedItem.item.totalValue)}
                    </Badge>
                  )}
                </div>
                {scannedItem.item?.description && (
                  <p className="text-sm text-muted-foreground mt-2">{scannedItem.item.description}</p>
                )}
              </div>

              {/* Related batches */}
              {scannedItem.relatedBatches && scannedItem.relatedBatches.length > 1 && (
                <div>
                  <button
                    onClick={() => setShowBatches(!showBatches)}
                    className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-green-700"
                  >
                    <Boxes className="h-4 w-4" />
                    All Active Batches ({scannedItem.relatedBatches.length})
                    {showBatches ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showBatches && (
                    <div className="space-y-2">
                      {scannedItem.relatedBatches.map((batch: any) => {
                        const expiring = batch.expiryDate && isExpiringSoon(batch.expiryDate);
                        const expired = batch.expiryDate && isExpired(batch.expiryDate);
                        return (
                          <div
                            key={batch.id}
                            className={`rounded-lg border p-3 ${
                              expired ? "border-red-200 bg-red-50" : expiring ? "border-amber-200 bg-amber-50" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-mono text-sm font-medium">{batch.batchNumber}</p>
                                <p className="text-xs text-muted-foreground">
                                  {batch.warehouse?.name} ({batch.warehouse?.farm?.name})
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  {batch.quantityRemaining} {scannedItem.item?.unitOfMeasure}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency((batch.purchasePrice || 0) * batch.quantityRemaining)}
                                </p>
                              </div>
                            </div>
                            {batch.expiryDate && (
                              <div className="flex items-center gap-1 mt-2 text-xs">
                                {expired ? (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                ) : (
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={expired ? "text-red-600" : expiring ? "text-amber-600" : "text-muted-foreground"}>
                                  Expires: {new Date(batch.expiryDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Recent transactions */}
              {scannedItem.recentTransactions && scannedItem.recentTransactions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Transactions</h4>
                  <div className="space-y-1">
                    {scannedItem.recentTransactions.slice(0, 5).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${
                            tx.type === "RECEIVED" ? "bg-green-50 text-green-700" :
                            tx.type === "ISSUED" ? "bg-blue-50 text-blue-700" :
                            tx.type === "WASTED" ? "bg-red-50 text-red-700" :
                            "bg-gray-50"
                          }`}>
                            {tx.type}
                          </Badge>
                          <span>{tx.quantity} units</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {tx.performedBy?.name} • {new Date(tx.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={() => { setScannedItem(null); setScanInput(""); }}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Browse */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Browse</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search inventory..."
            className="max-w-sm mb-4"
          />
          <div className="space-y-2">
            {items
              .filter((item) =>
                item.name.toLowerCase().includes(search.toLowerCase())
              )
              .slice(0, 10)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setScannedItem({ found: true, matchType: "item", item });
                    setScanInput(item.name);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.batches?.length || 0} batches • {item.unitOfMeasure}
                      {item.category && ` • ${item.category.name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {item.totalQuantity || 0} {item.unitOfMeasure}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.totalValue || 0)}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
