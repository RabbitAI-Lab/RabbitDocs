"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleGroupProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function CollapsibleGroup({ title, defaultOpen = true, children, actions }: CollapsibleGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg
          className={cn(
            "w-3 h-3 transition-transform duration-150",
            isOpen ? "rotate-90" : "rotate-0"
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
        <span className="uppercase tracking-wider">{title}</span>
        {actions && (
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {actions}
          </span>
        )}
      </button>
      {isOpen && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
