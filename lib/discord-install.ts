// Discord application IDs are public. The env override lets a future bot
// rotation use the same UI without exposing a secret to the browser.
const DISCORD_BOT_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID || "1542897675995844650";

// Manage Roles (1 << 28) is required for whitelist/additional role assignment.
// View Audit Log (1 << 7) is required for moderation-history sync.
const DISCORD_BOT_PERMISSIONS = String((1 << 28) + (1 << 7));

export function getDiscordBotInstallUrl() {
  if (!DISCORD_BOT_CLIENT_ID) return "";

  const params = new URLSearchParams({
    client_id: DISCORD_BOT_CLIENT_ID,
    permissions: DISCORD_BOT_PERMISSIONS,
    integration_type: "0",
    scope: "bot",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
