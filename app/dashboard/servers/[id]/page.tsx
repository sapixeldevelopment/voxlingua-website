import ServerWorkspaceApp from "@/components/server-workspace";

export default async function ServerWorkspacePage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <ServerWorkspaceApp serverId={id} />;
}
