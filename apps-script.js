// Google Apps Script backend for Isha KC Volunteer Assignment
// Open the Google Sheet > Extensions > Apps Script > paste this file > Deploy as Web app
// (Execute as: Me, Who has access: Anyone). The sheet needs a tab named "Volunteers".

const SHEET_NAME = 'Volunteers';
const STATUS_SHEET = 'Status'; // created automatically on first status save

// Monthly check-in questions. Keys are what the page sends; values are the allowed answers.
const STATUS_FIELDS = {
  reached: { header: 'Reached', values: ['Call', 'WhatsApp', 'Text'] },
  shambhavi: { header: 'Shambhavi', values: ['Daily', '3-5 times', 'Once', 'Lost in touch'] },
  satsang: { header: 'Coming for Satsang', values: ['Not this time', 'Yes, I will be there', 'Maybe in next 3 months', 'Maybe in next 6 months'] },
  personal: { header: 'Personal Life', values: ['Doing great', 'Going fine', 'Struggling'] }
};
const STATUS_HEADERS = ['Month', 'Satsang Date', 'Volunteer ID', 'Volunteer Name', 'Assigned To ID', 'Assigned To']
  .concat(Object.keys(STATUS_FIELDS).map(k => STATUS_FIELDS[k].header), ['Updated At']);

// Satsang material signups (material-signup/ page). Both tabs are created automatically.
// Edit the Materials tab to rename items, change icons, set how many people each needs,
// or set Active to "no" to hide one. Keep the Key column unchanged once people sign up.
const MATERIALS_SHEET = 'Materials';
const MATERIAL_SIGNUPS_SHEET = 'Material Signups';
const MATERIALS_HEADERS = ['Key', 'Item', 'Icon', 'People Needed', 'Active', 'Details'];
const MATERIALS_SEED = [
  ['whitesheets', 'White sheets', '🛏️', 1, 'yes', ''],
  ['flowers', 'Flowers', '🌸', 1, 'yes', ''],
  ['oil', 'Oil', '🪔', 1, 'yes', ''],
  ['bin', 'Satsang bin', '🧺', 1, 'yes', ''],
  ['picture', 'Sadhguru picture', '🖼️', 1, 'yes', ''],
  ['chair', 'Sadhguru chair', '🪑', 1, 'yes', ''],
  ['speaker', 'Speaker', '🔊', 1, 'yes', ''],
  ['yellowbox', 'Yellow box', '📦', 1, 'yes', ''],
  ['projector', 'Projector and screen', '📽️', 1, 'yes', ''],
  ['flowervase', 'Flower vase', '🏺', 1, 'yes', ''],
  ['paper', 'Paper material', '📋', 1, 'yes', 'Clipboard, white sheets, Miracle of Mind app, IE flyers'],
  ['smallbasket', 'Small basket', '🧺', 1, 'yes', '']
];
const MATERIAL_SIGNUP_HEADERS = ['Month', 'Satsang Date', 'Item Key', 'Item', 'Volunteer ID', 'Volunteer Name', 'Signed Up At'];

function doGet(e) {
  const p = e.parameter || {};
  let result;
  try {
    switch (p.action) {
      case 'getData':
        result = getData();
        break;
      case 'getMine':
        result = getMine(p.activeId, p.month);
        break;
      case 'setStatus':
        result = withLock(() => setStatus(p.activeId, p.month, p.satsang, p.id, p.field, p.value));
        break;
      case 'getMaterials':
        result = getMaterials(p.month);
        break;
      case 'materialSignup':
        result = withLock(() => materialSignup(p.activeId, splitIds(p.months || p.month), p.key));
        break;
      case 'materialCancel':
        result = withLock(() => materialCancel(p.activeId, splitIds(p.months || p.month), p.key));
        break;
      case 'claim':
        result = withLock(() => claim(p.activeId, splitIds(p.ids)));
        break;
      case 'release':
        result = withLock(() => release(p.activeId, splitIds(p.ids)));
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: String(err) };
  }

  // JSONP so the static page works from GitHub Pages / any host without CORS issues
  if (p.callback) {
    return ContentService.createTextOutput(`${p.callback}(${JSON.stringify(result)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function splitIds(s) {
  return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
}

// Serialize writes so two active volunteers can never claim the same person
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
}

function readSheet() {
  const sheet = spreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet tab '${SHEET_NAME}' not found`);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const col = name => {
    const i = headers.indexOf(name.toLowerCase());
    if (i === -1) throw new Error(`Missing column '${name}'`);
    return i;
  };
  const c = {
    id: col('ID'),
    name: col('Name'),
    phone: headers.indexOf('phone'),
    active: col('Active Volunteer'),
    toId: col('Assigned To ID'),
    to: col('Assigned To'),
    at: col('Assigned At')
  };
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const name = String(r[c.name] || '').trim();
    if (!name) continue;
    rows.push({
      row: i + 1,
      id: String(r[c.id]).trim(),
      name: name,
      phone: c.phone === -1 ? '' : String(r[c.phone] || '').trim(),
      active: String(r[c.active]).trim().toLowerCase() === 'yes',
      assignedToId: String(r[c.toId] || '').trim()
    });
  }
  return { sheet, c, rows };
}

