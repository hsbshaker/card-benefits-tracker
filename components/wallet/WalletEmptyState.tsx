import Link from "next/link";
import { Surface } from "@/components/ui/Surface";

export function WalletEmptyState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Surface className="w-full max-w-xl rounded-[2rem] border-white/12 bg-white/6 p-8 text-center sm:p-10">
        <p className="text-2xl font-semibold tracking-tight text-white">No cards yet</p>
        <div className="mt-6">
          <Link
            href="/wallet/add"
            className="inline-flex items-center justify-center rounded-2xl bg-[#7FB6FF] px-7 py-3.5 text-base font-semibold text-[#08111F] shadow-[0_16px_45px_-18px_rgba(127,182,255,0.75)] transition duration-200 ease-out hover:brightness-110"
          >
            Add your first card
          </Link>
        </div>
      </Surface>
    </div>
  );
}
