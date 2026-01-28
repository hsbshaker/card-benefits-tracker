import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userCards } = await supabase
    .from("user_cards")
    .select("cards_catalog(name)")
    .eq("user_id", user.id);

  const cardNames = (userCards ?? [])
    .map((card) => card.cards_catalog?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <main>
      <h1>Your Cards</h1>
      <ul>
        {cardNames.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p>Benefits tracking coming next</p>
    </main>
  );
}
