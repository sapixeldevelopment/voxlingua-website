export const STAFF_JOIN_PATH = "/staff/join";
const PENDING_INVITE_KEY = "dexlyy:pending-staff-invite";
const PENDING_INVITE_TTL_MS = 60 * 60 * 1000;

export function normalizeStaffInviteCode(value: string) {
  const code = value.replace(/\s/g, "").toUpperCase();
  return /^[A-F0-9]{12}$/.test(code) ? code : "";
}

export function staffJoinUrl(origin: string, code?: string) {
  const url = new URL(STAFF_JOIN_PATH, origin);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid site address.");
  if (code) {
    const normalized = normalizeStaffInviteCode(code);
    if (!normalized) throw new Error("Invalid invite code.");
    // Fragments are not sent to the web server or in HTTP referrer headers.
    url.hash = new URLSearchParams({ invite: normalized }).toString();
  }
  return url.toString();
}

export function staffInviteMessage(options: { serverName: string; role: string; discordRole: string; url: string }) {
  const role = options.role === "admin" ? "an administrator" : "a reviewer";
  return `You're invited to help manage ${options.serverName} on Dexlyy as ${role}.\n\n${options.url}\n\n1. Open this link — your invite code is filled in for you.\n2. Sign in with the Discord account you use in our server.\n3. Select Join portal team, then Open portal workspace.\n\nYou must already be in our Discord server and have the ${options.discordRole} role. This link is private and can be used by one person only. If you cannot join, ask me to check your Discord role or send a fresh invite.`;
}

// Keep the code in this tab across the existing OAuth redirect; do not add it
// to the provider callback URL, put it in localStorage, or log it.
export function rememberStaffInvite(code: string) {
  try {
    const normalized = normalizeStaffInviteCode(code);
    if (normalized) sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ code: normalized, savedAt: Date.now() }));
    else sessionStorage.removeItem(PENDING_INVITE_KEY);
    return true;
  } catch { return false; }
}

export function recallStaffInvite() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_INVITE_KEY) || "null") as { code?: unknown; savedAt?: unknown } | null;
    if (typeof saved?.code === "string" && typeof saved.savedAt === "number"
      && Date.now() - saved.savedAt >= 0 && Date.now() - saved.savedAt < PENDING_INVITE_TTL_MS) {
      return normalizeStaffInviteCode(saved.code);
    }
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch { /* Manual code entry still works if browser storage is blocked. */ }
  return "";
}
