import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PartnerDashboard from "@/components/partner-dashboard";
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Partner Programme', alternates: { canonical: '/partners' } };
export default async function PartnersPage() {
  const { data: auth } = await (await createClient()).auth.getUser();
  return <PartnerDashboard signedIn={Boolean(auth.user)} email={auth.user?.email || ''} />;
}
