import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-100 motion-reduce:transition-none",
        variant === "primary" && "bg-navy text-white hover:bg-[#163b68]",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" && "bg-urgent text-white hover:bg-red-700",
        className
      )}
      {...props}
    />
  );
}
