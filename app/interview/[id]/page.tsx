import InterviewApp from "@/components/interview-app";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewApp sessionId={id} />;
}
