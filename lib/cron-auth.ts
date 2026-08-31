import "server-only";

import { timingSafeEqual } from "node:crypto";

export function validCronAuthorization(request: Request) {
  const configured = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configured || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return configuredBuffer.length === suppliedBuffer.length
    && timingSafeEqual(configuredBuffer, suppliedBuffer);
}
