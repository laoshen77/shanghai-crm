const fs = require('fs');
const path = require('path');

const CRM_HTML = path.join(__dirname, '..', '..', '上海片区CRM系统.html');
const OUTPUT = path.join(__dirname, 'data', 'customers.json');

console.log('Reading CRM HTML...');
const html = fs.readFileSync(CRM_HTML, 'utf-8');

const start = html.indexOf('const RAW = [');
const bracketStart = html.indexOf('[', start);
let depth = 0;
let i = bracketStart;
while (i < html.length) {
  if (html[i] === '[') depth++;
  else if (html[i] === ']') {
    depth--;
    if (depth === 0) break;
  }
  i++;
}
const rawStr = html.slice(bracketStart, i + 1);
const data = JSON.parse(rawStr);

console.log(`Extracted ${data.length} customers`);

// Ensure data dir exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Write customers data
fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Written to ${OUTPUT}`);
console.log(`Sample customer: ${data[0].name} (rank #${data[0].rank})`);
