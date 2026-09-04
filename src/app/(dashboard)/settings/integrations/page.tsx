"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Webhook,
  Key,
  Mail,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";

// ─── Webhook Tab ───────────────────────────────────────
function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["*"]);
  const [loading, setLoading] = useState(true);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
      setEvents(data.availableEvents || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async () => {
    if (!newUrl) return;
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newUrl, events: newEvents }),
    });
    setShowCreate(false);
    setNewUrl("");
    setNewEvents(["*"]);
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    fetchWebhooks();
  };

  const handleTest = async (id: string) => {
    const res = await fetch(`/api/webhooks/${id}`);
    const data = await res.json();
    setDeliveryLogs(data.logs || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Webhooks</h3>
          <p className="text-sm text-muted-foreground">
            Register URLs to receive real-time event notifications
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-1" /> Add Webhook
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <Webhook className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No webhooks registered yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={wh.isActive ? "default" : "secondary"}>
                      {wh.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="font-mono text-sm">{wh.url}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {wh.events.map((ev: string) => (
                      <Badge key={ev} variant="outline" className="text-xs">
                        {ev}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleTest(wh.id)}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(wh.id)} className="text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Endpoint URL</Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  variant={newEvents.includes("*") ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setNewEvents(newEvents.includes("*") ? [] : ["*"])
                  }
                >
                  * (all events)
                </Badge>
                {events.slice(0, 10).map((ev) => (
                  <Badge
                    key={ev}
                    variant={newEvents.includes(ev) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() =>
                      setNewEvents(
                        newEvents.includes(ev)
                          ? newEvents.filter((e) => e !== ev)
                          : [...newEvents, ev]
                      )
                    }
                  >
                    {ev}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deliveryLogs.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Recent Deliveries</h4>
          <div className="space-y-1">
            {deliveryLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 text-sm rounded bg-muted/50 px-3 py-1.5">
                <Badge variant={log.success ? "default" : "destructive"} className="text-xs">
                  {log.statusCode || "ERR"}
                </Badge>
                <span className="font-mono text-xs">{log.event}</span>
                <span className="text-muted-foreground">{log.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── API Keys Tab ──────────────────────────────────────
function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermissions, setNewPermissions] = useState(["read:inventory"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const allPermissions = [
    "read:inventory", "write:inventory",
    "read:batches", "write:batches",
    "read:transactions", "write:transactions",
    "read:webhooks", "write:webhooks",
    "read:reports",
  ];

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      setKeys(data.apiKeys || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, permissions: newPermissions }),
    });
    const data = await res.json();
    setCreatedKey(data.key);
    fetchKeys();
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for external system integrations
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); setCreatedKey(null); }} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-1" /> Create Key
        </Button>
      </div>

      {createdKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
          <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
            ✅ API Key Created — Copy it now, it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono break-all border dark:bg-gray-900">
              {createdKey}
            </code>
            <Button size="sm" variant="outline" onClick={() => handleCopy(createdKey)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-3 rounded bg-white/50 p-3 text-xs text-muted-foreground dark:bg-gray-900/50">
            <p className="font-medium mb-1">Usage Example:</p>
            <code className="text-xs">curl -H &quot;Authorization: Bearer {createdKey.slice(0, 20)}...&quot; https://your-app.com/api/external/inventory</code>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <Key className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <Badge variant={k.isActive ? "default" : "secondary"}>
                      {k.isActive ? "Active" : "Revoked"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs font-mono text-muted-foreground">
                    {k.keyPreview}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {k.permissions.map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[10px]">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Used {k.usageCount} times • Last: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Mobile App Connector" className="mt-1" />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {allPermissions.map((p) => (
                  <Badge
                    key={p}
                    variant={newPermissions.includes(p) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() =>
                      setNewPermissions(
                        newPermissions.includes(p)
                          ? newPermissions.filter((x) => x !== p)
                          : [...newPermissions, p]
                      )
                    }
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName} className="bg-green-600 hover:bg-green-700">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Email Tab ─────────────────────────────────────────
function EmailTab() {
  const [config, setConfig] = useState({
    host: process.env.SMTP_HOST || "",
    port: "587",
    secure: false,
    user: "",
    pass: "",
    from: "FarmOps <noreply@farmops.com>",
  });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleTestEmail = async () => {
    setSending(true);
    setTestResult(null);
    // Simulate test email (actual SMTP config is in .env)
    setTimeout(() => {
      setTestResult(
        "Email configuration is managed via environment variables (.env). Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM."
      );
      setSending(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Email Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Configure SMTP settings for email alerts and notifications
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Email is configured via environment variables. Set these in your <code className="rounded bg-muted px-1">.env</code> file:
        </p>
        <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs space-y-1">
          <div>SMTP_HOST=smtp.gmail.com</div>
          <div>SMTP_PORT=587</div>
          <div>SMTP_SECURE=false</div>
          <div>SMTP_USER=your-email@gmail.com</div>
          <div>SMTP_PASS=your-app-password</div>
          <div>SMTP_FROM=FarmOps &lt;noreply@farmops.com&gt;</div>
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={handleTestEmail} disabled={sending}>
            <Mail className="h-4 w-4 mr-1" />
            {sending ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
        {testResult && (
          <div className="mt-2 rounded-lg border bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
            {testResult}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h4 className="font-medium">Notification Types</h4>
        <div className="space-y-2 text-sm">
          {[
            { label: "Low Stock Alerts", desc: "When items fall below reorder point" },
            { label: "Expiry Warnings", desc: "When batches are approaching expiry" },
            { label: "PO Status Updates", desc: "When purchase orders change status" },
            { label: "Request Approvals", desc: "When resource requests are approved/rejected" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Badge variant="default" className="text-xs">Enabled</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Exports Tab ───────────────────────────────────────
function ExportsTab() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: string, type: string) => {
    setExporting(`${format}-${type}`);
    try {
      const url = format === "excel"
        ? `/api/export/excel?type=${type}`
        : `/api/export/pdf?type=${type}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const ext = format === "excel" ? "xlsx" : "pdf";
        const filename = `FarmOps-${type}-${new Date().toISOString().split("T")[0]}.${ext}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally {
      setExporting(null);
    }
  };

  const exportTypes = [
    { key: "inventory", label: "Inventory", desc: "All items, quantities, values, and batch details" },
    { key: "transactions", label: "Transactions", desc: "All stock movements with dates and quantities" },
    { key: "batches", label: "Batches", desc: "Batch details with expiry and supplier info" },
    { key: "waste", label: "Waste Records", desc: "All waste/loss records with types and values" },
    { key: "summary", label: "Full Summary", desc: "Complete report with inventory + waste analysis" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Data Export</h3>
        <p className="text-sm text-muted-foreground">
          Export your data to Excel (.xlsx) or PDF format
        </p>
      </div>

      <div className="space-y-3">
        {exportTypes.map((exp) => (
          <div key={exp.key} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <div className="font-medium">{exp.label}</div>
              <div className="text-sm text-muted-foreground">{exp.desc}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport("excel", exp.key)}
                disabled={!!exporting}
              >
                <Download className="h-3 w-3 mr-1" />
                {exporting === `excel-${exp.key}` ? "Exporting..." : "Excel"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport("pdf", exp.key)}
                disabled={!!exporting}
              >
                <Download className="h-3 w-3 mr-1" />
                {exporting === `pdf-${exp.key}` ? "Exporting..." : "PDF"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<"webhooks" | "api-keys" | "email" | "exports">("webhooks");

  const tabs = [
    { key: "webhooks" as const, label: "Webhooks", icon: Webhook },
    { key: "api-keys" as const, label: "API Keys", icon: Key },
    { key: "email" as const, label: "Email", icon: Mail },
    { key: "exports" as const, label: "Exports", icon: Download },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Webhooks, API access, email notifications, and data exports
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent className="p-6">
          {activeTab === "webhooks" && <WebhooksTab />}
          {activeTab === "api-keys" && <ApiKeysTab />}
          {activeTab === "email" && <EmailTab />}
          {activeTab === "exports" && <ExportsTab />}
        </CardContent>
      </Card>
    </div>
  );
}
