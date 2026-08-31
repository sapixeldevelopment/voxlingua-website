import "server-only";

type DiscordAuthUser = {
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown> | null;
  }>;
};

export type DiscordIdentity = {
  id: string;
  username: string | null;
};

export function discordIdentity(user: DiscordAuthUser): DiscordIdentity | null {
  const identity = user.identities?.find((item) => item.provider === "discord");
  const data = identity?.identity_data;
  if (!data) return null;

  const rawId = data.provider_id || data.sub || data.user_id;
  if (typeof rawId !== "string" || !/^\d{15,25}$/.test(rawId)) return null;

  const rawName = data.user_name || data.preferred_username || data.name || data.full_name;
  return {
    id: rawId,
    username: typeof rawName === "string" ? rawName.slice(0, 100) : null,
  };
}

export function isDiscordSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{15,25}$/.test(value);
}

export async function getDiscordGuildMember(guildId: string, userId: string) {
  if (!process.env.DISCORD_BOT_TOKEN) return { configured: false, response: null as Response | null };
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    cache: "no-store",
  });
  return { configured: true, response };
}

export async function getDiscordGuild(guildId: string) {
  if (!process.env.DISCORD_BOT_TOKEN) return { configured: false, response: null as Response | null };
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    cache: "no-store",
  });
  return { configured: true, response };
}

export async function discordMemberCanManageGuild(
  guildId: string,
  userId: string,
  ownerId: string | null,
  memberResponse: Response | null,
) {
  if (ownerId === userId) return true;
  if (!memberResponse?.ok || !process.env.DISCORD_BOT_TOKEN) return false;

  const member = await memberResponse.json().catch(() => null) as { roles?: unknown } | null;
  const memberRoleIds = new Set(
    [guildId, ...(Array.isArray(member?.roles) ? member.roles : [])]
      .filter((roleId): roleId is string => typeof roleId === "string"),
  );
  const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    cache: "no-store",
  });
  if (!rolesResponse.ok) return false;
  const roles = await rolesResponse.json().catch(() => null) as Array<{ id?: unknown; permissions?: unknown }> | null;
  if (!Array.isArray(roles)) return false;

  for (const role of roles) {
    if (!memberRoleIds.has(typeof role.id === "string" ? role.id : "") || typeof role.permissions !== "string") continue;
    const permissions = Number(role.permissions);
    if (!Number.isSafeInteger(permissions)) return false;
    const hasAdministrator = Math.floor(permissions / 8) % 2 === 1;
    const hasManageGuild = Math.floor(permissions / 32) % 2 === 1;
    if (hasAdministrator || hasManageGuild) return true;
  }
  return false;
}

export async function discordGuildMemberRoles(response: Response | null) {
  if (!response?.ok) return [];

  const member = await response.json().catch(() => null) as { roles?: unknown } | null;
  if (!Array.isArray(member?.roles)) return [];

  return member.roles.filter((role): role is string => typeof role === "string");
}
