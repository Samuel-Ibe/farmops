"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowLeftRight,
  ClipboardList,
  Tractor,
  Truck,
  FileText,
  Trash2,
  ClipboardCheck,
  Calendar,
  BarChart3,
  ScrollText,
  Sprout,
  QrCode,
  Bell,
  Settings,
  Brain,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  Package: <Package className="h-5 w-5" />,
  Warehouse: <Warehouse className="h-5 w-5" />,
  ArrowLeftRight: <ArrowLeftRight className="h-5 w-5" />,
  ClipboardList: <ClipboardList className="h-5 w-5" />,
  Tractor: <Tractor className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Trash2: <Trash2 className="h-5 w-5" />,
  ClipboardCheck: <ClipboardCheck className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  ScrollText: <ScrollText className="h-5 w-5" />,
  QrCode: <QrCode className="h-5 w-5" />,
  Bell: <Bell className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  Brain: <Brain className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 border-r bg-card transition-transform lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Sprout className="h-8 w-8 text-green-600 dark:text-green-400" />
          <div>
            <h1 className="text-lg font-bold text-foreground">FarmOps</h1>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Season &amp; stock control
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {iconMap[item.icon]}
                {t(`nav.${item.label.toLowerCase().replace(/ /g, '')}`) || item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            FarmOps v0.1.0
          </p>
        </div>
      </aside>
    </>
  );
}
