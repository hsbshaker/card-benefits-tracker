import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";

export default function SettingsLoading() {
  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        <div className="space-y-6 pt-6">
          <div className="space-y-3">
            <div className="h-4 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-10 w-44 animate-pulse rounded-full bg-white/12" />
          </div>
          <Surface className="rounded-[1.75rem] border-white/12 bg-white/6 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-5 w-40 rounded-full bg-white/12" />
              <div className="h-4 w-2/3 rounded-full bg-white/10" />
              <div className="h-24 rounded-[1.5rem] bg-white/8" />
            </div>
          </Surface>
          <Surface className="rounded-[1.75rem] border-white/12 bg-white/6 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-5 w-28 rounded-full bg-white/12" />
              <div className="h-4 w-1/3 rounded-full bg-white/10" />
            </div>
          </Surface>
        </div>
      </MobilePageContainer>
    </AppShell>
  );
}
