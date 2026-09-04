"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";
import { ROLE_LABELS } from "@/lib/constants";
import { GlobalSearch } from "@/components/shared/global-search";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global Search */}
      <GlobalSearch />

      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Theme toggle */}
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      {/* Notifications */}
      <Button variant="ghost" size="icon" asChild>
        <Link href="/notifications">
          <Bell className="h-5 w-5" />
        </Link>
      </Button>

      {/* User menu */}
      <div className="relative">
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-3"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-sm font-medium text-green-700 dark:text-green-300">
            {session?.user?.name?.charAt(0) || "U"}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[(session?.user as any)?.role] || "User"}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>

        {/* Dropdown */}
        {showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border bg-card p-1 shadow-lg">
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => setShowUserMenu(false)}
              >
                <Settings className="h-4 w-4" />
                {t("settings.title")}
              </Link>
              <button
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                {t("nav.logout")}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
