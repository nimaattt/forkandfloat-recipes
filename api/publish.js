export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GitHub token not configured on server.' });
  }

  try {
    const response = await fetch(
      'https://api.github.com/repos/nimaattt/forkandfloat-recipes/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'new-recipe',
          client_payload: req.body,
        }),
      }
    );

    if (response.status === 204 || response.ok) {
      return res.status(200).json({ ok: true });
    }

    const err = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: err.message || 'GitHub API error' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
