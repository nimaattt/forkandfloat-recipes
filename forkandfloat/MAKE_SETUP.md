# Make.com Setup Guide

Step-by-step: connect Google Form → GitHub → auto-deploy on Vercel

---

## Before you start

You need:
- [ ] Google Form created (see field list in README.md)
- [ ] GitHub repo: `github.com/nimaattt/forkandfloat-recipes`
- [ ] GitHub Personal Access Token (see Step 0)
- [ ] Make.com account (free tier is enough)

---

## Step 0 — GitHub Personal Access Token

1. Go to github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Click **Generate new token (classic)**
3. Name: `forkandfloat-make`
4. Expiration: No expiration
5. Scopes: check **repo** (full control of private repositories)
6. Click Generate — **copy the token now**, you won't see it again
7. Save it somewhere safe (you'll paste it into Make.com)

---

## Step 1 — Create the scenario in Make.com

1. Go to make.com → Create a new scenario
2. Click the **+** to add the first module

---

## Step 2 — Trigger: Google Sheets (Watch New Rows)

Google Forms saves responses to a Google Sheet automatically.

1. Search for **Google Sheets** → select **Watch New Rows**
2. Connect your Google account
3. Select the spreadsheet linked to Ava's recipe form
4. Select the sheet (usually "Form Responses 1")
5. Set "Where to start" → **From now on**
6. Click OK

---

## Step 3 — Tools: Set Variables

Add a **Tools → Set Multiple Variables** module to format the data.

Map these variables from the Google Sheets columns:

| Variable name | Value |
|---------------|-------|
| `title` | Column: Recipe Name |
| `description` | Column: One-line description |
| `category` | Column: Category |
| `tags` | Column: Tags (comma separated) |
| `prepTime` | Column: Prep Time |
| `cookTime` | Column: Cook Time |
| `servings` | Column: Servings |
| `difficulty` | Column: Difficulty |
| `ingredients` | Column: Ingredients |
| `steps` | Column: Steps |
| `howToServe` | Column: How to Serve |
| `chefsNote` | Column: Chef's Note |
| `emoji` | Column: Emoji |
| `slug` | Use the text function: `{{replace(lower(title); " "; "-")}}` |

---

## Step 4 — HTTP: Generate recipe HTML

This is the core step. We call the GitHub API to create the recipe file.

1. Add **HTTP → Make a Request** module
2. Fill in:

```
URL:    https://api.github.com/repos/nimaattt/forkandfloat-recipes/dispatches
Method: POST
Headers:
  Authorization: token YOUR_GITHUB_TOKEN_HERE
  Accept: application/vnd.github.v3+json
  Content-Type: application/json

Body (raw JSON):
{
  "event_type": "new-recipe",
  "client_payload": {
    "title": "{{title}}",
    "slug": "{{slug}}",
    "description": "{{description}}",
    "category": "{{category}}",
    "prepTime": "{{prepTime}}",
    "cookTime": "{{cookTime}}",
    "servings": "{{servings}}",
    "difficulty": "{{difficulty}}",
    "ingredients": "{{ingredients}}",
    "steps": "{{steps}}",
    "howToServe": "{{howToServe}}",
    "chefsNote": "{{chefsNote}}",
    "emoji": "{{emoji}}"
  }
}
```

---

## Step 5 — GitHub Action (receives the trigger)

Add this file to the repo at `.github/workflows/new-recipe.yml` — it runs `generate-recipe.js` when Make.com fires the dispatch event above.

```yaml
name: Generate Recipe Page
on:
  repository_dispatch:
    types: [new-recipe]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Generate recipe page
        run: |
          node generate-recipe.js '${{ toJSON(github.event.client_payload) }}'
      - name: Commit and push
        run: |
          git config user.email "bot@forkandfloat.com"
          git config user.name "Fork & Float Bot"
          git add .
          git commit -m "Add recipe: ${{ github.event.client_payload.title }}"
          git push
```

This commit triggers Vercel to redeploy. New recipe is live in ~30 seconds. ✅

---

## Step 6 — Test the full pipeline

1. Submit a test entry in the Google Form
2. Go to Make.com → run the scenario manually once
3. Check GitHub → you should see a new commit
4. Check Vercel → a new deployment should be running
5. Visit `recipes.forkandfloat.com/recipes/[your-slug]`

---

## Checklist

- [ ] GitHub token added to Make.com HTTP module
- [ ] Google Sheets connected and columns mapped correctly  
- [ ] `.github/workflows/new-recipe.yml` added to the repo
- [ ] Test submission works end-to-end
- [ ] Custom domain `recipes.forkandfloat.com` pointing to Vercel
