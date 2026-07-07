const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(VISITS_FILE)) fs.writeFileSync(VISITS_FILE, '{}', 'utf-8');

function readVisits() {
  try { return JSON.parse(fs.readFileSync(VISITS_FILE, 'utf-8')); }
  catch { return {}; }
}

function writeVisits(data) {
  fs.writeFileSync(VISITS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Health check - old CRM uses this to detect backend
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Get all visits as a map: { "客户名": { visited, visit_notes, ... } }
app.get('/api/visits', (req, res) => {
  const visits = readVisits();
  res.json({ ok: true, data: visits });
});

// Batch save visits - replaces entire map
app.post('/api/visits/batch', (req, res) => {
  const newVisits = req.body.visits || {};
  // Merge with existing (don't overwrite entries from other users)
  const existing = readVisits();
  const merged = { ...existing, ...newVisits };
  writeVisits(merged);
  const count = Object.keys(newVisits).length;
  res.json({ ok: true, saved: count, total: Object.keys(merged).length });
});

// SPA fallback - serve old CRM HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  const visits = readVisits();
  console.log(`CRM Server running on http://localhost:${PORT}`);
  console.log(`Visit records: ${Object.keys(visits).length} customers`);
});
