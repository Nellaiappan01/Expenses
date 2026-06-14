import { redirect } from "next/navigation";
import { resolveDefaultPublicUserSlug } from "@/lib/publicStock";

export default async function PublicStockRedirectPage() {
  const slug = await resolveDefaultPublicUserSlug();
  if (!slug) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Stock view unavailable</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Open your shop link as <span className="font-semibold text-slate-700">/username/view</span>{" "}
          using your godown login username.
        </p>
      </div>
    );
  }

  redirect(`/${encodeURIComponent(slug)}/view`);
}
