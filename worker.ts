import app from 'vinext/server/fetch-handler';

type WorkerEnv = { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string };
type WorkerContext = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };

export default {
  fetch(request: Request, env: WorkerEnv, ctx: WorkerContext) { return app.fetch(request, env, ctx); },
  async scheduled(_controller: unknown, env: WorkerEnv, ctx: WorkerContext) {
    if (!env.CRON_SECRET) throw new Error('CRON_SECRET is required for affiliate maintenance');
    // Dispatch internally through the normal route handler. No secret is sent
    // to a configurable external host and no financial transfer is performed.
    const request = new Request('https://dexlyy.com/api/maintenance/affiliate-events', { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    const response = await app.fetch(request, env, ctx);
    if (!response.ok) throw new Error('Affiliate event maintenance failed');
  },
};
