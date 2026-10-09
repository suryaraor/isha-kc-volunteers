// Configuration: set appsScriptUrl here, or paste it in the setup screen (saved in localStorage)
const CONFIG = {
    appsScriptUrl: localStorage.getItem('kc_appsScriptUrl') || 'https://script.google.com/macros/s/AKfycbxNfMjzkjDfbZxZsMWRXwkYTBc_zSjaYltNhRf8eC4MOFRnnX4065ACyxiqIlj26cSRug/exec'
};

let state = {
    active: [],
    available: [],
    mine: [],
    me: null, // { id, name }
    selected: new Set()
};
let jsonpCounter = 0;

const $ = (id) => document.getElementById(id);

function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
        const cb = `kcJsonpCb_${Date.now()}_${jsonpCounter++}`;
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

function normalize(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function show(id, on) {
    $(id).style.display = on ? '' : 'none';
}

function showError(msg) {
    const el = $('errorMessage');
    el.textContent = msg;
    show('errorMessage', !!msg);
}

let toastTimer;
function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    show('toast', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show('toast', false), 5000);
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', init);

async function init() {
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
        showView();
    });
    $('assignBtn').addEventListener('click', assignSelected);

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
    const d = await api({ action: 'getMine', activeId: state.me.id });
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
    const matches = state.active.filter((a) => normalize(a.name).includes(q));
    matches.forEach((a) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = a.name;
        item.appendChild(name);
        if (a.count) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = `${a.count} picked`;
            item.appendChild(badge);
        }
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

// ---------- Step 2 ----------
function renderMine() {
    const list = $('mineList');
    list.replaceChildren();
    $('mineCount').textContent = state.mine.length;
    state.mine.forEach((v) => {
        const item = document.createElement('div');
        item.className = 'result-item mine';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = v.name;
        const btn = document.createElement('button');
        btn.className = 'link-btn danger';
        btn.textContent = 'Remove';
        btn.addEventListener('click', () => releaseOne(v, btn));
        item.append(name, btn);
        list.appendChild(item);
    });
    show('noMine', state.mine.length === 0);
}

function renderAvailable() {
    const q = normalize($('pickSearch').value);
    const list = $('availList');
    list.replaceChildren();
    $('availCount').textContent = state.available.length;
    const matches = state.available.filter((v) => normalize(v.name).includes(q));
    matches.forEach((v) => {
        const item = document.createElement('label');
        item.className = 'result-item selectable' + (state.selected.has(v.id) ? ' selected' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.selected.has(v.id);
        cb.addEventListener('change', () => {
            if (cb.checked) state.selected.add(v.id);
            else state.selected.delete(v.id);
            item.classList.toggle('selected', cb.checked);
            updateAssignBtn();
        });
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = v.name;
        item.append(cb, name);
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
        let msg = `${r.claimed.length} volunteer${r.claimed.length === 1 ? '' : 's'} assigned to you.`;
        if (r.taken.length) {
            msg += ` ${r.taken.length} already taken by someone else: ${r.taken.map((t) => t.name).join(', ')}.`;
        }
        showToast(msg);
        await Promise.all([loadData(), loadMine()]);
        renderMine();
        renderAvailable();
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
        await Promise.all([loadData(), loadMine()]);
        renderMine();
        renderAvailable();
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
    }
}
