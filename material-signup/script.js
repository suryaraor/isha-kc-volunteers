// Satsang material signups. Shared helpers (api, CYCLE, renderCycle, el, show, ...) live in ../common.js
const mstate = {
    active: [],
    items: [], // { key, name, icon, slots }
    signups: [], // { month, key, id, name } for this Satsang month and later
    me: null,
    busy: new Set() // item keys with a save in flight
};

// The next 12 Satsangs, starting with this cycle's: { key: '2026-11', date, short: 'Nov 14', label: "Nov '26" }
const MONTHS_AHEAD = 12;
const UPCOMING = Array.from({ length: MONTHS_AHEAD }, (_, i) => {
    const date = secondSaturday(CYCLE.target.getFullYear(), CYCLE.target.getMonth() + i);
    return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        date,
        month: date.toLocaleDateString(undefined, { month: 'short' }),
        year: String(date.getFullYear()).slice(2),
        day: date.getDate()
    };
});
const monthName = (key) => {
    const u = UPCOMING.find((x) => x.key === key);
    return u ? `${u.month} ${u.day}` : key;
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    renderCycle();
    $('saveUrlBtn').addEventListener('click', () => {
        const url = $('urlInput').value.trim();
        if (!url) return;
        localStorage.setItem('kc_appsScriptUrl', url);
        CONFIG.appsScriptUrl = url;
        show('setupInstructions', false);
        init();
    });
    $('identifySearch').addEventListener('input', renderActive);
    $('notMeBtn').addEventListener('click', () => {
        localStorage.removeItem('kc_meId');
        mstate.me = null;
        showView();
    });
    $('shareBtn').addEventListener('click', shareNeeded);
    $('sheetClose').addEventListener('click', closeSheet);
    $('sheetBackdrop').addEventListener('click', closeSheet);
    $('pickThis').addEventListener('click', () => setPicked([CYCLE.key]));
    $('pickYear').addEventListener('click', () => setPicked(UPCOMING.map((u) => u.key)));
    $('pickNone').addEventListener('click', () => setPicked([]));
    $('sheetSave').addEventListener('click', saveSheet);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSheet();
    });
    // Pick up other people's signups when coming back to the tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && mstate.me && !mstate.busy.size && !sheet.item) refresh();
    });

    show('loadingIndicator', true);
    try {
        const [d] = await Promise.all([api({ action: 'getData' }), loadMaterials()]);
        mstate.active = d.active;
        // Same browser storage as the outreach page, so a name picked there carries over
        const saved = mstate.active.find((a) => a.id === localStorage.getItem('kc_meId'));
        if (saved) mstate.me = { id: saved.id, name: saved.name };
        showView();
    } catch (err) {
        showError(`Failed to load: ${err.message}`);
        show('setupInstructions', true);
    }
    show('loadingIndicator', false);
}

// Each item gets a Lucide icon by its key. To change one, type a Lucide icon name from icons.js
// (e.g. "flower-2") in that item's Icon cell in the Materials tab. An emoji there still works for
// items that have no icon here, and the emoji below go into the WhatsApp share text.
const DEFAULT_ICONS = {
    whitesheets: 'bed-double', flowers: 'flower-2', oil: 'droplet', bin: 'shopping-basket', picture: 'image',
    chair: 'armchair', speaker: 'speaker', yellowbox: 'package', carpets: 'rectangle-horizontal'
};
const SHARE_EMOJI = {
    whitesheets: '🛏️', flowers: '🌸', oil: '🪔', bin: '🧺', picture: '🖼️', chair: '🪑', speaker: '🔊', yellowbox: '📦', carpets: '🟥'
};

function applyMaterials(d) {
    mstate.items = d.items.map((m) => {
        const raw = String(m.icon || '').trim();
        const named = hasIcon(raw) ? raw : '';
        // Carpets used to be saved with the generic box emoji, which is the Yellow box's: ignore that one
        const ownEmoji = !named && raw && !(raw === '📦' && SHARE_EMOJI[m.key]) ? raw : '';
        return { ...m, iconName: named || DEFAULT_ICONS[m.key] || '', emoji: ownEmoji || SHARE_EMOJI[m.key] || '•' };
    });
    // Older backend versions don't send a month; treat those rows as this month
    mstate.signups = d.signups.map((s) => ({ ...s, month: s.month || CYCLE.key }));
}

