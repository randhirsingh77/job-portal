/** Queue abstraction: in-process by default (₹0, no external service needed).
 * If REDIS_URL is set later I can back this with a real queue (Upstash free)
 * without changing callers — jobs are plain async functions either way. */
type JobFn = () => Promise<void>;
const timers: NodeJS.Timeout[] = [];
export function scheduleEvery(name: string, minutes: number, fn: JobFn): void {
  const t = setInterval(() => { fn().catch((e) => console.error(`[job ${name}]`, e)); }, minutes * 60000);
  t.unref(); timers.push(t);
}
export function stopScheduler(): void { for (const t of timers) clearInterval(t); }
