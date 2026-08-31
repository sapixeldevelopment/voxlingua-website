import type { Metadata } from "next";
import PortalApp from "@/components/portal-app";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: server } = await admin
    .from("servers")
    .select("name,slug,owner_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const { data: billing } = server
    ? await admin.from("owner_billing").select("status,subscription_period_end").eq("user_id", server.owner_id).maybeSingle()
    : { data: null };
  const paidThrough = billing?.subscription_period_end ? new Date(`${billing.subscription_period_end}T00:00:00Z`) : null;
  const accessible = billing?.status === "active" || (billing?.status === "suspended" && paidThrough !== null && paidThrough > new Date());

  if (!server || !accessible) {
    return {
      title: "Portal unavailable",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${server.name} Player Application`,
    description: `Apply to ${server.name} through its secure Dexlyy player portal and complete your voice interview when you are ready.`,
    alternates: { canonical: `/portal/${server.slug}` },
    openGraph: {
      title: `${server.name} Player Application`,
      description: `Apply to ${server.name} and complete your structured voice interview through Dexlyy.`,
      url: `/portal/${server.slug}`,
    },
  };
}

export default async function PortalPage({ params }: Props) {
  const { slug } = await params;
  return <PortalApp slug={slug} />;
}
