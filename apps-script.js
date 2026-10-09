// Google Apps Script backend for Isha KC Volunteer Assignment
// Open the Google Sheet > Extensions > Apps Script > paste this file > Deploy as Web app
// (Execute as: Me, Who has access: Anyone). The sheet needs a tab named "Volunteers".

const SHEET_NAME = 'Volunteers';

function doGet(e) {
  const p = e.parameter || {};
  let result;
  try {
    switch (p.action) {
      case 'getData':
        result = getData();
        break;
      case 'getMine':
        result = getMine(p.activeId);
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

function readSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const sheet = ss.getSheetByName(SHEET_NAME);
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

function getMine(activeId) {
  const { rows } = readSheet();
  const mine = rows.filter(r => !r.active && r.assignedToId === String(activeId))
    .map(r => ({ id: r.id, name: r.name }));
  return { success: true, mine: mine };
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
