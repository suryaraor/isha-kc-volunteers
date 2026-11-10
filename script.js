// Outreach page. Shared helpers (api, CYCLE, renderCycle, el, show, ...) live in common.js
let state = {
    active: [],
    available: [],
    mine: [],
    me: null, // { id, name }
    selected: new Set(),
    open: new Set(), // volunteer cards the user has expanded
    addOpen: false
};

// Monthly check-in questions. Values must match STATUS_FIELDS in apps-script.js.
const QUESTIONS = [
    { key: 'reached', icon: 'handshake', title: 'Reached them?', options: [
        { value: 'Call', icon: 'phone', label: 'Call' },
        { value: 'WhatsApp', icon: 'message-circle', label: 'WhatsApp' },
        { value: 'Text', icon: 'message-square', label: 'Text' }
    ] },
    { key: 'shambhavi', icon: 'sparkles', title: 'Their Shambhavi?', options: [
        { value: 'Daily', icon: 'sun', label: 'Daily' },
        { value: '3-5 times', icon: 'cloud-sun', label: '3-5 times' },
        { value: 'Once', icon: 'cloud', label: 'Once' },
        { value: 'Lost in touch', icon: 'cloud-rain', label: 'Lost touch' }
    ] },
    { key: 'satsang', icon: 'flame', title: 'Coming for Satsang?', options: [
        { value: 'Yes, I will be there', icon: 'circle-check', label: "I'll be there" },
        { value: 'Not this time', icon: 'circle-x', label: 'Not this time' },
        { value: 'Maybe in next 3 months', icon: 'hourglass', label: 'In 3 months' },
        { value: 'Maybe in next 6 months', icon: 'calendar', label: 'In 6 months' }
    ] },
    { key: 'personal', icon: 'heart', title: 'Personal life?', options: [
        { value: 'Doing great', icon: 'smile', label: 'Doing great' },
        { value: 'Going fine', icon: 'meh', label: 'Going fine' },
        { value: 'Struggling', icon: 'frown', label: 'Struggling' }
    ] }
];

// ---------- Init ----------
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
    $('pickSearch').addEventListener('input', renderAvailable);
    $('notMeBtn').addEventListener('click', () => {
        localStorage.removeItem('kc_meId');
        state.me = null;
        state.selected.clear();
        state.open.clear();
        setAddOpen(false);
        showView();
    });
    $('assignBtn').addEventListener('click', assignSelected);
    $('toggleAddBtn').addEventListener('click', () => setAddOpen(!state.addOpen));

    if (!CONFIG.appsScriptUrl) {
        show('loadingIndicator', false);
        show('setupInstructions', true);
        return;
    }

    show('loadingIndicator', true);
    try {
        await loadData();
        const savedId = localStorage.getItem('kc_meId');
        const saved = state.active.find((a) => a.id === savedId);
        if (saved) await chooseMe(saved);
        else showView();
    } catch (err) {
        showError(`Failed to load data: ${err.message}`);
        show('setupInstructions', true);
    }
    show('loadingIndicator', false);
}

async function loadData() {
    const d = await api({ action: 'getData' });
    state.active = d.active;
    state.available = d.available;
    $('assignedCount').textContent = d.assignedInactive;
    $('totalCount').textContent = d.totalInactive;
    // Drop selections that someone else grabbed in the meantime
    const ids = new Set(state.available.map((v) => v.id));
    state.selected = new Set([...state.selected].filter((id) => ids.has(id)));
}

async function loadMine() {
    const d = await api({ action: 'getMine', activeId: state.me.id, month: CYCLE.key });
    state.mine = d.mine;
}

function showView() {
    showError('');
    show('stepIdentify', !state.me);
    show('stepPick', !!state.me);
    if (state.me) {
        $('meName').textContent = state.me.name;
        renderMine();
        renderAvailable();
    } else {
        renderActive();
    }
}

// ---------- Step 1 ----------
function renderActive() {
    const q = normalize($('identifySearch').value);
    const list = $('activeList');
    list.replaceChildren();
    const matches = state.active
        .filter((a) => normalize(a.name).includes(q))
        .sort((a, b) => (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name));
    matches.forEach((a) => {
        const item = el('div', 'result-item');
        item.appendChild(el('span', 'name', a.name));
        if (a.count) item.appendChild(el('span', 'badge', `${a.count} picked`));
        item.addEventListener('click', () => chooseMe(a));
        list.appendChild(item);
    });
    show('noActive', matches.length === 0);
}

