"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleGroupProps {
  title: string;
  defaultOpen?: boolean;
  storageKey?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function CollapsibleGroup({ title, defaultOpen = true, storageKey, open, onToggle, children, actions }: CollapsibleGroupProps) {
  const [internalOpen, setInternalOpen] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
      if (saved !== null) return saved === "true";
      } catch {
        // ignore
      }
    }
    return defaultOpen;
  });

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = (value: boolean) => {
    if (onToggle) {
      onToggle(value);
    } else {
      setInternalOpen(value);
    }
  };

  useEffect(() => {
    if (storageKey && open === undefined) {
      try {
        localStorage.setItem(storageKey, String(internalOpen));
      } catch {
        // ignore
      }
    }
  }, [internalOpen, storageKey, open]);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors sticky top-0 bg-white dark:bg-zinc-900 z-10"
      >
        <span className="uppercase tracking-wider">{title}</span>
        {actions && (
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {actions}
          </span>
        )}
        <svg
          className={cn(
            "w-3 h-3 transition-transform duration-150 shrink-0",
            isOpen ? "rotate-90" : "rotate-0",
            !actions && "ml-auto"
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {isOpen && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
