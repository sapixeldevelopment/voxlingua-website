import { noStoreJson } from "@/lib/security";

export async function POST() {
  return noStoreJson(
    { error: "This endpoint has moved. Submit application decisions through the review workspace." },
    { status: 410 },
  );
}
