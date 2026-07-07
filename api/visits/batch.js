// POST /api/visits/batch - save visit records to GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'laoshen77';
const GITHUB_REPO = process.env.GITHUB_REPO || 'shanghai-crm';
const FILE_PATH = 'data/visits.json';

async function getFileSha() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'crm-vercel'
    }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();
  return data.sha;
}

async function readFile() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'crm-vercel'
    }
  });
  if (resp.status === 404) return {};
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return JSON.parse(content);
}

async function writeFile(content, sha) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const body = JSON.stringify({
    message: 'Update visit records',
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    sha: sha || undefined,
    branch: 'main'
  });

  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'crm-vercel'
    },
    body: body
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GitHub write error: ${resp.status} ${errText}`);
  }

  return await resp.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const newVisits = req.body.visits || {};

    // Read existing visits
    const existing = await readFile();

    // Merge: new visits overwrite existing for same customer
    const merged = { ...existing, ...newVisits };

    // Get current file SHA for update
    const sha = await getFileSha();

    // Write merged data
    await writeFile(merged, sha);

    const count = Object.keys(newVisits).length;
    const total = Object.keys(merged).length;

    return res.status(200).json({ ok: true, saved: count, total: total });
  } catch (err) {
    console.error('POST visits error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
