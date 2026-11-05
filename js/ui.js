const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const line = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  plus: line('<path d="M12 5v14M5 12h14"/>'),
  check: line('<path d="m5.5 12.5 4 4L18.5 7.5"/>'),
  close: line('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  chevron: line('<path d="m9 6 6 6-6 6"/>'),
  settings: line('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  invite: line('<path d="M15 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 2 18.5V20"/><circle cx="8.5" cy="7.5" r="3.5"/><path d="M19 8v6M16 11h6"/>'),
  basket: line('<path d="M3 10h18l-1.6 8.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 10Z"/><path d="m8 10 3-6M16 10l-3-6M9 14v2.5M12 14v2.5M15 14v2.5"/>'),
  cart: line('<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6"/>'),
};

const TOAST_MS = 5000;
let toastTimer;

export function toast(message, action) {
  const el = document.getElementById('toast');
  el.textContent = message;
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      el.hidden = true;
      action.run();
    });
    el.append(button);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, TOAST_MS);
}