// An item's icon as an element: its Lucide icon, or its emoji when it has none
function itemIcon(m, cls) {
    return m.iconName ? icon(m.iconName, cls) : el('span', 'emo', m.emoji);
}

async function loadMaterials() {
    applyMaterials(await api({ action: 'getMaterials', month: CYCLE.key }));
}

async function refresh() {
    try {
        await loadMaterials();
        renderMaterials();
    } catch (err) {
        // Quiet: the page still shows the last known state
    }
}

function showView() {
    showError('');
    show('stepMaterials', true);
    show('whoBox', !mstate.me);
    show('meBar', !!mstate.me);
    $('gridTitle').textContent = mstate.me ? 'What will you bring?' : "This month's status";
    $('gridHint').textContent = mstate.me
        ? 'Tap an item, then choose this month, the whole year, or pick months.'
        : 'Type your name above to sign up.';
    $('materialGrid').classList.toggle('readonly', !mstate.me);
    if (mstate.me) $('meName').textContent = mstate.me.name;
    else renderActive();
    renderMaterials();
    renderCounts();
}

// Names only show once something is typed
function renderActive() {
    const q = normalize($('identifySearch').value);
    const list = $('activeList');
    list.replaceChildren();
    const matches = q
        ? mstate.active
            .filter((a) => normalize(a.name).includes(q))
            .sort((a, b) => {
                const as = normalize(a.name).startsWith(q) ? 0 : 1;
                const bs = normalize(b.name).startsWith(q) ? 0 : 1;
                return as - bs || a.name.localeCompare(b.name);
            })
            .slice(0, 8)
        : [];
    matches.forEach((a) => {
        const item = el('button', 'who-item', a.name);
        item.type = 'button';
        item.addEventListener('click', () => {
            mstate.me = { id: a.id, name: a.name };
            localStorage.setItem('kc_meId', a.id);
            $('identifySearch').value = '';
            showView();
        });
        list.appendChild(item);
    });
    show('activeList', matches.length > 0);
    show('noActive', !!q && matches.length === 0);
}

const takenBy = (key, month = CYCLE.key) => mstate.signups.filter((s) => s.key === key && s.month === month);
const isMine = (key, month = CYCLE.key) => takenBy(key, month).some((s) => s.id === mstate.me?.id);
const myMonths = (key) => UPCOMING.map((u) => u.key).filter((m) => isMine(key, m));

function renderCounts() {
    const needed = mstate.items.filter((m) => takenBy(m.key).length < m.slots).length;
    $('neededCount').textContent = mstate.items.length ? needed : '–';
    $('itemCount').textContent = mstate.items.length || '–';
}

function firstName(name) {
    return String(name).split(/\s+/).slice(0, 2).join(' ');
}

// Still-needed items first, then yours, then ones others have covered (sheet order within each group)
function sortedItems() {
    const rank = (m) => (isMine(m.key) ? 1 : takenBy(m.key).length < m.slots ? 0 : 2);
    return mstate.items.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map((x) => x.m);
}

