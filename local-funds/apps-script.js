// Google Apps Script backend for Isha KC Local Funds
// Create a NEW Google Sheet (keep it separate from the volunteer sheet), then
// Extensions > Apps Script > paste this file > run setup() once > Deploy as Web app
// (Execute as: Me, Who has access: Anyone).
// Set the edit PIN in Project Settings > Script properties: EDIT_PIN = <your pin>.

const TX_SHEET = 'Transactions';
const INIT_SHEET = 'Initiatives';
const TX_HEADERS = ['ID', 'Date', 'Type', 'Amount', 'From', 'To', 'Initiative', 'Qty', 'Note', 'Entered At', 'Voided'];
const INIT_HEADERS = ['Name', 'Unit', 'Unit Cost', 'Notes'];
const TYPES = ['Donation', 'Expense', 'Handover'];

// Run once from the Apps Script editor to create both tabs with headers
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tx = ss.getSheetByName(TX_SHEET);
  if (!tx) tx = ss.insertSheet(TX_SHEET);
  if (tx.getLastRow() === 0) tx.appendRow(TX_HEADERS);
  // Keep dates as plain text so time zones never shift them
  tx.getRange('B:B').setNumberFormat('@');

  let init = ss.getSheetByName(INIT_SHEET);
  if (!init) init = ss.insertSheet(INIT_SHEET);
  if (init.getLastRow() === 0) {
    init.appendRow(INIT_HEADERS);
    init.appendRow([
      'Sesame oil for satsangs & Isha programs',
      'small bottle',
      12,
      'About 1 bottle every 3-4 months for satsangs, and 1 bottle per 2-3 day Isha program.'
    ]);
  }
}

function doGet(e) {
  const p = e.parameter || {};
  let result;
  try {
    switch (p.action) {
      case 'getData':
        result = getData();
        break;
      case 'checkPin':
        checkPin(p.pin);
        result = { success: true };
        break;
      case 'add':
        checkPin(p.pin);
        result = withLock(() => addTx(p));
        break;
      case 'update':
        checkPin(p.pin);
        result = withLock(() => updateTx(p));
        break;
      case 'delete':
        checkPin(p.pin);
        result = withLock(() => deleteTx(p.id));
        break;
      case 'void':
        checkPin(p.pin);
        result = withLock(() => voidTx(p.id, true));
        break;
      case 'unvoid':
        checkPin(p.pin);
        result = withLock(() => voidTx(p.id, false));
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: err.message || String(err) };
  }

  // JSONP so the static page works from GitHub Pages / any host without CORS issues
  if (p.callback) {
    return ContentService.createTextOutput(`${p.callback}(${JSON.stringify(result)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkPin(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('EDIT_PIN');
  if (!expected) throw new Error('EDIT_PIN is not set in Script properties');
  if (String(pin || '') !== String(expected)) throw new Error('Wrong PIN');
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet tab '${name}' not found (run setup() once)`);
  return sheet;
}

function columns(headerRow, wanted) {
  const headers = headerRow.map(h => String(h).trim().toLowerCase());
  const c = {};
  wanted.forEach(name => {
    const i = headers.indexOf(name.toLowerCase());
    if (i === -1) throw new Error(`Missing column '${name}'`);
    c[name] = i;
  });
  return c;
}

function fmtDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}

function readTx() {
  const sheet = getSheet(TX_SHEET);
  const data = sheet.getDataRange().getValues();
  const c = columns(data[0], TX_HEADERS);
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[c['ID']]) continue;
    rows.push({
      row: i + 1,
      id: String(r[c['ID']]),
      date: fmtDate(r[c['Date']]),
      type: String(r[c['Type']]).trim(),
      amount: Number(r[c['Amount']]) || 0,
      from: String(r[c['From']] || '').trim(),
      to: String(r[c['To']] || '').trim(),
      initiative: String(r[c['Initiative']] || '').trim(),
      qty: Number(r[c['Qty']]) || 0,
      note: String(r[c['Note']] || '').trim(),
      voided: String(r[c['Voided']]).trim().toLowerCase() === 'yes'
    });
  }
  return { sheet, c, rows };
}

function readInitiatives() {
  const data = getSheet(INIT_SHEET).getDataRange().getValues();
  const c = columns(data[0], INIT_HEADERS);
  return data.slice(1)
    .filter(r => String(r[c['Name']]).trim())
    .map(r => ({
      name: String(r[c['Name']]).trim(),
      unit: String(r[c['Unit']] || '').trim(),
      unitCost: Number(r[c['Unit Cost']]) || 0,
      notes: String(r[c['Notes']] || '').trim()
    }));
}

function getData() {
  const { rows } = readTx();
  return {
    success: true,
    transactions: rows.map(({ row, ...t }) => t),
    initiatives: readInitiatives()
  };
}

// Validates an entry and returns its fields, cleared where they don't apply to the type
function parseTx(p) {
  const type = String(p.type || '').trim();
  if (TYPES.indexOf(type) === -1) throw new Error('Type must be Donation, Expense or Handover');
  const amount = Math.round(Number(p.amount) * 100) / 100;
  if (!(amount > 0)) throw new Error('Amount must be greater than 0');
  const date = String(p.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be YYYY-MM-DD');
  const from = String(p.from || '').trim();
  const to = String(p.to || '').trim();
  const initiative = String(p.initiative || '').trim();
  if (!from) throw new Error(type === 'Donation' ? 'Donor is required' : 'From is required');
  if (type !== 'Expense' && !to) throw new Error('Received by / To is required');
  if (type === 'Expense' && !initiative) throw new Error('Initiative is required for an expense');
  if (type === 'Handover' && from.toLowerCase() === to.toLowerCase()) throw new Error('From and To must differ');
  return {
    'Date': date,
    'Type': type,
    'Amount': amount,
    'From': from,
    'To': type === 'Expense' ? '' : to,
    'Initiative': type === 'Expense' ? initiative : '',
    'Qty': type === 'Expense' && Number(p.qty) > 0 ? Number(p.qty) : '',
    'Note': String(p.note || '').trim()
  };
}

function addTx(p) {
  const fields = parseTx(p);
  const { sheet, c } = readTx();
  const id = Utilities.getUuid().slice(0, 8);
  const row = new Array(TX_HEADERS.length).fill('');
  row[c['ID']] = id;
  Object.keys(fields).forEach(k => { row[c[k]] = fields[k]; });
  row[c['Entered At']] = new Date();
  row[c['Voided']] = '';
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return { success: true, id: id };
}

function findTx(id) {
  const tx = readTx();
  const t = tx.rows.find(r => r.id === String(id));
  if (!t) throw new Error('Entry not found');
  return { ...tx, t };
}

function updateTx(p) {
  const fields = parseTx(p);
  const { sheet, c, t } = findTx(p.id);
  Object.keys(fields).forEach(k => sheet.getRange(t.row, c[k] + 1).setValue(fields[k]));
  SpreadsheetApp.flush();
  return { success: true };
}

function deleteTx(id) {
  const { sheet, t } = findTx(id);
  sheet.deleteRow(t.row);
  SpreadsheetApp.flush();
  return { success: true };
}

// Void keeps the row in the history but stops it counting
function voidTx(id, on) {
  const { sheet, c, t } = findTx(id);
  sheet.getRange(t.row, c['Voided'] + 1).setValue(on ? 'yes' : '');
  SpreadsheetApp.flush();
  return { success: true };
}
