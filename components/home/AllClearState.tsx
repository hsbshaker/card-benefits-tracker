import { Surface } from "@/components/ui/Surface";

type AllClearStateProps = {
  headline: string;
};

export function AllClearState({ headline }: AllClearStateProps) {
  return (
    <Surface className="rounded-[2rem] border-white/12 bg-white/6 p-6 sm:p-7">
      <p className="text-2xl font-semibold tracking-tight text-white">{headline}</p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Nothing needs attention right away.</p>
    </Surface>
  );
}
