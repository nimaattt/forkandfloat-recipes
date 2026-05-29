export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GitHub token not configured on server.' });
  }

  const d = req.body;

  // GitHub repository_dispatch client_payload is capped at 10 properties.
  // We nest everything into 3 keys to stay well under the limit.
  const client_payload = {
    meta: {
      title:       d.title,
      slug:        d.slug,
      description: d.description,
      category:    d.category,
      difficulty:  d.difficulty,
      emoji:       d.emoji,
    },
    timing: {
      prepTime: d.prepTime,
      cookTime: d.cookTime,
      servings: d.servings,
    },
    content: {
      coverImage:  d.coverImage,
      ingredients: d.ingredients,
      steps:       d.steps,
      howToServe:  d.howToServe,
      chefsNote:   d.chefsNote,
      tags:        d.tags,
    },
  };

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
        body: JSON.stringify({ event_type: 'new-recipe', client_payload }),
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
