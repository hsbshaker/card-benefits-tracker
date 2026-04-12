import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const duplicate = params.duplicate;
  const query = typeof duplicate === "string" ? `?duplicate=${encodeURIComponent(duplicate)}` : "";

  redirect(`/dashboard${query}`);
}
