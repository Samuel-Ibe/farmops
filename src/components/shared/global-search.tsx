"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search,
  Package,
  Warehouse,
  ArrowLeftRight,
  Truck,
  FileText,
  ClipboardList,
  QrCode,
  CornerDownLeft,
} from "lucide-react";

interface SearchResult {
  type: "item" | "batch" | "transaction" | "supplier" | "warehouse" | "request";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const extract = (res: any) => Array.isArray(res) ? res : res?.data || [];
      const [inventoryRes, suppliersRes] = await Promise.all([
        fetch(`/api/inventory?search=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/suppliers`).then((r) => r.json()).catch(() => []),
      ]);

      const items: SearchResult[] = [];

      // Inventory items
      const invItems = extract(inventoryRes);
      if (invItems.length) {
        invItems.slice(0, 5).forEach((item: any) => {
          items.push({
            type: "item",
            id: item.id,
            title: item.name,
            subtitle: `${item.category?.name || "Uncategorized"} • ${item.totalQuantity || 0} ${item.unitOfMeasure}`,
            href: "/inventory",
          });
          // Batches
          item.batches?.slice(0, 2).forEach((batch: any) => {
            items.push({
              type: "batch",
              id: batch.id,
              title: batch.batchNumber,
              subtitle: `${item.name} • ${batch.quantityRemaining} remaining`,
              href: "/inventory",
            });
          });
        });
      }

      // Suppliers
      const suppliers = extract(suppliersRes);
      if (suppliers.length) {
        suppliers
          .filter((s: any) => s.name.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 3)
          .forEach((supplier: any) => {
            items.push({
              type: "supplier",
              id: supplier.id,
              title: supplier.name,
              subtitle: supplier.contactPerson || supplier.email || "",
              href: "/suppliers",
            });
          });
      }

      setResults(items);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      setOpen(false);
    }
  };

  const typeIcons: Record<string, React.ReactNode> = {
    item: <Package className="h-4 w-4" />,
    batch: <QrCode className="h-4 w-4" />,
    transaction: <ArrowLeftRight className="h-4 w-4" />,
    supplier: <Truck className="h-4 w-4" />,
    warehouse: <Warehouse className="h-4 w-4" />,
    request: <ClipboardList className="h-4 w-4" />,
  };

  const typeColors: Record<string, string> = {
    item: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    batch: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    transaction: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    supplier: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    warehouse: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    request: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };

  return (
    <>
      {/* Trigger button in header - shown via keyboard shortcut hint */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 text-[10px] font-medium">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0">
          {/* Search input */}
          <div className="flex items-center border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search inventory, batches, suppliers..."
              className="flex h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {!query.trim() ? (
              <div className="py-8 text-center">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Start typing to search across inventory, batches, and suppliers
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> to close
                </p>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No results found for &quot;{query}&quot;</p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result, index) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className={cn("rounded-md p-1.5", typeColors[result.type])}>
                      {typeIcons[result.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {result.type}
                    </Badge>
                    {index === selectedIndex && (
                      <CornerDownLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
