import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#7FB6FF] text-[#08111F] shadow-[0_16px_45px_-18px_rgba(127,182,255,0.75)] hover:brightness-110 active:brightness-95 disabled:opacity-60",
  secondary: "bg-white/5 text-white/85 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60",
  subtle:
    "border border-white/15 bg-white/8 text-white/90 hover:border-[#F7C948]/40 hover:bg-[#F7C948]/10 hover:text-white disabled:opacity-60",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "rounded-xl px-4 py-2 text-sm font-semibold",
  md: "rounded-xl px-5 py-2.5 text-sm font-semibold",
  lg: "rounded-2xl px-7 py-3.5 text-base font-semibold",
};

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220] disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
