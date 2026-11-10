// Shared by the outreach page (index.html) and material-signup/.
// Both talk to the same Apps Script web app and the same Google Sheet.
const CONFIG = {
    appsScriptUrl: localStorage.getItem('kc_appsScriptUrl') || 'https://script.google.com/macros/s/AKfycbxNfMjzkjDfbZxZsMWRXwkYTBc_zSjaYltNhRf8eC4MOFRnnX4065ACyxiqIlj26cSRug/exec'
};
let jsonpCounter = 0;

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function show(id, on) {
    $(id).style.display = on ? '' : 'none';
}

function normalize(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function showError(msg) {
    const e = $('errorMessage');
    e.textContent = msg;
    show('errorMessage', !!msg);
}

let toastTimer;
function showToast(msg) {
    const e = $('toast');
    e.textContent = msg;
    show('toast', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show('toast', false), 5000);
}

// ---------- API (JSONP so the static page works from GitHub Pages without CORS) ----------
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

// ---------- Satsang month ----------
// Satsang is on the 2nd Saturday. A "month" runs from the Sunday after one Satsang
// through the next Satsang, and is named after the month its Satsang falls in.
function secondSaturday(year, month) {
    const first = new Date(year, month, 1);
    const firstSat = 1 + ((6 - first.getDay() + 7) % 7);
    return new Date(year, month, firstSat + 7);
}

function satsangCycle(now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let target = secondSaturday(today.getFullYear(), today.getMonth());
    if (today > target) target = secondSaturday(today.getFullYear(), today.getMonth() + 1);
    const prev = secondSaturday(target.getFullYear(), target.getMonth() - 1);
    const start = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
    const DAY = 86400000;
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
        key: ymd(target).slice(0, 7),
        targetYmd: ymd(target),
        target,
        start,
        total: Math.round((target - prev) / DAY),
        daysLeft: Math.round((target - today) / DAY),
        label: target.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    };
}

const CYCLE = satsangCycle();

// Fills the countdown block (cycleMonth, cycleTarget, cycleDays, ... ids) present on both pages
function renderCycle() {
    const c = CYCLE;
    const fmt = (d, o) => d.toLocaleDateString(undefined, o);
    $('cycleMonth').textContent = c.label;
    $('cycleTarget').textContent = fmt(c.target, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    $('cycleDays').textContent = c.daysLeft;
    $('cycleDaysLabel').textContent = c.daysLeft === 0 ? 'Satsang today' : (c.daysLeft === 1 ? 'day left' : 'days left');
    const pct = Math.min(100, Math.max(0, ((c.total - c.daysLeft) / c.total) * 100));
    $('cycleFill').style.width = `${pct}%`;
    $('cycleProgress').setAttribute('aria-valuenow', Math.round(pct));
    $('cycleStart').textContent = `Started ${fmt(c.start, { month: 'short', day: 'numeric' })}`;
    $('cycleEnd').textContent = `Satsang ${fmt(c.target, { month: 'short', day: 'numeric' })}`;
}
