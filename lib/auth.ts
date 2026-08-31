export const discordAuthEnabled =
  process.env.NEXT_PUBLIC_DISCORD_AUTH_ENABLED === "true";

export function friendlyAuthError(message: string) {
  if (message.toLowerCase().includes("provider is not enabled")) {
    return "Discord sign-in is not enabled for this Dexlyy project yet. Enable Discord under Supabase → Authentication → Providers, then reload this page.";
  }

  return message;
}