async function chooseMe(a) {
    show('loadingIndicator', true);
    try {
        state.me = { id: a.id, name: a.name };
        localStorage.setItem('kc_meId', a.id);
        await loadMine();
        showView();
    } catch (err) {
        state.me = null;
        showError(err.message);
    }
    show('loadingIndicator', false);
}

// ---------- Step 2: your volunteers ----------
// wa.me wants the full international number as digits only; assume US (+1) for bare 10-digit numbers
function whatsappNumber(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return '1' + digits;
    return digits.length >= 11 ? digits : '';
}

// Volunteers not yet reached this month come first; reached ones sink to the bottom.
// Array.sort is stable, so each group keeps its original order.
const isReached = (v) => !!(v.status && v.status.reached);
const byReached = (a, b) => isReached(a) - isReached(b);

function renderMine() {
    const list = $('mineList');
    list.replaceChildren();
    $('mineCount').textContent = state.mine.length;
    [...state.mine].sort(byReached).forEach((v) => list.appendChild(volunteerCard(v)));
    show('noMine', state.mine.length === 0);
}

// Re-order the existing cards in place (keeps which ones are open) once a card is closed,
// so a card never jumps away while you are still answering its questions
function reorderMine() {
    const list = $('mineList');
    [...state.mine].sort(byReached).forEach((v) => v.card && list.appendChild(v.card));
}

function volunteerCard(v) {
    v.status = v.status || {};
    const card = el('details', 'vcard');
    v.card = card;
    card.open = state.open.has(v.id);
    card.addEventListener('toggle', () => {
        if (card.open) state.open.add(v.id);
        else {
            state.open.delete(v.id);
            reorderMine();
        }
    });

    // Collapsed row: name plus one icon per question showing this month's answer
    const summary = el('summary', 'vcard-head');
    const info = el('div', 'info');
    info.appendChild(el('span', 'name', v.name));
    const done = el('div', 'done-icons');
    const chev = el('span', 'chev');
    chev.appendChild(icon('chevron-right'));
    summary.append(info, done, chev);
    card.appendChild(summary);

    const body = el('div', 'vcard-body');
    const wa = whatsappNumber(v.phone);
    if (wa) {
        const digits = '+' + wa;
        const contact = el('div', 'contact');
        [['phone', 'Call', `tel:${digits}`], ['message-circle', 'WhatsApp', `https://wa.me/${wa}`], ['message-square', 'Text', `sms:${digits}`]]
            .forEach(([iconName, label, href]) => {
                const a = el('a', 'contact-btn');
                a.href = href;
                if (href.startsWith('http')) {
                    a.target = '_blank';
                    a.rel = 'noopener';
                }
                const ci = el('span', 'ci');
                ci.appendChild(icon(iconName));
                a.append(ci, el('span', '', label));
                contact.appendChild(a);
            });
        body.append(el('div', 'phone-line', v.phone), contact);
    }

    QUESTIONS.forEach((q) => {
        const block = el('div', 'q');
        const title = el('div', 'q-title');
        title.append(icon(q.icon), el('span', '', q.title));
        block.appendChild(title);
        const grid = el('div', `opts n${q.options.length}`);
        q.options.forEach((o) => {
            const b = el('button', 'opt');
            b.type = 'button';
            b.setAttribute('aria-pressed', v.status[q.key] === o.value);
            const oi = el('span', 'opt-icon');
            oi.appendChild(icon(o.icon));
            b.append(oi, el('span', 'opt-label', o.label));
            b.addEventListener('click', () => saveAnswer(v, q, o.value, grid, refreshDone));
            grid.appendChild(b);
        });
        block.appendChild(grid);
        body.appendChild(block);
    });

    const foot = el('div', 'vcard-foot');
    const rm = el('button', 'link-btn danger', 'Remove from my list');
    rm.addEventListener('click', () => {
        if (confirmRemove(rm)) releaseOne(v, rm);
    });
    foot.appendChild(rm);
    body.appendChild(foot);
    card.appendChild(body);

    function refreshDone() {
        done.replaceChildren();
        QUESTIONS.forEach((q) => {
            const opt = q.options.find((o) => o.value === v.status[q.key]);
            const dot = el('span', opt ? 'di on' : 'di');
            if (opt) dot.appendChild(icon(opt.icon));
            dot.title = `${q.title} ${opt ? opt.label : 'not yet'}`;
            done.appendChild(dot);
        });
        card.classList.toggle('complete', QUESTIONS.every((q) => v.status[q.key]));
    }
    refreshDone();
    return card;
}