// Public lists: names only (phone numbers are never sent to the browser)
function getData() {
  const { rows } = readSheet();
  const counts = {};
  rows.forEach(r => {
    if (!r.active && r.assignedToId) counts[r.assignedToId] = (counts[r.assignedToId] || 0) + 1;
  });
  const active = rows.filter(r => r.active)
    .map(r => ({ id: r.id, name: r.name, count: counts[r.id] || 0 }));
  const inactive = rows.filter(r => !r.active);
  const available = inactive.filter(r => !r.assignedToId).map(r => ({ id: r.id, name: r.name }));
  return {
    success: true,
    active: active,
    available: available,
    totalInactive: inactive.length,
    assignedInactive: inactive.length - available.length
  };
}

function getMine(activeId, month) {
  const { rows } = readSheet();
  const status = month ? readStatus(String(month)) : {};
  const mine = rows.filter(r => !r.active && r.assignedToId === String(activeId))
    .map(r => ({ id: r.id, name: r.name, phone: r.phone, status: status[r.id] || {} }));
  return { success: true, mine: mine };
}

// ---------- Monthly status (one row per volunteer per Satsang month) ----------
function statusSheet(create) {
  const ss = spreadsheet();
  let sheet = ss.getSheetByName(STATUS_SHEET);
  if (!sheet && create) {
    sheet = ss.insertSheet(STATUS_SHEET);
    sheet.getRange(1, 1, 1, STATUS_HEADERS.length).setValues([STATUS_HEADERS]).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('@'); // keep "2026-11" as text, not a date
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function monthKey(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM');
  return String(v).trim();
}

// { volunteerId: { reached, shambhavi, satsang, personal, updatedAt } } for one month
function readStatus(month) {
  const sheet = statusSheet(false);
  const out = {};
  if (!sheet) return out;
  const data = sheet.getDataRange().getValues();
  const keys = Object.keys(STATUS_FIELDS);
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (monthKey(r[0]) !== month) continue;
    const s = {};
    keys.forEach((k, j) => {
      if (r[6 + j] !== '') s[k] = String(r[6 + j]);
    });
    out[String(r[2]).trim()] = s;
  }
  return out;
}

function setStatus(activeId, month, satsang, id, field, value) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) return { success: false, error: 'Invalid month' };
  const def = STATUS_FIELDS[field];
  if (!def) return { success: false, error: 'Unknown field' };
  if (def.values.indexOf(value) === -1) return { success: false, error: 'Invalid value' };

  const { rows } = readSheet();
  const me = rows.find(r => r.active && r.id === String(activeId));
  if (!me) return { success: false, error: 'Active volunteer not found' };
  const v = rows.find(r => !r.active && r.id === String(id));
  if (!v || v.assignedToId !== me.id) return { success: false, error: 'This volunteer is not assigned to you' };

  const sheet = statusSheet(true);
  const data = sheet.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < data.length; i++) {
    if (monthKey(data[i][0]) === month && String(data[i][2]).trim() === v.id) {
      row = i + 1;
      break;
    }
  }
  if (row === -1) row = Math.max(sheet.getLastRow(), 1) + 1;

  // Answers overwrite whatever was saved for this volunteer this month
  sheet.getRange(row, 1, 1, 6).setValues([[month, satsang || '', v.id, v.name, me.id, me.name]]);
  sheet.getRange(row, 7 + Object.keys(STATUS_FIELDS).indexOf(field)).setValue(value);
  sheet.getRange(row, STATUS_HEADERS.length).setValue(new Date());
  SpreadsheetApp.flush();
  return { success: true };
}

function claim(activeId, ids) {
  const { sheet, c, rows } = readSheet();
  const me = rows.find(r => r.active && r.id === String(activeId));
  if (!me) return { success: false, error: 'Active volunteer not found' };

  const claimed = [];
  const taken = [];
  const now = new Date();
  ids.forEach(id => {
    const t = rows.find(r => !r.active && r.id === id);
    if (!t) return;
    if (t.assignedToId) {
      taken.push({ id: t.id, name: t.name });
      return;
    }
    sheet.getRange(t.row, c.toId + 1, 1, 3).setValues([[me.id, me.name, now]]);
    t.assignedToId = me.id;
    claimed.push({ id: t.id, name: t.name });
  });
  SpreadsheetApp.flush();
  return { success: true, claimed: claimed, taken: taken };
}

