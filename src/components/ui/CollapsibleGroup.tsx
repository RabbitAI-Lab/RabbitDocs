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
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors sticky top-0 bg-white z-10"
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
