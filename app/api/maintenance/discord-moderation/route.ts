import { validCronAuthorization } from "@/lib/cron-auth";
import { syncAllDiscordModeration } from "@/lib/discord-moderation";
import { noStoreJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!validCronAuthorization(request)) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await syncAllDiscordModeration();
    return noStoreJson({ ok: true, results });
  } catch (error) {
    console.error("Discord moderation sync failed", error);
    return noStoreJson({ error: "Discord moderation history could not be synchronized." }, { status: 500 });
  }
}
