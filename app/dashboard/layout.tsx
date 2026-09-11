import type { Metadata } from "next";
import WorkspaceFrame from "@/components/workspace-frame";

export const metadata: Metadata = {
  title: "Owner Workspace",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceFrame>{children}</WorkspaceFrame>;
}
