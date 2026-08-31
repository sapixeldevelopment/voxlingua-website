import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid, noStoreJson, rejectCrossOrigin } from "@/lib/security";

const SERVER_LOGO_BUCKET = "server-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function storagePathFromPublicUrl(value: string | null) {
  if (!value) return null;
  const marker = `/storage/v1/object/public/${SERVER_LOGO_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return null;
  try {
    return decodeURIComponent(value.slice(markerIndex + marker.length));
  } catch {
    return value.slice(markerIndex + marker.length);
  }
}

async function getOwnedServer(serverId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("servers")
    .select("id,owner_id,logo_url")
    .eq("id", serverId)
    .maybeSingle();
  return data && data.owner_id === userId ? data : null;
}

async function getAuthenticatedOwner(serverId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { userId: null, server: null };
  return { userId: auth.user.id, server: await getOwnedServer(serverId, auth.user.id) };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const { userId, server } = await getAuthenticatedOwner(id);
  if (!userId) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!server) return noStoreJson({ error: "Only the portal owner can change the server logo." }, { status: 403 });

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGO_BYTES + 200_000) {
    return noStoreJson({ error: "Your server logo must be smaller than 2 MB." }, { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return noStoreJson({ error: "Choose a logo image to upload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return noStoreJson({ error: "Please choose a PNG, JPG, WEBP, or GIF image." }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) return noStoreJson({ error: "Your server logo must be smaller than 2 MB." }, { status: 413 });

  const admin = createAdminClient();
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(SERVER_LOGO_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return noStoreJson({ error: "The server logo could not be uploaded." }, { status: 500 });

  const publicUrl = admin.storage.from(SERVER_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: serverError } = await admin
    .from("servers")
    .update({ logo_url: publicUrl })
    .eq("id", id)
    .eq("owner_id", userId);
  if (serverError) {
    await admin.storage.from(SERVER_LOGO_BUCKET).remove([path]);
    return noStoreJson({ error: "The server logo could not be saved." }, { status: 500 });
  }

  const previousPath = storagePathFromPublicUrl(server.logo_url);
  if (previousPath && previousPath !== path) {
    await admin.storage.from(SERVER_LOGO_BUCKET).remove([previousPath]);
  }
  return noStoreJson({ ok: true, publicUrl });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Portal not found." }, { status: 404 });

  const { userId, server } = await getAuthenticatedOwner(id);
  if (!userId) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!server) return noStoreJson({ error: "Only the portal owner can change the server logo." }, { status: 403 });

  const admin = createAdminClient();
  const { error: serverError } = await admin
    .from("servers")
    .update({ logo_url: null })
    .eq("id", id)
    .eq("owner_id", userId);
  if (serverError) return noStoreJson({ error: "The server logo could not be removed." }, { status: 500 });

  const previousPath = storagePathFromPublicUrl(server.logo_url);
  if (previousPath) await admin.storage.from(SERVER_LOGO_BUCKET).remove([previousPath]);
  return noStoreJson({ ok: true });
}
