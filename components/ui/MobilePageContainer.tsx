import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type MobilePageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function MobilePageContainer({ children, className }: MobilePageContainerProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 px-4 pt-4 pb-[calc(24px+env(safe-area-inset-bottom))] md:px-0 md:pt-0 md:pb-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
