"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { QrCode, Download, Printer, Loader2 } from "lucide-react";

interface QRLabelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber: string;
  itemName: string;
}

export function QRLabel({
  open,
  onOpenChange,
  batchId,
  batchNumber,
  itemName,
}: QRLabelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateQR = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });

      if (res.ok) {
        const data = await res.json();
        setQrDataUrl(data.qrDataUrl);
      } else {
        toast("Failed to generate QR code", "error");
      }
    } catch {
      toast("Failed to generate QR code", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-${batchNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("QR code downloaded", "success");
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>QR Label - ${batchNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .label { border: 2px solid #000; padding: 20px; text-align: center; width: 300px; }
            .label img { width: 200px; height: 200px; }
            .label h2 { margin: 10px 0 5px; font-size: 16px; }
            .label p { margin: 2px 0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" />
            <h2>${itemName}</h2>
            <p>Batch: ${batchNumber}</p>
            <p>FarmOps Inventory</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code — {batchNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!qrDataUrl ? (
            <div className="flex flex-col items-center py-8">
              {loading ? (
                <Loader2 className="h-12 w-12 animate-spin text-green-600" />
              ) : (
                <Button onClick={generateQR}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Generate QR Code
                </Button>
              )}
              <p className="text-sm text-muted-foreground mt-3">
                Generate a QR code for batch {batchNumber}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-lg border-2 border-dashed p-4 bg-white">
                <img src={qrDataUrl} alt={`QR for ${batchNumber}`} className="w-48 h-48" />
              </div>
              <div className="text-center">
                <p className="font-medium">{itemName}</p>
                <p className="text-sm text-muted-foreground font-mono">{batchNumber}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </Button>
                <Button onClick={() => { setQrDataUrl(null); }}>
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
