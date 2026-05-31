"use client";

import { cn } from "@/lib/utils";

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export default function IconButton({ icon, label, onClick, active, className }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors",
        "text-blue-600 hover:bg-blue-50",
        active && "bg-blue-50 text-blue-700 font-medium",
        className
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
