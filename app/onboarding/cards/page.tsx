/**
 * Onboarding card selection page: loads Amex cards + existing user selections,
 * renders a checkbox list, and saves via a server action that inserts/deletes
 * user_cards rows before redirecting to the dashboard.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import SubmitButton from "./submit-button";

type Card = {
  id: string;
  issuer: string;
  brand: string | null;
  card_name: string;
  network: string;
};

type CardsOnboardingPageProps = {
  searchParams?: {
    error?: string;
  };
};

const getErrorMessage = (error?: string) => {
  if (!error) {
    return null;
  }

  if (error === "load") {
    return "We couldn’t load your saved cards. Please try again.";
  }

  if (error === "save") {
    return "We couldn’t save your selections. Please try again.";
  }

  return "Something went wrong. Please try again.";
};

const saveSelections = async (formData: FormData) => {
  "use server";

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const selectedIds = new Set(
    formData.getAll("cardIds").map((value) => String(value))
  );

  const { data: existingSelections, error: existingError } = await supabase
    .from("user_cards")
    .select("card_id")
    .eq("user_id", user.id);

  if (existingError) {
    redirect("/onboarding/cards?error=load");
  }

  const existingIds = new Set(
    (existingSelections ?? []).map((selection) => selection.card_id)
  );

  const idsToInsert = Array.from(selectedIds).filter(
    (cardId) => !existingIds.has(cardId)
  );
  const idsToDelete = Array.from(existingIds).filter(
    (cardId) => !selectedIds.has(cardId)
  );

  if (idsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("user_cards")
      .insert(
        idsToInsert.map((cardId) => ({
          user_id: user.id,
          card_id: cardId,
        })),
        {
          ignoreDuplicates: true,
          onConflict: "user_id,card_id",
        }
      );

    if (insertError) {
      redirect("/onboarding/cards?error=save");
    }
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", user.id)
      .in("card_id", idsToDelete);

    if (deleteError) {
      redirect("/onboarding/cards?error=save");
    }
  }

  redirect("/dashboard");
};

export default async function CardsOnboardingPage({
  searchParams,
}: CardsOnboardingPageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [cardsResult, selectionsResult] = await Promise.all([
    supabase
      .from("cards")
      .select("id, issuer, brand, card_name, network")
      .eq("issuer", "American Express")
      .order("card_name", { ascending: true }),
    supabase.from("user_cards").select("card_id").eq("user_id", user.id),
  ]);

  const cardsError = cardsResult.error;
  const selectionsError = selectionsResult.error;

  const cards = (cardsResult.data ?? []) as Card[];
  const selectedIds = new Set(
    (selectionsResult.data ?? []).map((selection) => selection.card_id)
  );

  const errorMessage = getErrorMessage(searchParams?.error);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Select your cards</h1>
      <p className="text-sm text-gray-600 mt-2">
        Pick the American Express cards you already have so we can personalize
        your dashboard.
      </p>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {cardsError ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          We couldn’t load the card list. Please refresh the page.
        </div>
      ) : null}

      {selectionsError ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          We couldn’t load your saved selections, but you can still choose your
          cards and try saving again.
        </div>
      ) : null}

      <form action={saveSelections} className="mt-8 space-y-6">
        {cards.length === 0 ? (
          <p className="text-sm text-gray-600">
            No American Express cards are available right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {cards.map((card) => (
              <li key={card.id} className="rounded-xl border p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="cardIds"
                    value={card.id}
                    defaultChecked={selectedIds.has(card.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {card.card_name}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {card.issuer}
                      {card.brand ? ` • ${card.brand}` : ""} • {card.network}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <SubmitButton />
      </form>
    </main>
  );
}
