/**
 * CRM sheet sync — paste into "CRM - HiddenGem Media" → Extensions → Apps Script.
 *
 * Not part of the app bundle. The portal (netlify/lib/crm-sheet.mts) POSTs
 *   { secret, client: "Walden Retreats", cells: { "Master Brand Document": "Complete" } }
 * and this writes each cell on that client's row of the "Clients - Onboarding" tab.
 *
 * Set up once:
 *   1. Project Settings → Script properties → add SECRET = a long random string.
 *   2. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *   3. Copy the /exec URL. In Netlify set CRM_SHEET_WEBHOOK_URL = that URL and
 *      CRM_SHEET_SECRET = the same SECRET.
 * After editing this file: Deploy → Manage deployments → edit → Version: New version
 * (the /exec URL stays the same).
 *
 * Safe by construction:
 *   - Columns are found by their row-2 HEADER, never by letter, so inserting a column is harmless.
 *     A renamed header skips that cell and says so.
 *   - A value that is not one of the cell's dropdown options is refused, never written.
 *   - A client with no row, or more than one, is refused rather than guessed.
 */
var CRM_SYNC_TAB = "Clients - Onboarding";
var CRM_SYNC_HEADER_ROW = 2;
var CRM_SYNC_CLIENT_HEADER = "Client Business";

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return crmSync_reply({ ok: false, error: "bad-json" });
  }
  var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) return crmSync_reply({ ok: false, error: "unauthorised" });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return crmSync_reply(crmSync_writeCells(String(body.client || ""), body.cells || {}));
  } finally {
    lock.releaseLock();
  }
}

/** Lower-case, accents and punctuation dropped: "Täberg Falls" and "taberg falls" match. */
function crmSync_norm(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function crmSync_writeCells(client, cells) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CRM_SYNC_TAB);
  if (!sheet) return { ok: false, error: "no tab " + CRM_SYNC_TAB };

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(CRM_SYNC_HEADER_ROW, 1, 1, lastCol).getDisplayValues()[0].map(crmSync_norm);
  var clientCol = headers.indexOf(crmSync_norm(CRM_SYNC_CLIENT_HEADER)) + 1;
  if (!clientCol) return { ok: false, error: "no header " + CRM_SYNC_CLIENT_HEADER };

  var names = sheet.getRange(CRM_SYNC_HEADER_ROW + 1, clientCol, Math.max(sheet.getLastRow() - CRM_SYNC_HEADER_ROW, 1), 1).getDisplayValues();
  var want = crmSync_norm(client);
  var rows = [];
  for (var i = 0; i < names.length; i++) if (want && crmSync_norm(names[i][0]) === want) rows.push(CRM_SYNC_HEADER_ROW + 1 + i);
  if (rows.length !== 1) return { ok: false, error: rows.length ? "client on " + rows.length + " rows" : "no row for " + client };

  var written = [];
  var skipped = [];
  Object.keys(cells).forEach(function (header) {
    var col = headers.indexOf(crmSync_norm(header)) + 1;
    if (!col) return skipped.push({ header: header, reason: "no such column" });
    var cell = sheet.getRange(rows[0], col);
    var value = String(cells[header]);
    var options = crmSync_dropdownOptions(cell);
    if (options && options.indexOf(value) === -1) return skipped.push({ header: header, reason: "not a dropdown option: " + value });
    cell.setValue(value);
    written.push(header);
  });
  return { ok: true, row: rows[0], written: written, skipped: skipped };
}

/** The cell's dropdown options, or null when it has no list to check against. */
function crmSync_dropdownOptions(cell) {
  var rule = cell.getDataValidation();
  if (!rule) return null;
  var type = rule.getCriteriaType();
  var args = rule.getCriteriaValues();
  if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return args[0].map(String);
  if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    return args[0].getDisplayValues().reduce(function (all, r) { return all.concat(r); }, []);
  }
  return null;
}

function crmSync_reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
