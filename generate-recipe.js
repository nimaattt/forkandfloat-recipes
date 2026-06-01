#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Escape for safe insertion into HTML text / attributes
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseIngredients(raw) {
  if (!raw) return '';
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(.+?)\s*\[(.+?)\]$/);
      if (match) {
        return `<li><span>${esc(match[1].trim())}</span><strong>${esc(match[2].trim())}</strong></li>`;
      }
      return `<li><span>${esc(line)}</span></li>`;
    })
    .join('\n        ');
}

function parseSteps(raw) {
  if (!raw) return '';
  const blocks = raw.trim().split(/\n\s*\n/);
  return blocks
    .map(block => {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return '';
      const title = lines[0];
      const body = lines.slice(1).join(' ');
      return `<li>
          <h3>${esc(title)}</h3>
          ${body ? `<p>${esc(body)}</p>` : ''}
        </li>`;
    })
    .filter(Boolean)
    .join('\n        ');
}

function parseHowToServe(raw) {
  if (!raw || !raw.trim()) return '';
  const items = raw
    .split('\n')
    .map(l => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .map(l => `<li>${esc(l)}</li>`)
    .join('\n          ');
  return `
    <div class="how-to-serve">
      <span class="serve-label">How to Serve</span>
      <div class="serve-rich"><ul>${items}</ul></div>
    </div>`;
}

function parseChefsNote(raw) {
  if (!raw || !raw.trim()) return '';
  return `
    <div class="chef-note">
      <span class="chef-note-label">Ava's note</span>
      <p>"${esc(raw.trim())}"</p>
    </div>`;
}

// Pull the file ID out of ANY common Google Drive URL shape.
// Handles: open?id=ID, uc?id=ID, /file/d/ID/view, /d/ID, and bare lh3 URLs.
function extractDriveId(url) {
  const m =
    url.match(/[?&]id=([^&]+)/) ||
    url.match(/\/file\/d\/([^/]+)/) ||
    url.match(/\/d\/([^/?]+)/);
  return m ? m[1] : null;
}

// Returns a directly-embeddable image URL (or '' if none).
function toImageUrl(url) {
  if (!url || !url.trim()) return '';
  let src = url.trim();
  if (src.includes('drive.google.com')) {
    const id = extractDriveId(src);
    if (id) src = `https://lh3.googleusercontent.com/d/${id}`;
  }
  return src;
}

function coverImageHtml(imageUrl) {
  if (!imageUrl) return '<div class="cover-placeholder">🍽️</div>';
  return `<img class="cover-img" src="${esc(imageUrl)}" alt="Recipe cover photo">`;
}

function generateRecipe(data) {
  const title       = data.title       || data['Recipe Name']          || '';
  const description = data.description || data['One-line description'] || '';
  const category    = data.category    || data['Category']             || '';
  const prepTime    = data.prepTime    || data['Prep Time']            || '';
  const cookTime    = data.cookTime    || data['Cook Time']            || '';
  const servings    = data.servings    || data['Servings']             || '';
  const difficulty  = data.difficulty  || data['Difficulty']           || 'Easy';
  const ingredients = data.ingredients || data['Ingredients']          || '';
  const steps       = data.steps       || data['Steps / Method']       || '';
  const howToServe  = data.howToServe  || data['How to Serve']         || '';
  const chefsNote   = data.chefsNote   || data["Chef's Note"]          || '';
  const coverImage  = data.coverImage  || data['Cover Photo']          || '';
  const dietaryTags = data.dietaryTags || data['Dietary Tags']         || '';
  const tags        = Array.isArray(data.tags) ? data.tags : (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const emoji       = data.emoji || '🍽️';

  const unescape = s => s.replace(/\\n/g, '\n');
  const ingredientsClean = unescape(ingredients);
  const stepsClean = unescape(steps);

  const slug = data.slug || slugify(title);

  // Convert the cover URL ONCE, reuse everywhere (page img, og:image, JSON).
  const coverUrl = toImageUrl(coverImage);

  const templatePath = path.join(__dirname, 'template.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // NOTE: replacement values are passed via a function so a literal "$"
  // in user text can't be interpreted as a regex replacement token.
  const set = (tpl, token, value) => tpl.replace(token, () => value);

  html = set(html, /{{RECIPE_TITLE}}/g, esc(title));
  html = set(html, /{{RECIPE_DESCRIPTION}}/g, esc(description));
  html = set(html, /{{RECIPE_CATEGORY}}/g, esc(category));
  html = set(html, /{{PREP_TIME}}/g, esc(prepTime));
  html = set(html, /{{COOK_TIME}}/g, esc(cookTime));
  html = set(html, /{{SERVINGS}}/g, esc(servings));
  html = set(html, /{{DIFFICULTY}}/g, esc(difficulty));
  html = set(html, /{{RECIPE_COVER_IMAGE}}/g, esc(coverUrl));   // og:image now uses the CONVERTED url
  html = set(html, /{{COVER_IMAGE_HTML}}/g, coverImageHtml(coverUrl));
  html = set(html, /{{INGREDIENTS_HTML}}/g, parseIngredients(ingredientsClean));
  html = set(html, /{{STEPS_HTML}}/g, parseSteps(stepsClean));
  html = set(html, /{{HOW_TO_SERVE_HTML}}/g, parseHowToServe(howToServe));
  html = set(html, /{{CHEFS_NOTE_HTML}}/g, parseChefsNote(chefsNote));

  const recipesDir = path.join(__dirname, 'recipes');
  if (!fs.existsSync(recipesDir)) fs.mkdirSync(recipesDir);
  const outputPath = path.join(recipesDir, `${slug}.html`);
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`✅ Recipe page written: recipes/${slug}.html`);

  const rootIndexPath = path.join(__dirname, 'recipes.json');
  const publicIndexPath = path.join(__dirname, 'public', 'recipes.json');

  let existing = [];
  if (fs.existsSync(rootIndexPath)) {
    try { existing = JSON.parse(fs.readFileSync(rootIndexPath, 'utf8')); } catch(e) {}
  }

  existing = existing.filter(r => r.slug !== slug);
  const entry = { title, slug, description, category, prepTime, cookTime, servings, difficulty, coverImage: coverUrl, tags, emoji, dietaryTags };
  existing.unshift(entry);

  const json = JSON.stringify(existing, null, 2);
  fs.writeFileSync(rootIndexPath, json, 'utf8');
  if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'));
  fs.writeFileSync(publicIndexPath, json, 'utf8');
  console.log(`✅ recipes.json updated (${existing.length} recipes)`);

  return { slug, path: `recipes/${slug}.html` };
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node generate-recipe.js \'{"title":"..."}\'');
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

module.exports = { generateRecipe, slugify, toImageUrl, extractDriveId };
