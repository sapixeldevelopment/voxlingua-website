import app from 'vinext/server/fetch-handler';

type WorkerEnv = { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string };
type WorkerContext = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };
type ScheduledController = { cron: string };

export default {
  fetch(request: Request, env: WorkerEnv, ctx: WorkerContext) { return app.fetch(request, env, ctx); },
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: WorkerContext) {
    if (!env.CRON_SECRET) throw new Error('CRON_SECRET is required for scheduled maintenance');
    // Dispatch internally through the normal route handler. No secret is sent
    // to a configurable external host and no financial transfer is performed.
    const maintenancePath = controller.cron === '17 3 * * *'
      ? '/api/maintenance/application-retention'
      : '/api/maintenance/affiliate-events';
    const request = new Request(`https://dexlyy.com${maintenancePath}`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    const jobs = [app.fetch(request, env, ctx)];
    if (controller.cron !== '17 3 * * *') jobs.push(app.fetch(new Request('https://dexlyy.com/api/maintenance/service-notifications', {headers: {Authorization: `Bearer ${env.CRON_SECRET}`}}), env, ctx));
    const results = await Promise.allSettled(jobs);
    if (results.some(result => result.status === 'rejected' || !result.value.ok)) throw new Error('Scheduled maintenance failed');
  },
};