// Two-tap remove (no browser confirm dialog): first tap arms, second tap within 4s removes
function confirmRemove(btn) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = '1';
    btn.textContent = 'Tap again to remove';
    setTimeout(() => {
        delete btn.dataset.armed;
        btn.textContent = 'Remove from my list';
    }, 4000);
    return false;
}

// Update the UI instantly, then sync; a later tap simply overwrites this month's answer
async function saveAnswer(v, q, value, grid, refreshDone) {
    const prev = v.status[q.key];
    const paint = () => {
        [...grid.children].forEach((b, i) => b.setAttribute('aria-pressed', q.options[i].value === v.status[q.key]));
        refreshDone();
    };
    v.status[q.key] = value;
    paint();
    if (navigator.vibrate) navigator.vibrate(15);
    grid.classList.remove('saved');
    grid.classList.add('saving');
    try {
        await api({
            action: 'setStatus', activeId: state.me.id, id: v.id,
            month: CYCLE.key, satsang: CYCLE.targetYmd, field: q.key, value
        });
        if (v.status[q.key] === value) {
            grid.classList.remove('saving');
            grid.classList.add('saved');
            setTimeout(() => grid.classList.remove('saved'), 1200);
        }
    } catch (err) {
        if (v.status[q.key] === value) {
            v.status[q.key] = prev;
            paint();
            grid.classList.remove('saving');
        }
        showToast(`Couldn't save for ${v.name}: ${err.message}`);
    }
}

// ---------- Step 2: add volunteers ----------
function setAddOpen(on) {
    state.addOpen = on;
    show('addPanel', on);
    $('toggleAddBtn').setAttribute('aria-expanded', on);
    $('toggleAddBtn').classList.toggle('open', on);
    if (on) {
        renderAvailable();
        $('toggleAddBtn').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderAvailable() {
    const q = normalize($('pickSearch').value);
    const list = $('availList');
    list.replaceChildren();
    $('availCount').textContent = state.available.length;
    const matches = state.available.filter((v) => normalize(v.name).includes(q));
    matches.forEach((v) => {
        const item = el('label', 'result-item selectable' + (state.selected.has(v.id) ? ' selected' : ''));
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.selected.has(v.id);
        cb.addEventListener('change', () => {
            if (cb.checked) state.selected.add(v.id);
            else state.selected.delete(v.id);
            item.classList.toggle('selected', cb.checked);
            updateAssignBtn();
        });
        item.append(cb, el('span', 'name', v.name));
        list.appendChild(item);
    });
    show('noAvail', matches.length === 0);
    updateAssignBtn();
}

function updateAssignBtn() {
    const n = state.selected.size;
    const btn = $('assignBtn');
    btn.disabled = n === 0;
    btn.textContent = n ? `Assign ${n} selected to me` : 'Assign selected to me';
}

async function assignSelected() {
    const ids = [...state.selected];
    if (!ids.length) return;
    $('assignBtn').disabled = true;
    $('assignBtn').textContent = 'Saving...';
    showError('');
    try {
        const r = await api({ action: 'claim', activeId: state.me.id, ids: ids.join(',') });
        state.selected.clear();
        r.claimed.forEach((c) => state.open.add(c.id));
        let msg = `${r.claimed.length} volunteer${r.claimed.length === 1 ? '' : 's'} assigned to you.`;
        if (r.taken.length) {
            msg += ` ${r.taken.length} already taken by someone else: ${r.taken.map((t) => t.name).join(', ')}.`;
        }
        showToast(msg);
        await Promise.all([loadData(), loadMine()]);
        setAddOpen(false);
        renderMine();
        renderAvailable();
        $('mineList').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        showError(err.message);
        updateAssignBtn();
    }
}

async function releaseOne(v, btn) {
    btn.disabled = true;
    try {
        await api({ action: 'release', activeId: state.me.id, ids: v.id });
        showToast(`${v.name} is available again.`);
        state.open.delete(v.id);
        await Promise.all([loadData(), loadMine()]);
        renderMine();
        renderAvailable();
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
    }
}
