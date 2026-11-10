// Lucide icons (https://lucide.dev, ISC licence) used by the outreach and material-signup pages.
// icon(name, cls) returns an <svg> element; the same symbols can be used in static HTML with
// <svg class="ic"><use href="#i-NAME"/></svg>. Add more by pasting an icon's inner SVG shapes below.
const ICON_SHAPES = {
    'bed-double': '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/> <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/> <path d="M12 4v6"/> <path d="M2 18h20"/>',
    'flower-2': '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/> <circle cx="12" cy="8" r="2"/> <path d="M12 10v12"/> <path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/> <path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>',
    'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    'shopping-basket': '<path d="m15 11-1 9"/> <path d="m19 11-4-7"/> <path d="M2 11h20"/> <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/> <path d="M4.5 15.5h15"/> <path d="m5 11 4-7"/> <path d="m9 11 1 9"/>',
    'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/> <circle cx="9" cy="9" r="2"/> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'armchair': '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/> <path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/> <path d="M5 18v2"/> <path d="M19 18v2"/>',
    'speaker': '<rect width="16" height="20" x="4" y="2" rx="2"/> <path d="M12 6h.01"/> <circle cx="12" cy="14" r="4"/> <path d="M12 14h.01"/>',
    'package': '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/> <path d="M12 22V12"/> <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/> <path d="m7.5 4.27 9 5.15"/>',
    'rectangle-horizontal': '<rect width="20" height="12" x="2" y="6" rx="2"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'sun': '<circle cx="12" cy="12" r="4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="m17.66 17.66 1.41 1.41"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.34 17.66-1.41 1.41"/> <path d="m19.07 4.93-1.41 1.41"/>',
    'cloud-sun': '<path d="M12 2v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="M20 12h2"/> <path d="m19.07 4.93-1.41 1.41"/> <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/> <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    'cloud': '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    'cloud-rain': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/> <path d="M16 14v6"/> <path d="M8 14v6"/> <path d="M12 16v6"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/> <path d="m9 12 2 2 4-4"/>',
    'circle-x': '<circle cx="12" cy="12" r="10"/> <path d="m15 9-6 6"/> <path d="m9 9 6 6"/>',
    'hourglass': '<path d="M5 22h14"/> <path d="M5 2h14"/> <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/> <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    'calendar': '<path d="M8 2v4"/> <path d="M16 2v4"/> <rect width="18" height="18" x="3" y="4" rx="2"/> <path d="M3 10h18"/>',
    'smile': '<circle cx="12" cy="12" r="10"/> <path d="M8 14s1.5 2 4 2 4-2 4-2"/> <line x1="9" x2="9.01" y1="9" y2="9"/> <line x1="15" x2="15.01" y1="9" y2="9"/>',
    'meh': '<circle cx="12" cy="12" r="10"/> <line x1="8" x2="16" y1="15" y2="15"/> <line x1="9" x2="9.01" y1="9" y2="9"/> <line x1="15" x2="15.01" y1="9" y2="9"/>',
    'frown': '<circle cx="12" cy="12" r="10"/> <path d="M16 16s-1.5-2-4-2-4 2-4 2"/> <line x1="9" x2="9.01" y1="9" y2="9"/> <line x1="15" x2="15.01" y1="9" y2="9"/>',
    'circle-plus': '<circle cx="12" cy="12" r="10"/> <path d="M8 12h8"/> <path d="M12 8v8"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'target': '<circle cx="12" cy="12" r="10"/> <circle cx="12" cy="12" r="6"/> <circle cx="12" cy="12" r="2"/>',
    'handshake': '<path d="m11 17 2 2a1 1 0 1 0 3-3"/> <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/> <path d="m21 3 1 11h-2"/> <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/> <path d="M3 4h8"/>',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/> <path d="M20 3v4"/> <path d="M22 5h-4"/> <path d="M4 17v2"/> <path d="M5 18H3"/>',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'search': '<circle cx="11" cy="11" r="8"/> <path d="m21 21-4.3-4.3"/>',
    'x': '<path d="M18 6 6 18"/> <path d="m6 6 12 12"/>',
    'repeat': '<path d="m17 2 4 4-4 4"/> <path d="M3 11v-1a4 4 0 0 1 4-4h14"/> <path d="m7 22-4-4 4-4"/> <path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/> <path d="M3 3v5h5"/>',
    'hand-heart': '<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/> <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/> <path d="m2 15 6 6"/> <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'plus': '<path d="M5 12h14"/> <path d="M12 5v14"/>',
    'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/> <path d="M12 9v4"/> <path d="M12 17h.01"/>',
    'heart-handshake': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/> <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/> <path d="m18 15-2-2"/> <path d="m15 18-2-2"/>'
};

(function mountIconSprite() {
    const symbols = Object.keys(ICON_SHAPES)
        .map((n) => `<symbol id="i-${n}" viewBox="0 0 24 24">${ICON_SHAPES[n]}</symbol>`)
        .join('');
    const holder = document.createElement('div');
    holder.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${symbols}</defs></svg>`;
    document.body.prepend(holder.firstChild);
})();

const hasIcon = (name) => Object.prototype.hasOwnProperty.call(ICON_SHAPES, name);

function icon(name, cls) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', cls ? `ic ${cls}` : 'ic');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.appendChild(use);
    return svg;
}
