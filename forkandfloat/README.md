# Fork & Float — Recipe Hub

Branded recipe hub for `recipes.forkandfloat.com`. 
Ava fills out a Google Form → Make.com automation → recipe page goes live automatically.

## How it works

1. Ava submits a Google Form with recipe details
2. Make.com receives the submission and calls `generate-recipe.js` via a GitHub API commit
3. A new `recipes/[slug].html` page is created from `template.html`
4. `recipes.json` is updated (powers the index page)
5. Vercel detects the GitHub commit and redeploys in ~30 seconds
6. New recipe is live at `recipes.forkandfloat.com/recipes/[slug]`

## File structure

```
forkandfloat-recipes/
├── index.html          ← Recipe hub homepage (all recipes grid)
├── template.html       ← Recipe page template (filled in per recipe)
├── generate-recipe.js  ← Script that builds recipe pages from data
├── recipes.json        ← Recipe index data (auto-updated)
├── vercel.json         ← Vercel routing config
├── package.json
└── recipes/            ← Generated recipe pages live here
    ├── shirazi-salad.html
    └── ...
```

## Google Form fields

Set up the form with these exact field names (used in Make.com mapping):

| Field | Type | Notes |
|-------|------|-------|
| Recipe Name | Short text | e.g. "Shirazi Salad" |
| One-line description | Short text | Shown under title and on card |
| Category | Dropdown | Salads, Mains, Vegetarian, Persian-Inspired, Dessert, Quick & Easy |
| Tags | Checkboxes | salads, mains, vegetarian, persian, quick, crowd, dessert |
| Prep Time | Short text | e.g. "10 min" |
| Cook Time | Short text | e.g. "40 min" or "None" |
| Servings | Short text | e.g. "4" or "4–6" |
| Difficulty | Dropdown | Easy, Medium, Advanced |
| Ingredients | Paragraph | One per line. Put amount in [brackets]: `Persian cucumbers [3, diced]` |
| Steps | Paragraph | Separate steps with a blank line. First line = step title |
| How to Serve | Paragraph | One bullet per line |
| Chef's Note | Paragraph | Optional personal note from Ava |
| Cover Photo | File upload | Goes to Google Drive |
| Emoji | Short text | Optional fun emoji for the card if no photo |

## Ingredient format

```
Persian cucumbers [3, finely diced]
Ripe tomatoes [2, finely diced]
Olive oil [2 tbsp]
Flaky sea salt [to taste]
```

The ingredient name goes left, the `[amount]` goes right in accent colour.

## Steps format

Separate each step with a blank line. The first line of each block becomes the step title (H3).

```
Dice everything small
Cut cucumbers and tomatoes into fine, even dice — about 5mm.

Make the dressing
Whisk together lemon juice, olive oil, and dried lime powder.

Combine and rest
Toss everything together and let it sit for 5 minutes.
```

## Make.com scenario

1. **Trigger:** Google Sheets — Watch New Rows (connected to your Form responses sheet)
2. **HTTP Module:** PUT request to GitHub Contents API
   - URL: `https://api.github.com/repos/nimaattt/forkandfloat-recipes/contents/recipes/{{slug}}.html`
   - Auth: GitHub Personal Access Token
   - Body: base64-encoded output of generate-recipe.js
3. **HTTP Module:** PUT request to update `recipes.json`

See `MAKE_SETUP.md` for the full step-by-step Make.com configuration.

## Local testing

```bash
# Test with the Shirazi Salad sample
npm test

# This generates:
# → recipes/shirazi-salad.html
# → updates recipes.json

# Preview locally
npm run dev
# Open http://localhost:3000
```

## Deploying to Vercel

1. Import `github.com/nimaattt/forkandfloat-recipes` in Vercel
2. No build command needed (static site)
3. Output directory: leave blank (root)
4. Add custom domain: `recipes.forkandfloat.com`
   - Add CNAME record at your registrar: `recipes` → `cname.vercel-dns.com`
