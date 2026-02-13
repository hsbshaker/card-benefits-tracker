import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
};

export function AppShell({ children, className, containerClassName }: AppShellProps) {
  return (
    <main
      className={cn(
        "relative min-h-screen overflow-x-hidden text-white selection:bg-[#F7C948]/30 selection:text-white",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#7FB6FF]/20 blur-3xl" />
        <div className="absolute top-[320px] right-[-120px] h-[460px] w-[460px] rounded-full bg-[#F7C948]/10 blur-3xl" />
      </div>

      <div className={cn("relative mx-auto max-w-6xl px-6 py-6", containerClassName)}>{children}</div>
    </main>
  );
}
