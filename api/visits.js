// GET /api/visits - retrieve all visit records from GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'laoshen77';
const GITHUB_REPO = process.env.GITHUB_REPO || 'shanghai-crm';
const FILE_PATH = 'data/visits.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'crm-vercel'
      }
    });

    if (resp.status === 404) {
      // File doesn't exist yet, return empty
      return res.status(200).json({ ok: true, data: {} });
    }

    if (!resp.ok) {
      throw new Error(`GitHub API error: ${resp.status}`);
    }

    const fileData = await resp.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const visits = JSON.parse(content);

    return res.status(200).json({ ok: true, data: visits });
  } catch (err) {
    console.error('GET visits error:', err.message);
    return res.status(200).json({ ok: true, data: {} });
  }
}
