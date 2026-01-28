import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type PlaceholderCard = {
  id: string;
  name: string;
  issuer: string;
};

const placeholderCards: PlaceholderCard[] = [
  { id: "sample-1", name: "Everyday Rewards", issuer: "Sample Bank" },
  { id: "sample-2", name: "Travel Plus", issuer: "Example Credit" },
];

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-600 mt-2">
        Signed in as {user.email ?? "your account"}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your cards</h2>
        <ul className="mt-4 space-y-3">
          {placeholderCards.map((card) => (
            <li
              key={card.id}
              className="rounded-xl border p-4 flex flex-col gap-1"
            >
              <span className="text-sm font-medium">{card.name}</span>
              <span className="text-xs text-gray-500">{card.issuer}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
