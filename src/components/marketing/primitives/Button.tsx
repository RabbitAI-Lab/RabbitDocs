import Link from "next/link";
import { ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  iconRight?: ReactNode;
}

interface LinkProps extends BaseProps {
  href: string;
  external?: boolean;
  type?: never;
  onClick?: never;
}

interface ButtonProps extends BaseProps {
  href?: never;
  external?: never;
  type?: "button" | "submit";
  onClick?: () => void;
}

type Props = LinkProps | ButtonProps;

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-bg)] disabled:opacity-50 disabled:pointer-events-none";

const variantClass: Record<Variant, string> = {
  primary:
    "btn-primary-gradient hover:-translate-y-0.5",
  secondary:
    "btn-secondary-glass border border-[var(--marketing-border)] text-[var(--marketing-fg)] hover:-translate-y-0.5",
  ghost:
    "text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)] hover:bg-[var(--marketing-surface)]",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-sm",
};

/**
 * 营销站通用按钮:支持 Link 与原生 button,三态(primary/secondary/ghost)+ 三尺寸
 */
export function Button(props: Props) {
  const {
    children,
    variant = "primary",
    size = "md",
    className,
    iconRight,
  } = props;
  const classes = clsx(baseClass, variantClass[variant], sizeClass[size], className);

  if ("href" in props && props.href) {
    if (props.external) {
      return (
        <a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
        >
          {children}
          {iconRight}
        </a>
      );
    }
    return (
      <Link href={props.href} className={classes}>
        {children}
        {iconRight}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className={classes}
    >
      {children}
      {iconRight}
    </button>
  );
}
