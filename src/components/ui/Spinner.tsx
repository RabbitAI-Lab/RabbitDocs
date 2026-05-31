import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md";
}

export default function Spinner({ className, size = "sm" }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
        size === "sm" ? "w-4 h-4" : "w-6 h-6",
        className
      )}
    />
  );
}
