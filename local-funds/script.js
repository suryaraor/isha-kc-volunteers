// Configuration: set appsScriptUrl here, or paste it in the setup screen (saved in localStorage)
const CONFIG = {
    appsScriptUrl: localStorage.getItem('kcf_appsScriptUrl') || 'https://script.google.com/macros/s/AKfycbyzjP-56A6MGOuc4nntuXzl9RflhmkyumP6EYP6oXCaO00NH4s-s0RD7ONl5aWxYHU9/exec'
};

const TYPE_HINTS = {
    Donation: 'Money a volunteer gave. "Received by" is the person now holding it.',
    Expense: 'Money spent on an initiative. "Paid by" is the holder the money came from.',
    Handover: 'Cash passed from one holder to another (no money in or out).'
};

let state = {
    transactions: [],
    initiatives: [],
    view: 'donors',
    type: 'Donation',
    pin: localStorage.getItem('kcf_pin') || '',
    openDonor: null
};
let jsonpCounter = 0;

const $ = (id) => document.getElementById(id);
const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keyOf = (name) => String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');

function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
        const cb = `kcfJsonpCb_${Date.now()}_${jsonpCounter++}`;
        const script = document.createElement('script');
        const cleanup = () => {
            delete window[cb];
            script.remove();
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Request timed out'));
        }, 20000);
        window[cb] = (data) => {
            clearTimeout(timer);
            cleanup();
            resolve(data);
        };
        script.onerror = () => {
            clearTimeout(timer);
            cleanup();
            reject(new Error('Unable to reach Apps Script endpoint'));
        };
        script.src = `${CONFIG.appsScriptUrl}?${new URLSearchParams({ ...params, callback: cb })}`;
        document.body.appendChild(script);
    });
}

async function api(params) {
    const data = await jsonpRequest(params);
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data;
}

function show(id, on) {
    $(id).style.display = on ? '' : 'none';
}

function showError(msg) {
    $('errorMessage').textContent = msg;
    show('errorMessage', !!msg);
}

let toastTimer;
function showToast(msg) {
    $('toast').textContent = msg;
    show('toast', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show('toast', false), 5000);
}

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    if (!y) return s;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', init);

function init() {
    $('saveUrlBtn').addEventListener('click', () => {
        const url = $('urlInput').value.trim();
        if (!url) return;
        localStorage.setItem('kcf_appsScriptUrl', url);
        CONFIG.appsScriptUrl = url;
        show('setupInstructions', false);
        load();
    });
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
        location.hash = t.dataset.view;
    }));
    window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
    $('ledgerSearch').addEventListener('input', renderLedger);
    $('pinBtn').addEventListener('click', unlock);
    $('pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
    $('lockBtn').addEventListener('click', () => {
        state.pin = '';
        localStorage.removeItem('kcf_pin');
        renderAdd();
        renderLedger();
    });
    document.querySelectorAll('#typeSeg button').forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));
    $('txForm').addEventListener('submit', saveEntry);
    $('fDate').value = today();
    setType('Donation');

    setView(location.hash.slice(1));
    load();
}

async function load() {
    if (!CONFIG.appsScriptUrl) {
        show('loadingIndicator', false);
        show('setupInstructions', true);
        return;
    }
    show('loadingIndicator', true);
    try {
        const d = await api({ action: 'getData' });
        state.transactions = d.transactions;
        state.initiatives = d.initiatives;
        showError('');
        renderAll();
    } catch (err) {
        showError(`Failed to load data: ${err.message}`);
        show('setupInstructions', true);
    }
    show('loadingIndicator', false);
}

function setView(v) {
    state.view = ['donors', 'balance', 'add'].includes(v) ? v : 'donors';
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === state.view));
    document.querySelectorAll('.view').forEach((s) => show(s.id, s.id === `view-${state.view}`));
}

// ---------- Calculations ----------
function live() {
    return state.transactions.filter((t) => !t.voided);
}

