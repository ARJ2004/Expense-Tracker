/**
 * Home feature tabs: the ARIA tabs pattern (arrow keys, Home/End) plus the design's auto-advance.
 * Auto-advance never starts under reduced motion, stops for good on any interaction, and can be
 * paused (WCAG 2.2.2). Without JavaScript the first tab shows, and every panel is in the HTML.
 */
const INTERVAL_MS = 6000;

export function initFeatureTabs(): void {
  const list = document.querySelector<HTMLElement>('[role="tablist"]');
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls') ?? ''));
  const screen = document.querySelector<HTMLElement>('[data-screen]');
  const pause = list.querySelector<HTMLButtonElement>('[data-pause]');
  const alts = ['Bank SMS alert turned into a transaction in Altus', 'Altus ledger with search and filters', 'Altus daily allowance card showing what you can spend today'];
  let current = 0;
  let timer: number | undefined;

  const select = (i: number, focus = false) => {
    current = (i + tabs.length) % tabs.length;
    tabs.forEach((t, j) => {
      const on = j === current;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[j]?.toggleAttribute('hidden', !on);
    });
    if (screen && alts[current]) screen.setAttribute('aria-label', alts[current]);
    if (focus) tabs[current]?.focus();
  };

  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    list.classList.add('tabs-paused');
    pause?.setAttribute('aria-pressed', 'true');
    if (pause) pause.textContent = 'Paused';
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      stop();
      select(i);
    });
    tab.addEventListener('keydown', (e) => {
      const keys: Record<string, number> = { ArrowDown: current + 1, ArrowRight: current + 1, ArrowUp: current - 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      stop();
      select(keys[e.key] ?? 0, true);
    });
  });
  pause?.addEventListener('click', stop);
  list.addEventListener('focusin', stop);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    timer = window.setInterval(() => select(current + 1), INTERVAL_MS);
    list.addEventListener('mouseenter', stop, { once: true });
  } else {
    list.classList.add('tabs-paused');
  }
}
