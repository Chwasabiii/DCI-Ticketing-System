import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  loading = false,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-100 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-accent text-white hover:bg-blue-700",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" && "bg-urgent text-white hover:bg-red-700",
        className
      )}
      {...props}
    >
      {loading && (
        <Loader2
          aria-hidden="true"
          className="h-4 w-4 animate-spin"
          strokeWidth={1.75}
        />
      )}
      {children}
    </button>
  );
}