function summarize() {
    const txs = live();
    const donors = new Map();
    const holders = new Map();
    const display = new Map(); // first-seen spelling of each name
    const name = (n) => {
        const k = keyOf(n);
        if (!display.has(k)) display.set(k, n.trim());
        return k;
    };
    const adjust = (n, amt) => {
        const k = name(n);
        holders.set(k, (holders.get(k) || 0) + amt);
    };
    let received = 0;
    let spent = 0;

    txs.forEach((t) => {
        if (t.type === 'Donation') {
            received += t.amount;
            const k = name(t.from);
            const d = donors.get(k) || { total: 0, gifts: [] };
            d.total += t.amount;
            d.gifts.push(t);
            donors.set(k, d);
            adjust(t.to, t.amount);
        } else if (t.type === 'Expense') {
            spent += t.amount;
            adjust(t.from, -t.amount);
        } else if (t.type === 'Handover') {
            adjust(t.from, -t.amount);
            adjust(t.to, t.amount);
        }
    });

    return {
        received,
        spent,
        balance: received - spent,
        donors: [...donors].map(([k, d]) => ({ name: display.get(k), ...d }))
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
        holders: [...holders].map(([k, amt]) => ({ name: display.get(k), amount: Math.round(amt * 100) / 100 }))
            .filter((h) => h.amount !== 0)
            .sort((a, b) => b.amount - a.amount),
        people: [...display.values()].sort((a, b) => a.localeCompare(b))
    };
}

// ---------- Render ----------
function renderAll() {
    const s = summarize();
    $('headerBalance').textContent = money(s.balance);
    renderDonors(s);
    renderBalance(s);
    renderLedger();
    renderAdd(s);
}

function renderDonors(s) {
    $('donTotal').textContent = money(s.received);
    $('donCount').textContent = s.donors.length;
    const list = $('donorList');
    list.replaceChildren();
    s.donors.forEach((d) => {
        const item = el('div', 'result-item');
        const last = d.gifts.map((g) => g.date).sort().pop();
        item.append(
            el('span', 'name', d.name),
            el('span', 'amount', money(d.total)),
            el('span', 'sub', `${d.gifts.length} contribution${d.gifts.length === 1 ? '' : 's'} · last ${fmtDate(last)}`)
        );
        if (state.openDonor === d.name) {
            const details = el('div', 'details');
            [...d.gifts].sort((a, b) => b.date.localeCompare(a.date)).forEach((g) => {
                const row = el('div');
                row.append(el('span', '', `${fmtDate(g.date)} · to ${g.to}${g.note ? ` · ${g.note}` : ''}`), el('span', '', money(g.amount)));
                details.appendChild(row);
            });
            item.appendChild(details);
        }
        item.addEventListener('click', () => {
            state.openDonor = state.openDonor === d.name ? null : d.name;
            renderDonors(summarize());
        });
        list.appendChild(item);
    });
    show('noDonors', s.donors.length === 0);
}

function renderBalance(s) {
    $('balIn').textContent = money(s.received);
    $('balOut').textContent = money(s.spent);
    $('balNow').textContent = money(s.balance);

    const holders = $('holderList');
    holders.replaceChildren();
    s.holders.forEach((h) => {
        const item = el('div', 'result-item static');
        item.append(el('span', 'name', h.name), el('span', 'amount' + (h.amount < 0 ? ' neg' : ''), money(h.amount)));
        if (h.amount < 0) item.appendChild(el('span', 'sub', 'Paid more than they held; owed a reimbursement.'));
        holders.appendChild(item);
    });
    show('noHolders', s.holders.length === 0);

    // Initiatives from the sheet, plus any initiative names used only in expenses
    const byName = new Map(state.initiatives.map((i) => [keyOf(i.name), { ...i, spent: 0, qty: 0, count: 0 }]));
    live().filter((t) => t.type === 'Expense').forEach((t) => {
        const k = keyOf(t.initiative);
        if (!byName.has(k)) byName.set(k, { name: t.initiative, unit: '', unitCost: 0, notes: '', spent: 0, qty: 0, count: 0 });
        const i = byName.get(k);
        i.spent += t.amount;
        i.qty += t.qty;
        i.count++;
    });

    const cards = $('initiativeList');
    cards.replaceChildren();
    byName.forEach((i) => {
        const card = el('div', 'card');
        card.appendChild(el('h3', '', i.name));
        if (i.notes) card.appendChild(el('p', 'notes', i.notes));
        const figs = el('div', 'figures');
        const fig = (label, value) => {
            const span = el('span', '', `${label} `);
            span.appendChild(el('strong', '', value));
            figs.appendChild(span);
        };
        fig('Spent', money(i.spent));
        if (i.qty) fig('Bought', `${i.qty} ${i.unit || 'units'}`);
        else fig('Purchases', String(i.count));
        if (i.unitCost) {
            fig('Cost', `${money(i.unitCost)} / ${i.unit || 'unit'}`);
            fig('Balance covers', `${Math.max(0, Math.floor(s.balance / i.unitCost))} ${i.unit || 'units'}`);
        }
        card.appendChild(figs);
        cards.appendChild(card);
    });
}

