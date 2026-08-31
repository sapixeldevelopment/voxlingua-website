import ApplicationReview from "@/components/application-review";

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationReview applicationId={id} />;
}
