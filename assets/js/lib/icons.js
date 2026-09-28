// Game + UI icons. Each is a 24×24 stroke/fill SVG body (static, trusted markup).
// To add an icon for a new benchmark, add an entry here and reference its key
// from the benchmark's `icon` field.

const ICONS = {
  knight: `<path fill="currentColor" d="M8.2 21h9.6c.5 0 .8-.4.8-.8v-.6c0-.4-.3-.8-.8-.8H8.2c-.4 0-.8.4-.8.8v.6c0 .4.4.8.8.8Zm1-3.4h8.1c.3-2.9-.1-5.9-1.2-8.2-.9-2-2.4-3.6-4.3-4.6l-.5-1.6c-.1-.4-.6-.5-.9-.2L9.3 4.2 7.6 6.9 5.3 10.3c-.3.5-.3 1.1.1 1.5l.6.7c.4.4 1 .5 1.5.2l2.2-1.3c.4-.2.9-.3 1.3-.2l.6.2c-1.3 1.5-2.2 3.3-2.4 5.4v.8Zm1.2-10.5c.4 0 .8.3.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8Z"/>`,
  castle: `<path fill="currentColor" d="M4 21h16v-1.5H4V21Zm1-2.5h14V10l-1.8-1.3V5h-2.4v2H13.4V3.5L12 2.6l-1.4.9V7H8.2V5H5.8v3.7L4 10v8.5h1Zm5.5 0v-3.3c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5v3.3h-3Zm-3-7.3h2v2h-2v-2Zm7 0h2v2h-2v-2Z"/>`,
  cards: `<path fill="currentColor" d="M6.5 4.2 13.3 2.4c.8-.2 1.6.3 1.8 1.1l3.6 13.5c.2.8-.3 1.6-1.1 1.8l-6.8 1.8c-.8.2-1.6-.3-1.8-1.1L5.4 6c-.2-.8.3-1.6 1.1-1.8Zm4.6 5.1-1.3 2.9 2.9 1.4 1.3-2.9-2.9-1.4Z"/>`,
  dice: `<path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>`,
  go: `<circle cx="8" cy="8" r="3.2" fill="currentColor"/><circle cx="16" cy="16" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="1" opacity=".5"/>`,
  controller: `<path fill="currentColor" d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.4 2.4 0 0 1-4.1 1.2L14.5 16h-5L7 18.2A2.4 2.4 0 0 1 2.9 17l-.8-4A5 5 0 0 1 7 7Zm0 3v1.3H5.7v1.4H7V14h1.4v-1.3h1.3v-1.4H8.4V10H7Zm9.5.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>`,
  plus: `<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  sun: `<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  moon: `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
  grid: `<path fill="currentColor" d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" opacity=".9"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
};

export function icon(name, cls = "icon") {
  const body = ICONS[name] || ICONS.controller;
  const span = document.createElement("span");
  span.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  return span.firstChild;
}
