import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicStockView } from "@/app/view/components/PublicStockView";
import { resolveUserByPublicSlug } from "@/lib/publicStock";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await resolveUserByPublicSlug(username);
  if (!user) {
    return { title: "Shop not found" };
  }
  return {
    title: `${user.name} · Stock View`,
    description: "Real-time tyre stock status",
  };
}

export default async function UserPublicStockPage({ params }: Props) {
  const { username } = await params;
  const user = await resolveUserByPublicSlug(username);
  if (!user) notFound();

  return <PublicStockView publicUser={user.username} />;
}
