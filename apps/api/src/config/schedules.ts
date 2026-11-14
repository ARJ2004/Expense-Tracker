/**
 * Cron jobs (close the day, morning and evening pushes) run in the API process. Off under tests,
 * where each spec boots its own app, and switchable off with SCHEDULES_ENABLED=false (for a
 * second API instance, say).
 */
export function schedulesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SCHEDULES_ENABLED !== undefined) return env.SCHEDULES_ENABLED === 'true';
  return env.NODE_ENV !== 'test';
}
