/**
 * Work features need done while the session is still valid, just before sign-out (stop pushes to
 * this phone). Lives in lib so auth can run it without importing the features that register.
 */
type Hook = () => Promise<void>;
const hooks = new Set<Hook>();

export function onBeforeSignOut(hook: Hook): () => void {
  hooks.add(hook);
  return () => hooks.delete(hook);
}

/** Runs every hook, best effort and briefly: signing out must work offline too. */
export async function runBeforeSignOut(): Promise<void> {
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3_000));
  await Promise.race([Promise.allSettled([...hooks].map((h) => h())), timeout]);
}
