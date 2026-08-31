import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedDiscordConnection } from "@/lib/discord-connection";
import { consumeRateLimit, isUuid, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`staff-invite:${auth.user.id}`, 20, 3600))) {
    return noStoreJson({ error: "Too many invite requests. Please wait before creating another code." }, { status: 429 });
  }

  const body = await readJsonBody<{ serverId?: string; role?: string }>(request, 2_048);
  const role = body?.role === "reviewer" ? "reviewer" : body?.role === "admin" ? "admin" : null;
  if (!body || !isUuid(body.serverId) || !role) return noStoreJson({ error: "Choose a server and staff role." }, { status: 400 });

  const { data: server, error: serverError } = await supabase
    .from("servers")
    .select("id,staff_role_id")
    .eq("id", body.serverId)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (serverError) return noStoreJson({ error: "The portal could not be checked." }, { status: 500 });
  if (!server) return noStoreJson({ error: "Portal not found." }, { status: 404 });
  const connection = await getVerifiedDiscordConnection(server.id);
  if (!connection || !server.staff_role_id) {
    return noStoreJson({ error: "Configure the Discord server ID and staff role ID before inviting staff." }, { status: 422 });
  }

  const code = randomBytes(6).toString("hex").toUpperCase();
  const codeHash = createHash("sha256").update(code).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_staff_invite", {
    p_server_id: body.serverId,
    p_code_hash: codeHash,
    p_owner_id: auth.user.id,
    p_role: role,
  });
  if (error) return noStoreJson({ error: error.message }, { status: 400 });
  const invite = Array.isArray(data) ? data[0] : data;
  return noStoreJson({ ok: true, code, role, expiresAt: invite?.expires_at || null });
}