function renderMaterials() {
    const grid = $('materialGrid');
    grid.replaceChildren();
    sortedItems().forEach((m) => {
        const people = takenBy(m.key);
        const mine = isMine(m.key);
        const full = people.length >= m.slots;
        const ahead = myMonths(m.key).filter((k) => k !== CYCLE.key).length;
        const tile = el('button', 'mat');
        tile.type = 'button';
        tile.classList.add(mine ? 'mine' : full ? 'full' : 'open');
        if (mstate.busy.has(m.key)) tile.classList.add('saving');
        tile.setAttribute('aria-pressed', mine);

        const status = mine ? '✓ You' : full ? '✓ Covered' : m.slots > 1 ? `Need ${m.slots - people.length} more` : 'Needed';
        const mi = el('span', 'mat-icon');
        mi.appendChild(itemIcon(m));
        tile.append(mi, el('span', 'mat-name', m.name), el('span', 'mat-status', status));
        // Names under the badge, leaving out "You" when the badge already says it
        const others = people.filter((p) => p.id !== mstate.me?.id).map((p) => firstName(p.name));
        if (others.length) tile.appendChild(el('span', 'mat-who', (mine ? 'Also: ' : '') + others.join(', ')));
        if (ahead) {
            const more = el('span', 'mat-ahead');
            more.append(icon('repeat'), `+${ahead} more month${ahead === 1 ? '' : 's'}`);
            tile.appendChild(more);
        }
        tile.setAttribute('aria-label', `${m.name}: ${status}${others.length ? `, ${others.join(', ')}` : ''}${ahead ? `, plus ${ahead} more months` : ''}`);
        tile.addEventListener('click', () => {
            if (mstate.me) return openSheet(m);
            showToast('Type your name first to sign up.');
            $('identifySearch').scrollIntoView({ behavior: 'smooth', block: 'center' });
            $('identifySearch').focus();
        });
        grid.appendChild(tile);
    });

    const mineItems = mstate.items.filter((m) => isMine(m.key));
    const aheadItems = mstate.items
        .map((m) => ({ m, n: myMonths(m.key).filter((k) => k !== CYCLE.key).length }))
        .filter((x) => x.n);
    const box = $('mySummary');
    box.replaceChildren();
    const addRow = (iconName, label, entries) => {
        const row = el('div', 'sum-row');
        row.append(icon(iconName, 'sum-ic'), el('span', 'sum-label', label));
        entries.forEach(({ m, n }) => {
            const chip = el('span', 'sum-item');
            chip.append(itemIcon(m), el('span', '', n ? `${m.name} ×${n}` : m.name));
            row.appendChild(chip);
        });
        box.appendChild(row);
    };
    if (mineItems.length) addRow('heart-handshake', "This Satsang you're bringing:", mineItems.map((m) => ({ m })));
    if (aheadItems.length) addRow('repeat', 'Coming months:', aheadItems);
    show('mySummary', box.children.length > 0);
    renderCounts();
}

// ---------- Month picker (bottom sheet) ----------
const sheet = { item: null, picked: new Set() };

function openSheet(m) {
    if (mstate.busy.has(m.key)) return;
    sheet.item = m;
    sheet.picked = new Set(myMonths(m.key));
    // First tap on an open item: pre-select this month so one more tap on Save is enough
    if (!sheet.picked.size && takenBy(m.key).length < m.slots) sheet.picked.add(CYCLE.key);
    $('sheetIcon').replaceChildren(itemIcon(m));
    $('sheetTitle').textContent = m.name;
    renderSheet();
    show('sheetBackdrop', true);
    show('monthSheet', true);
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => $('monthSheet').classList.add('up'));
}

function closeSheet() {
    if (!sheet.item) return;
    sheet.item = null;
    $('monthSheet').classList.remove('up');
    show('sheetBackdrop', false);
    show('monthSheet', false);
    document.body.classList.remove('sheet-open');
}

function setPicked(keys) {
    const m = sheet.item;
    // Skip months other people have already filled
    sheet.picked = new Set(keys.filter((k) => isMine(m.key, k) || takenBy(m.key, k).length < m.slots));
    renderSheet();
}

