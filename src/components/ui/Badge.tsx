import { clsx } from "clsx";

interface BadgeProps {
  variant: "dot" | "count" | "text";
  count?: number;
  text?: string;
  className?: string;
}

/**
 * 小红点/徽标组件
 */
export default function Badge({ variant, count, text, className }: BadgeProps) {
  if (variant === "dot") {
    return (
      <span
        className={clsx(
          "inline-flex w-2 h-2 rounded-full bg-red-500",
          className
        )}
      />
    );
  }

  if (variant === "count" && count !== undefined) {
    return (
      <span
        className={clsx(
          "inline-flex items-center justify-center",
          "min-w-[18px] h-[18px] px-1.5",
          "rounded-full bg-red-500 text-white text-xs font-medium",
          className
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  if (variant === "text" && text) {
    return (
      <span
        className={clsx(
          "inline-flex items-center justify-center",
          "px-2 py-0.5",
          "rounded-full bg-red-500 text-white text-xs font-medium",
          className
        )}
      >
        {text}
      </span>
    );
  }

  return null;
}