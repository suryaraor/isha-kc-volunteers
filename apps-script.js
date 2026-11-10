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
