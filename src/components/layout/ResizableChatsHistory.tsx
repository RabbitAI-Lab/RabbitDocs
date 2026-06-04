"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import ChatsHistoryPanel from "./ChatsHistoryPanel";

const STORAGE_KEY = "chats-history-height";
const COLLAPSED_KEY = "chats-history-collapsed";
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 600;

interface ChatItem {
  id: number;
  title: string;
  updatedAt: string;
  projectId?: string | null;
  workspaceId?: string | null;
}

function loadSavedHeight(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const h = parseInt(saved, 10);
      if (!isNaN(h) && h >= MIN_HEIGHT && h <= MAX_HEIGHT) return h;
    }
  } catch {
    // ignore
  }
  return DEFAULT_HEIGHT;
}

function loadSavedCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    // ignore
  }
  return false;
}

export default function ResizableChatsHistory({ chats }: { chats: ChatItem[] }) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(height);

  // Load saved state after mount (localStorage not available during SSR)
  useEffect(() => {
    setHeight(loadSavedHeight());
    setCollapsed(loadSavedCollapsed());
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(height));
    } catch {
      // ignore
    }
  }, [height]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startYRef.current - ev.clientY;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [height]);

  if (!mounted) {
    return <div style={{ height: DEFAULT_HEIGHT }} />;
  }

  return (
    <div
      className={cn("flex flex-col transition-[height] duration-200 ease-in-out")}
      style={{ height: collapsed ? "auto" : height }}
    >
      {/* Drag handle - hidden when collapsed */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "shrink-0 h-1 cursor-row-resize group relative",
            isResizing ? "bg-blue-400/50" : "hover:bg-blue-400/30"
          )}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
            <div className={cn(
              "flex gap-[2px] transition-opacity",
              isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <div className="w-1 h-[2px] rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="w-1 h-[2px] rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="w-1 h-[2px] rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className={cn("min-h-0", !collapsed && "flex-1 overflow-y-auto")}>
        <ChatsHistoryPanel chats={chats} panelCollapsed={collapsed} onTogglePanelCollapse={setCollapsed} />
      </div>
    </div>
  );
}
