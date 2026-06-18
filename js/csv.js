// csv.js
// Lightweight CSV parser. Handles quoted fields, commas inside quotes, and
// trims whitespace. No external library needed for this.

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field.trim());
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i++;
        row.push(field.trim());
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  // last field/row if file doesn't end with a newline
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some(f => f !== '')) rows.push(row);
  }
  return rows;
}

// Parses CSV text into an array of objects using the first row as headers.
// Header matching is case-insensitive and ignores extra whitespace.
// `headerMap` maps expected-lowercase-header -> object key, e.g.
//   { 'eq number': 'eq_number', 'type': 'type', ... }
function parseCSVToObjects(text, headerMap) {
  const rows = parseCSV(text);
  if (rows.length === 0) return { headers: [], records: [], errors: ['File is empty.'] };

  const rawHeaders = rows[0].map(h => h.toLowerCase().trim());
  const errors = [];

  // Build index lookup: object key -> column index
  const keyToIndex = {};
  for (const [expectedHeader, objectKey] of Object.entries(headerMap)) {
    const idx = rawHeaders.indexOf(expectedHeader.toLowerCase());
    if (idx === -1) {
      errors.push(`Missing required column: "${expectedHeader}"`);
    } else {
      keyToIndex[objectKey] = idx;
    }
  }

  if (errors.length > 0) {
    return { headers: rawHeaders, records: [], errors };
  }

  const records = rows.slice(1).map((row, rowIndex) => {
    const record = { _rowNumber: rowIndex + 2 }; // +2 because row 1 is header, humans count from 1
    for (const [objectKey, colIndex] of Object.entries(keyToIndex)) {
      record[objectKey] = (row[colIndex] || '').trim();
    }
    return record;
  });

  return { headers: rawHeaders, records, errors: [] };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