function release(activeId, ids) {
  const { sheet, c, rows } = readSheet();
  const released = [];
  ids.forEach(id => {
    const t = rows.find(r => !r.active && r.id === id && r.assignedToId === String(activeId));
    if (!t) return;
    sheet.getRange(t.row, c.toId + 1, 1, 3).setValues([['', '', '']]);
    released.push({ id: t.id, name: t.name });
  });
  SpreadsheetApp.flush();
  return { success: true, released: released };
}

// ---------- Satsang material signups (one row per person per item per Satsang month) ----------
function ensureSheet(name, headers, textCols, seed) {
  const ss = spreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    (textCols || []).forEach(a1 => sheet.getRange(a1).setNumberFormat('@'));
    sheet.setFrozenRows(1);
    if (seed && seed.length) sheet.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  }
  return sheet;
}

function readMaterials() {
  const data = ensureSheet(MATERIALS_SHEET, MATERIALS_HEADERS, [], MATERIALS_SEED).getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const key = String(r[0]).trim();
    if (!key || String(r[4]).trim().toLowerCase() === 'no') continue;
    items.push({ key: key, name: String(r[1]).trim() || key, icon: String(r[2]).trim() || '📦', slots: Math.max(1, Number(r[3]) || 1), details: String(r[5] || '').trim() });
  }
  return items;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

// Satsang is on the 2nd Saturday; "2026-11" -> "2026-11-14"
function satsangDate(month) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  const firstSat = 1 + ((6 - new Date(y, m, 1).getDay() + 7) % 7);
  return `${month}-${String(firstSat + 7).padStart(2, '0')}`;
}

// Signups for this Satsang month and every later one ("yyyy-MM" strings sort by date)
function readMaterialSignups(fromMonth) {
  const sheet = ensureSheet(MATERIAL_SIGNUPS_SHEET, MATERIAL_SIGNUP_HEADERS, ['A:A']);
  const data = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const month = monthKey(r[0]);
    if (!MONTH_RE.test(month) || month < fromMonth) continue;
    out.push({ row: i + 1, month: month, key: String(r[2]).trim(), id: String(r[4]).trim(), name: String(r[5]).trim() });
  }
  return { sheet: sheet, signups: out };
}

function getMaterials(month) {
  if (!MONTH_RE.test(String(month))) return { success: false, error: 'Invalid month' };
  const signups = readMaterialSignups(String(month)).signups
    .map(s => ({ month: s.month, key: s.key, id: s.id, name: s.name }));
  return { success: true, items: readMaterials(), signups: signups };
}

function cleanMonths(months) {
  return months.filter(m => MONTH_RE.test(m)).filter((m, i, a) => a.indexOf(m) === i).sort();
}

// Sign up for one item for any number of Satsang months at once.
// Months already full are skipped and reported back in `full`.
function materialSignup(activeId, months, key) {
  months = cleanMonths(months);
  if (!months.length) return { success: false, error: 'Pick at least one month' };
  const { rows } = readSheet();
  const me = rows.find(r => r.active && r.id === String(activeId));
  if (!me) return { success: false, error: 'Active volunteer not found' };
  const item = readMaterials().find(m => m.key === String(key));
  if (!item) return { success: false, error: 'Unknown item' };

  const { sheet, signups } = readMaterialSignups(months[0]);
  const added = [];
  const full = [];
  const now = new Date();
  months.forEach(month => {
    const forMonth = signups.filter(s => s.key === item.key && s.month === month);
    if (forMonth.some(s => s.id === me.id)) return;
    if (forMonth.length >= item.slots) {
      full.push({ month: month, by: forMonth.map(s => s.name) });
      return;
    }
    added.push([month, satsangDate(month), item.key, item.name, me.id, me.name, now]);
  });
  if (added.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, added.length, added[0].length).setValues(added);
    SpreadsheetApp.flush();
  }
  const out = getMaterials(months[0]);
  out.added = added.map(r => r[0]);
  out.full = full;
  return out;
}

function materialCancel(activeId, months, key) {
  months = cleanMonths(months);
  if (!months.length) return { success: false, error: 'Pick at least one month' };
  const { sheet, signups } = readMaterialSignups(months[0]);
  // Delete bottom-up so row numbers stay valid
  signups.filter(s => s.key === String(key) && s.id === String(activeId) && months.indexOf(s.month) !== -1)
    .sort((a, b) => b.row - a.row)
    .forEach(s => sheet.deleteRow(s.row));
  SpreadsheetApp.flush();
  return getMaterials(months[0]);
}
