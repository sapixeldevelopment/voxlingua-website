import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupServerApplicationHistory } from "@/lib/application-retention";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { consumeRateLimit, isSafeSlug, noStoreJson } from "@/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSafeSlug(slug)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(`portal:${forwardedFor}`, 180, 60))) {
    return noStoreJson({ error: "Too many portal requests. Please try again shortly." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: server, error: serverError } = await admin
    .from("servers")
    .select("id,owner_id,name,slug,logo_url,welcome_message,is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (serverError || !server?.is_active) {
    return noStoreJson({ error: "This portal is unavailable." }, { status: 404 });
  }
  const connection = await getVerifiedDiscordConnection(server.id);

  const { data: billing } = await admin
    .from("owner_billing")
    .select("status,subscription_period_end")
    .eq("user_id", server.owner_id)
    .maybeSingle();
  const paidThrough = billing?.subscription_period_end ? new Date(`${billing.subscription_period_end}T00:00:00Z`) : null;
  const accessible = billing?.status === "active" || (billing?.status === "suspended" && paidThrough !== null && paidThrough > new Date());
  if (!accessible) return noStoreJson({ error: "This portal is unavailable." }, { status: 404 });

  if (await consumeRateLimit(`application-retention:${server.id}`, 1, 86_400)) {
    try {
      await cleanupServerApplicationHistory(server.id);
    } catch (error) {
      console.error("Automatic application retention cleanup failed", { serverId: server.id, error });
    }
  }

  const { data: fields, error: fieldsError } = await admin
    .from("application_fields")
    .select("id,server_id,field_key,label,description,field_type,placeholder,options,is_required,is_active,order_index")
    .eq("server_id", server.id)
    .eq("is_active", true)
    .order("order_index");
  if (fieldsError) return noStoreJson({ error: "The application form could not be loaded." }, { status: 500 });

  return noStoreJson({
    server: {
      id: server.id,
      name: server.name,
      slug: server.slug,
      logo_url: server.logo_url,
      welcome_message: server.welcome_message,
      is_active: true,
      discord_configured: Boolean(connection?.guild_id),
    },
    fields: fields || [],
  });
}
