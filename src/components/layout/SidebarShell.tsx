"use client";

import { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { SidebarContext } from "./SidebarContext";

const MIN_WIDTH = 190;
const MAX_WIDTH = 280;
const COLLAPSED_WIDTH = 52;

function parseInitialWidth(value?: string): number {
  if (!value) return MAX_WIDTH;
  const w = parseInt(value, 10);
  return !isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH ? w : MAX_WIDTH;
}

function parseInitialCollapsed(value?: string): boolean {
  return value === "true";
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

interface SidebarShellProps {
  children: ReactNode;
  initialWidth?: string;
  initialCollapsed?: string;
  brandName: string;
}

export default function SidebarShell({ children, initialWidth, initialCollapsed, brandName }: SidebarShellProps) {
  const initWidth = parseInitialWidth(initialWidth);
  const initCollapsed = parseInitialCollapsed(initialCollapsed);
  const t = useTranslations("sidebar");

  const [collapsed, setCollapsed] = useState(initCollapsed);
  const [width, setWidth] = useState(initWidth);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(initWidth);

  // Persist state changes to localStorage + cookie
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    setCookie("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem("sidebar-width", String(width));
    setCookie("sidebar-width", String(width));
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    widthRef.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX));
      widthRef.current = newWidth;
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [width]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const currentWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <aside
        style={{ width: currentWidth }}
        className={`h-full flex flex-col bg-white dark:bg-[var(--sidebar-bg)] border-r border-gray-200 dark:border-[var(--sidebar-border)] shrink-0 relative overflow-hidden ${
          !isResizing ? "transition-[width] duration-200 ease-in-out" : ""
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className={`border-b border-gray-100 dark:border-[var(--sidebar-border-subtle)] flex items-center justify-between ${collapsed ? "px-0 py-2.5" : "px-3 py-3"}`}>
          {collapsed ? (
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200 mx-auto cursor-pointer select-none" onClick={toggleCollapsed}>🐰</span>
          ) : (
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">{brandName}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('documentManagementPublishing')}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              title={t('collapseSidebar')}
            >
              <MenuOutlined style={{ fontSize: 14 }} />
            </button>
          )}
        </div>

        {/* Collapsible content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>

        {/* Resize handle */}
        {!collapsed && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50 z-20"
          />
        )}
      </aside>
    </SidebarContext.Provider>
  );
}
