"use client";

import { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { SidebarContext } from "./SidebarContext";

const MIN_WIDTH = 190;
const MAX_WIDTH = 280;
const COLLAPSED_WIDTH = 52;

interface SidebarShellProps {
  children: ReactNode;
}

export default function SidebarShell({ children }: SidebarShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(MAX_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const widthRef = useRef(width);

  // Load persisted state from localStorage after mount
  useEffect(() => {
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    const savedWidth = localStorage.getItem("sidebar-width");
    if (savedCollapsed !== null) {
      setCollapsed(savedCollapsed === "true");
    }
    if (savedWidth !== null) {
      const w = parseInt(savedWidth, 10);
      if (!isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
        setWidth(w);
        widthRef.current = w;
      }
    }
    setMounted(true);
  }, []);

  // Persist state changes
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("sidebar-width", String(width));
  }, [width, mounted]);

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
        className={`h-full flex flex-col bg-white border-r border-gray-200 shrink-0 relative ${
          !isResizing ? "transition-[width] duration-200 ease-in-out" : ""
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className={`border-b border-gray-100 flex items-center justify-between ${collapsed ? "px-0 py-2.5" : "px-3 py-3"}`}>
          {collapsed ? (
            <span className="text-sm font-bold text-gray-800 mx-auto cursor-pointer select-none" onClick={toggleCollapsed}>CW</span>
          ) : (
            <div>
              <h1 className="text-lg font-bold text-gray-800">ChatWiki</h1>
              <p className="text-xs text-gray-400 mt-0.5">文档管理与发布</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="折叠侧边栏"
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
