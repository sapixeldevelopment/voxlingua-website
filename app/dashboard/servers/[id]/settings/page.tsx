import { ServerSettingsApp } from "@/components/dashboard-app";

export default async function ServerSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServerSettingsApp serverId={id} />;
}
