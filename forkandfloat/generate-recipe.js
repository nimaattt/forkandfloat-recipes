#!/usr/bin/env node
/**
 * generate-recipe.js
 * 
 * Called by Make.com (or manually) with recipe data as a JSON argument.
 * Reads template.html, replaces all {{PLACEHOLDERS}}, writes to recipes/[slug].html
 * Then regenerates recipes.json for the index page.
 * 
 * Usage:
 *   node generate-recipe.js '{"title":"Shirazi Salad","slug":"shirazi-salad",...}'
 */

const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse ingredients string.
 * Ava types one ingredient per line: "Persian cucumbers [3, diced]"
 * The part in [...] becomes the amount (shown in accent colour on the right).
 */
function parseIngredients(raw) {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(.+?)\s*\[(.+?)\]$/);
      if (match) {
        return `<li><span>${match[1].trim()}</span><strong>${match[2].trim()}</strong></li>`;
      }
      return `<li><span>${line}</span></li>`;
    })
    .join('\n        ');
}

/**
 * Parse steps string.
 * Ava types steps separated by blank lines.
 * First line of each step = the step title (becomes H3).
 * Remaining lines = the step body.
 * 
 * Example:
 *   Dice everything small
 *   Cut the cucumbers and tomatoes into very fine, even dice...
 *
 *   Make the dressing
 *   Whisk together lemon juice, olive oil...
 */
function parseSteps(raw) {
  const blocks = raw.trim().split(/\n\s*\n/);
  return blocks
    .map(block => {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return '';
      const title = lines[0];
      const body = lines.slice(1).join(' ');
      return `<li>
          <h3>${title}</h3>
          ${body ? `<p>${body}</p>` : ''}
        </li>`;
    })
    .filter(Boolean)
    .join('\n        ');
}

/**
 * Parse "how to serve" — plain bullet list, one item per line
 */
function parseHowToServe(raw) {
  if (!raw || !raw.trim()) return '';
  const items = raw
    .split('\n')
    .map(l => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .map(l => `<li>${l}</li>`)
    .join('\n          ');
  return `
    <div class="how-to-serve">
      <span class="serve-label">How to Serve</span>
      <div class="serve-rich"><ul>${items}</ul></div>
    </div>`;
}

/**
 * Chef's note section
 */
function parseChefsNote(raw) {
  if (!raw || !raw.trim()) return '';
  return `
    <div class="chef-note">
      <span class="chef-note-label">Ava's note</span>
      <p>"${raw.trim()}"</p>
    </div>`;
}

/**
 * Cover image HTML
 */
function parseCoverImage(url) {
  if (!url || !url.trim()) {
    return '<div class="cover-placeholder">🍽️</div>';
  }
  return `<img class="cover-img" src="${url.trim()}" alt="Recipe cover photo">`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function generateRecipe(data) {
  const {
    title,
    description = '',
    category = '',
    prepTime = '',
    cookTime = '',
    servings = '',
    difficulty = 'Easy',
    ingredients = '',
    steps = '',
    howToServe = '',
    chefsNote = '',
    coverImage = '',
    tags = [],
    emoji = '🍽️',
  } = data;

  const slug = data.slug || slugify(title);

  // Read template
  const templatePath = path.join(__dirname, 'template.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // Replace all placeholders
  html = html
    .replace(/{{RECIPE_TITLE}}/g, title)
    .replace(/{{RECIPE_DESCRIPTION}}/g, description)
    .replace(/{{RECIPE_CATEGORY}}/g, category)
    .replace(/{{PREP_TIME}}/g, prepTime)
    .replace(/{{COOK_TIME}}/g, cookTime)
    .replace(/{{SERVINGS}}/g, servings)
    .replace(/{{DIFFICULTY}}/g, difficulty)
    .replace(/{{RECIPE_COVER_IMAGE}}/g, coverImage)
    .replace(/{{COVER_IMAGE_HTML}}/g, parseCoverImage(coverImage))
    .replace(/{{INGREDIENTS_HTML}}/g, parseIngredients(ingredients))
    .replace(/{{STEPS_HTML}}/g, parseSteps(steps))
    .replace(/{{HOW_TO_SERVE_HTML}}/g, parseHowToServe(howToServe))
    .replace(/{{CHEFS_NOTE_HTML}}/g, parseChefsNote(chefsNote));

  // Write recipe page
  const recipesDir = path.join(__dirname, 'recipes');
  if (!fs.existsSync(recipesDir)) fs.mkdirSync(recipesDir);
  const outputPath = path.join(recipesDir, `${slug}.html`);
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`✅ Recipe page written: recipes/${slug}.html`);

  // Update recipes.json (index data)
  const indexPath = path.join(__dirname, 'public', 'recipes.json');
  // Also check root for Vercel static serving
  const rootIndexPath = path.join(__dirname, 'recipes.json');

  let existing = [];
  const indexFile = fs.existsSync(rootIndexPath) ? rootIndexPath : indexPath;
  if (fs.existsSync(indexFile)) {
    try { existing = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch(e) {}
  }

  // Remove existing entry with same slug
  existing = existing.filter(r => r.slug !== slug);

  // Add new entry at the top (newest first)
  const entry = { title, slug, description, category, prepTime, cookTime, servings, difficulty, coverImage, tags, emoji };
  existing.unshift(entry);

  const json = JSON.stringify(existing, null, 2);
  fs.writeFileSync(rootIndexPath, json, 'utf8');
  if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'));
  fs.writeFileSync(indexPath, json, 'utf8');
  console.log(`✅ recipes.json updated (${existing.length} recipes)`);

  return { slug, path: `recipes/${slug}.html` };
}

// Run from CLI
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node generate-recipe.js \'{"title":"...","ingredients":"...",...}\'');
    process.exit(1);
  }
  try {
    const data = JSON.parse(arg);
    generateRecipe(data);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }
}

module.exports = { generateRecipe, slugify };
