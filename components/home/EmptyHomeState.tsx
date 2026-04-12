import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

export function EmptyHomeState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Surface className="w-full max-w-xl rounded-[2rem] border-white/12 bg-white/6 p-8 text-center sm:p-10">
        <p className="text-2xl font-semibold tracking-tight text-white">Add your first card to get started.</p>
        <div className="mt-6">
          <Link href="/wallet/add">
            <Button size="lg">Add card</Button>
          </Link>
        </div>
      </Surface>
    </div>
  );
}
