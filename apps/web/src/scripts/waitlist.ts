/**
 * The iPhone waitlist form posts to /v1/waitlist on the same origin. It works without JavaScript
 * (the API sends the browser back to /download?waitlist=ok); this swaps in the success message
 * without a reload.
 */
export function initWaitlist(): void {
  const form = document.querySelector<HTMLFormElement>('form[data-waitlist]');
  const done = document.querySelector<HTMLElement>('[data-waitlist-done]');
  const error = form?.querySelector<HTMLElement>('[data-waitlist-error]');
  if (!form || !done) return;

  const showDone = () => {
    form.hidden = true;
    done.hidden = false;
  };
  if (new URLSearchParams(window.location.search).get('waitlist') === 'ok') showDone();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    if (button) button.disabled = true;
    if (error) error.hidden = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return showDone();
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      const message = res.status === 429 ? 'Too many tries. Please wait a minute and try again.' : body?.error?.message ?? 'Something went wrong. Please try again.';
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
    } catch {
      if (error) {
        error.textContent = 'You seem to be offline. Please try again.';
        error.hidden = false;
      }
    } finally {
      if (button) button.disabled = false;
    }
  });
}
