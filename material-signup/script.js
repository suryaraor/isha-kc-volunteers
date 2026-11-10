// Satsang material signups. Shared helpers (api, CYCLE, renderCycle, el, show, ...) live in ../common.js
const mstate = {
    active: [],
    items: [], // { key, name, icon, slots }
    signups: [], // { key, id, name } for this Satsang month
    me: null,
    busy: new Set() // item keys with a save in flight
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
    // Pick up other people's signups when coming back to the tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && mstate.me && !mstate.busy.size) refresh();
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

function applyMaterials(d) {
    mstate.items = d.items;
    mstate.signups = d.signups;
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
    show('stepIdentify', !mstate.me);
    show('stepMaterials', !!mstate.me);
    if (mstate.me) {
        $('meName').textContent = mstate.me.name;
        renderMaterials();
    } else {
        renderActive();
    }
    renderCounts();
}

function renderActive() {
    const q = normalize($('identifySearch').value);
    const list = $('activeList');
    list.replaceChildren();
    const matches = mstate.active
        .filter((a) => normalize(a.name).includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));
    matches.forEach((a) => {
        const item = el('div', 'result-item');
        item.appendChild(el('span', 'name', a.name));
        item.addEventListener('click', () => {
            mstate.me = { id: a.id, name: a.name };
            localStorage.setItem('kc_meId', a.id);
            showView();
        });
        list.appendChild(item);
    });
    show('noActive', matches.length === 0);
}

const takenBy = (key) => mstate.signups.filter((s) => s.key === key);
const isMine = (key) => takenBy(key).some((s) => s.id === mstate.me?.id);

function renderCounts() {
    const needed = mstate.items.filter((m) => takenBy(m.key).length < m.slots).length;
    $('neededCount').textContent = mstate.items.length ? needed : '–';
    $('itemCount').textContent = mstate.items.length || '–';
}

function renderMaterials() {
    const grid = $('materialGrid');
    grid.replaceChildren();
    mstate.items.forEach((m) => {
        const people = takenBy(m.key);
        const mine = isMine(m.key);
        const full = people.length >= m.slots;
        const tile = el('button', 'mat');
        tile.type = 'button';
        tile.classList.add(mine ? 'mine' : full ? 'full' : 'open');
        if (mstate.busy.has(m.key)) tile.classList.add('saving');
        tile.setAttribute('aria-pressed', mine);

        const status = mine ? '✓ You' : full ? '✓ Covered' : m.slots > 1 ? `Need ${m.slots - people.length} more` : 'Needed';
        tile.append(el('span', 'mat-icon', m.icon), el('span', 'mat-name', m.name), el('span', 'mat-status', status));
        if (people.length) {
            const who = el('span', 'mat-who', people.map((p) => (p.id === mstate.me?.id ? 'You' : firstName(p.name))).join(', '));
            tile.appendChild(who);
        }
        tile.addEventListener('click', () => toggle(m));
        grid.appendChild(tile);
    });

    const mineItems = mstate.items.filter((m) => isMine(m.key));
    $('mySummary').textContent = mineItems.length
        ? `🙏 You're bringing: ${mineItems.map((m) => `${m.icon} ${m.name}`).join(', ')}`
        : '';
    show('mySummary', mineItems.length > 0);
    renderCounts();
}

function firstName(name) {
    return String(name).split(/\s+/).slice(0, 2).join(' ');
}

async function toggle(m) {
    if (mstate.busy.has(m.key)) return;
    const mine = isMine(m.key);
    const people = takenBy(m.key);
    if (!mine && people.length >= m.slots) {
        showToast(`${m.icon} ${m.name} is already covered by ${people.map((p) => p.name).join(', ')}. 🙏`);
        return;
    }

    // Show the change right away; the server reply replaces it with the real state
    const before = mstate.signups;
    mstate.signups = mine
        ? before.filter((s) => !(s.key === m.key && s.id === mstate.me.id))
        : before.concat({ key: m.key, id: mstate.me.id, name: mstate.me.name });
    mstate.busy.add(m.key);
    if (navigator.vibrate) navigator.vibrate(15);
    renderMaterials();

    try {
        const d = await api(mine
            ? { action: 'materialCancel', activeId: mstate.me.id, month: CYCLE.key, key: m.key }
            : { action: 'materialSignup', activeId: mstate.me.id, month: CYCLE.key, satsang: CYCLE.targetYmd, key: m.key });
        applyMaterials(d);
        showToast(mine ? `Cancelled ${m.icon} ${m.name}.` : `🙏 Thank you! You're bringing ${m.icon} ${m.name}.`);
    } catch (err) {
        mstate.signups = before;
        showToast(`⚠️ ${err.message}`);
        refresh();
    }
    mstate.busy.delete(m.key);
    renderMaterials();
}

function shareNeeded() {
    const fmt = CYCLE.target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const lines = mstate.items.map((m) => {
        const people = takenBy(m.key);
        const left = m.slots - people.length;
        return left > 0
            ? `${m.icon} ${m.name}: needed${m.slots > 1 ? ` (${left} more)` : ''}${people.length ? ` – ${people.map((p) => firstName(p.name)).join(', ')}` : ''}`
            : `✅ ${m.name}: ${people.map((p) => firstName(p.name)).join(', ')}`;
    });
    const text = `🪔 Satsang materials for ${fmt}\n\n${lines.join('\n')}\n\nSign up here: ${location.href.split('#')[0]}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
