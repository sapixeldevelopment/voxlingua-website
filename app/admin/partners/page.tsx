import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPlatformStaff } from '@/lib/platform-staff';
import { AdminAccessDenied } from '@/components/admin-support-dashboard';
import AdminPartners from '@/components/admin-partners';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Partner Operations', robots: { index: false, follow: false } };
export default async function AdminPartnersPage() {
  const { data: auth } = await (await createClient()).auth.getUser();
  if (!auth.user) redirect('/login?next=/admin/partners');
  if ((await getPlatformStaff(auth.user.id))?.role !== 'admin') return <AdminAccessDenied userId={auth.user.id} email={auth.user.email || 'Discord account'} />;
  return <AdminPartners />;
}
