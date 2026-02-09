import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type Card = {
  id: string;
  issuer: string;
  brand: string | null;
  card_name: string;
  network: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("user_cards")
    .select(
      `
      card_id,
      cards (
        id,
        issuer,
        brand,
        card_name,
        network
      )
    `
    )
    .eq("user_id", user.id);

  if (error) {
    // Fail loud for now; you can make this nicer later
    throw new Error(error.message);
  }

  const cards: Card[] = (data ?? [])
    .map((row: any) => row.cards)
    .filter(Boolean);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-600 mt-2">
        Signed in as {user.email ?? "your account"}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your cards</h2>

        {cards.length === 0 ? (
          <p className="text-sm text-gray-600 mt-3">
            You haven’t added any cards yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {cards.map((card) => (
              <li
                key={card.id}
                className="rounded-xl border p-4 flex flex-col gap-1"
              >
                <span className="text-sm font-medium">{card.card_name}</span>
                <span className="text-xs text-gray-500">
                  {card.issuer}
                  {card.brand ? ` • ${card.brand}` : ""} • {card.network}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
