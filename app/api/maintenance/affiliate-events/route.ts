import { retryAffiliateEvents } from "@/lib/affiliate-payments";
import { validCronAuthorization } from "@/lib/cron-auth";
import { noStoreJson } from "@/lib/security";
export async function GET(request: Request) {
  if (!validCronAuthorization(request)) return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  try { return noStoreJson(await retryAffiliateEvents()); }
  catch { return noStoreJson({ error: "Affiliate retry queue unavailable." }, { status: 503 }); }
}