function describe(t) {
    if (t.type === 'Donation') return `${t.from} → ${t.to}`;
    if (t.type === 'Expense') return `${t.initiative}${t.qty ? ` (${t.qty})` : ''} · paid by ${t.from}`;
    return `${t.from} → ${t.to}`;
}

function renderLedger() {
    const q = keyOf($('ledgerSearch').value);
    const list = $('ledgerList');
    list.replaceChildren();
    const rows = [...state.transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .filter((t) => keyOf([t.type, t.from, t.to, t.initiative, t.note].join(' ')).includes(q));
    $('ledgerCount').textContent = live().length;
    rows.forEach((t) => {
        const item = el('div', 'result-item static' + (t.voided ? ' voided' : ''));
        const sign = t.type === 'Expense' ? ' neg' : '';
        item.append(
            el('span', `badge ${t.type}`, t.type),
            el('span', 'name', describe(t)),
            el('span', 'amount' + sign, (t.type === 'Expense' ? '-' : '') + money(t.amount)),
            el('span', 'sub', `${fmtDate(t.date)}${t.note ? ` · ${t.note}` : ''}${t.voided ? ' · voided' : ''}`)
        );
        if (state.pin) {
            const btn = el('button', 'link-btn' + (t.voided ? '' : ' danger'), t.voided ? 'Restore' : 'Void');
            btn.addEventListener('click', () => toggleVoid(t, btn));
            item.appendChild(btn);
        }
        list.appendChild(item);
    });
    show('noLedger', rows.length === 0);
}

// ---------- Add entry ----------
function renderAdd(s = summarize()) {
    show('pinBox', !state.pin);
    show('txForm', !!state.pin);
    const people = $('peopleList');
    people.replaceChildren(...s.people.map((p) => {
        const o = el('option');
        o.value = p;
        return o;
    }));
    const sel = $('fInitiative');
    const current = sel.value;
    sel.replaceChildren(...state.initiatives.map((i) => {
        const o = el('option', '', i.name);
        o.value = i.name;
        return o;
    }));
    if (current) sel.value = current;
}

async function unlock() {
    const pin = $('pinInput').value.trim();
    if (!pin) return;
    $('pinBtn').disabled = true;
    try {
        await api({ action: 'checkPin', pin });
        state.pin = pin;
        localStorage.setItem('kcf_pin', pin);
        $('pinInput').value = '';
        showError('');
        renderAdd();
        renderLedger();
    } catch (err) {
        showError(err.message);
    }
    $('pinBtn').disabled = false;
}

function setType(type) {
    state.type = type;
    document.querySelectorAll('#typeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
    $('typeHint').textContent = TYPE_HINTS[type];
    $('fFromLabel').textContent = { Donation: 'Donor', Expense: 'Paid by (holder)', Handover: 'From (holder)' }[type];
    $('fToLabel').textContent = type === 'Donation' ? 'Received by' : 'To (new holder)';
    show('fToWrap', type !== 'Expense');
    show('fExpenseWrap', type === 'Expense');
    $('fTo').required = type !== 'Expense';
    $('fInitiative').required = type === 'Expense';
}

async function saveEntry(e) {
    e.preventDefault();
    const btn = $('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    showError('');
    const entry = {
        type: state.type,
        date: $('fDate').value,
        amount: $('fAmount').value,
        from: $('fFrom').value.trim(),
        to: state.type === 'Expense' ? '' : $('fTo').value.trim(),
        initiative: state.type === 'Expense' ? $('fInitiative').value : '',
        qty: state.type === 'Expense' ? $('fQty').value : '',
        note: $('fNote').value.trim()
    };
    try {
        await api({ action: 'add', pin: state.pin, ...entry });
        showToast(`${entry.type} of ${money(Number(entry.amount))} saved.`);
        ['fAmount', 'fFrom', 'fTo', 'fQty', 'fNote'].forEach((id) => { $(id).value = ''; });
        await load();
    } catch (err) {
        if (err.message === 'Wrong PIN') {
            state.pin = '';
            localStorage.removeItem('kcf_pin');
            renderAdd();
        }
        showError(err.message);
    }
    btn.disabled = false;
    btn.textContent = 'Save entry';
}

async function toggleVoid(t, btn) {
    btn.disabled = true;
    try {
        await api({ action: t.voided ? 'unvoid' : 'void', pin: state.pin, id: t.id });
        showToast(t.voided ? 'Entry restored.' : 'Entry voided. It stays in the history but no longer counts.');
        await load();
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
    }
}
