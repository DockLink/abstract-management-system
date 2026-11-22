import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MyReviewsPage } from "@/components/reviews/my-reviews-page";

export const instant = false;

export default async function MyReviewsRoute() {
  // Auth lookups read the clock; render at request time.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/my-reviews");
  }

  return (
    <main id="main-content" className="min-h-dvh bg-surface">
      <MyReviewsPage />
    </main>
  );
}

