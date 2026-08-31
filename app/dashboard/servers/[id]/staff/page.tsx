import StaffManagementApp from "@/components/staff-management";

export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffManagementApp serverId={id} />;
}
