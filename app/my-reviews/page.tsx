import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MyReviewsPage } from "@/components/reviews/my-reviews-page";

export const instant = false;

export default async function MyReviewsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/my-reviews");
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <MyReviewsPage />
    </main>
  );
}

