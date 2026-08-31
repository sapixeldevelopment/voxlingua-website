import { cleanupAllApplicationHistory } from "@/lib/application-retention";
import { validCronAuthorization } from "@/lib/cron-auth";
import { noStoreJson } from "@/lib/security";

export async function GET(request: Request) {
  if (!validCronAuthorization(request)) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await cleanupAllApplicationHistory();
    return noStoreJson({ ok: true, ...result });
  } catch (error) {
    console.error("Application retention cleanup failed", error);
    return noStoreJson({ error: "Application retention cleanup failed." }, { status: 500 });
  }
}