function renderSheet() {
    const m = sheet.item;
    const grid = $('monthGrid');
    grid.replaceChildren();
    UPCOMING.forEach((u) => {
        const people = takenBy(m.key, u.key);
        const mineHere = isMine(m.key, u.key);
        const others = people.filter((p) => p.id !== mstate.me.id);
        const full = !mineHere && people.length >= m.slots;
        const on = sheet.picked.has(u.key);
        const b = el('button', 'mchip');
        b.type = 'button';
        b.disabled = full;
        b.setAttribute('aria-pressed', on);
        if (full) b.classList.add('full');
        if (u.key === CYCLE.key) b.classList.add('now');
        b.append(el('span', 'mchip-mon', `${u.month} ’${u.year}`), el('span', 'mchip-day', `Sat ${u.day}`));
        const note = full ? `✓ ${firstName(others[0].name)}`
            : on ? '✓ You'
                : others.length ? `${others.length}/${m.slots} · ${firstName(others[0].name)}`
                    : u.key === CYCLE.key ? 'This month' : '';
        b.appendChild(el('span', 'mchip-note', note));
        b.setAttribute('aria-label', `${u.month} ${u.day}: ${full ? `covered by ${others.map((p) => p.name).join(', ')}` : on ? 'selected' : 'not selected'}`);
        b.addEventListener('click', () => {
            if (sheet.picked.has(u.key)) sheet.picked.delete(u.key);
            else sheet.picked.add(u.key);
            if (navigator.vibrate) navigator.vibrate(10);
            renderSheet();
        });
        grid.appendChild(b);
    });

    const open = UPCOMING.filter((u) => isMine(m.key, u.key) || takenBy(m.key, u.key).length < m.slots).map((u) => u.key);
    const all = open.length > 0 && open.every((k) => sheet.picked.has(k));
    $('pickThis').classList.toggle('on', sheet.picked.size === 1 && sheet.picked.has(CYCLE.key));
    $('pickYear').classList.toggle('on', all && open.length > 1);
    $('pickThis').disabled = !open.includes(CYCLE.key);

    const { add, remove } = sheetDiff();
    const btn = $('sheetSave');
    btn.disabled = !add.length && !remove.length;
    const n = sheet.picked.size;
    btn.textContent = btn.disabled
        ? (n ? `✓ Signed up for ${n} month${n === 1 ? '' : 's'}` : 'Tap the months you can bring it')
        : !n ? 'Cancel all my months'
            : `Save · ${n} month${n === 1 ? '' : 's'}`;
    btn.classList.toggle('danger', !btn.disabled && !n);
}

function sheetDiff() {
    const had = new Set(myMonths(sheet.item.key));
    return {
        add: [...sheet.picked].filter((k) => !had.has(k)),
        remove: [...had].filter((k) => !sheet.picked.has(k))
    };
}

async function saveSheet() {
    const m = sheet.item;
    const { add, remove } = sheetDiff();
    if (!add.length && !remove.length) return;
    closeSheet();

    // Show the change right away; the server reply replaces it with the real state
    const before = mstate.signups;
    mstate.signups = before
        .filter((s) => !(s.key === m.key && s.id === mstate.me.id && remove.includes(s.month)))
        .concat(add.map((month) => ({ month, key: m.key, id: mstate.me.id, name: mstate.me.name })));
    mstate.busy.add(m.key);
    if (navigator.vibrate) navigator.vibrate(15);
    renderMaterials();

    const msgs = [];
    try {
        if (remove.length) {
            applyMaterials(await api({ action: 'materialCancel', activeId: mstate.me.id, months: remove.join(','), key: m.key }));
            msgs.push(`Cancelled ${remove.length} month${remove.length === 1 ? '' : 's'}`);
        }
        if (add.length) {
            const d = await api({ action: 'materialSignup', activeId: mstate.me.id, months: add.join(','), key: m.key });
            applyMaterials(d);
            const added = d.added ? d.added.length : add.length;
            if (added) msgs.unshift(`Thank you! ${m.name} for ${added === 1 ? monthName(add[0]) : `${added} months`}`);
            (d.full || []).forEach((f) => msgs.push(`${monthName(f.month)} was just taken by ${f.by.join(', ')}`));
        }
        showToast(msgs.join('. ') + '.');
    } catch (err) {
        mstate.signups = before;
        showToast(err.message);
        refresh();
    }
    mstate.busy.delete(m.key);
    renderMaterials();
}

function shareNeeded() {
    const fmt = CYCLE.target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const lines = sortedItems().map((m) => {
        const people = takenBy(m.key);
        const left = m.slots - people.length;
        return left > 0
            ? `${m.emoji} ${m.name}: needed${m.slots > 1 ? ` (${left} more)` : ''}${people.length ? ` – ${people.map((p) => firstName(p.name)).join(', ')}` : ''}`
            : `✅ ${m.name}: ${people.map((p) => firstName(p.name)).join(', ')}`;
    });
    const text = `🪔 Satsang materials for ${fmt}\n\n${lines.join('\n')}\n\nSign up here (one month or the whole year): ${location.href.split('#')[0]}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
