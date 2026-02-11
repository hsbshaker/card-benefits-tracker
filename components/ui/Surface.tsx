import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

type SurfaceVariant = "panel" | "card";

type SurfaceProps<T extends ElementType> = {
  as?: T;
  variant?: SurfaceVariant;
} & ComponentPropsWithoutRef<T>;

const surfaceVariants: Record<SurfaceVariant, string> = {
  panel: "rounded-2xl border border-white/15 bg-white/8 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.95)] backdrop-blur-md",
  card: "rounded-3xl border border-white/15 bg-white/8 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-300 ease-out hover:border-[#F7C948]/40 hover:bg-[#F7C948]/10 hover:shadow-[0_24px_60px_-34px_rgba(247,201,72,0.5)]",
};

export function Surface<T extends ElementType = "div">({
  as,
  className,
  variant = "panel",
  ...props
}: SurfaceProps<T>) {
  const Component = as ?? "div";

  return <Component className={cn(surfaceVariants[variant], className)} {...props} />;
}
