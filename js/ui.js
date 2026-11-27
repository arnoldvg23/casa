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
  sofa: line('<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3"/><path d="M2 13a2 2 0 0 1 4 0v1h12v-1a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/><path d="M5 18v2M19 18v2"/>'),
  gift: line('<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8v12M12 8c-1.5-3-5-4-5.5-2S9 8 12 8Zm0 0c1.5-3 5-4 5.5-2S15 8 12 8Z"/>'),
  tree: line('<path d="M12 3 6.5 10H9l-4 5.5h4.5L6 20h12l-3.5-4.5H19L15 10h2.5L12 3Z"/><path d="M12 20v1.5"/>'),
  link: line('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  wallet: line('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z"/><circle cx="16" cy="13.5" r="1.2"/>'),
  cart: line('<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6"/>'),
};

const TOAST_MS = 5000;
let toastTimer;

// `sticky`: es queda fins que es toca (per a avisos que no es poden perdre).
export function toast(message, action, { sticky = false } = {}) {
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
  if (!sticky) toastTimer = setTimeout(() => { el.hidden = true; }, TOAST_MS);
}
