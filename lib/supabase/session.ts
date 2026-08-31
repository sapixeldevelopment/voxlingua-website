export const REMEMBER_ME_COOKIE = "dexlyy-remember";
export const REMEMBER_ME_MAX_AGE = 400 * 24 * 60 * 60;

export function rememberMeEnabled(value?: string | null) {
  return value !== "0";
}
