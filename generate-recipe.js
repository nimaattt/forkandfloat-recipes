#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
        return `<li><span>${match[1].trim()}</span><strong>${match[2].trim()}</strong></li>`;
      }
      return `<li><span>${line}</span></li>`;
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
          <h3>${title}</h3>
          ${body ? `<p>${body}</p>` : ''}
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
    .map(l => `<li>${l}</li>`)
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
      <p>"${raw.trim()}"</p>
    </div>`;
}

function parseCoverImage(url) {
  if (!url || !url.trim()) {
    return '<div class="cover-placeholder">🍽️</div>';
  }
  let src = url.trim();
  // Convert Google Drive share URL to embeddable thumbnail URL
  if (src.includes('drive.google.com')) {
    const idMatch = src.match(/id=([^&]+)/);
    if (idMatch) {
      src = `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }
  return `<img class="cover-img" src="${src}" alt="Recipe cover photo">`;
}

function generateRecipe(data) {
  // Accept both camelCase (from generate-recipe.js CLI) and
  // the exact field names as sent from Make.com / Google Sheets
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

  // Unescape \n back to real newlines (Make.com sends them escaped)
  const unescape = s => s.replace(/\\n/g, '\n');
  const ingredientsClean = unescape(ingredients);
  const stepsClean = unescape(steps);

  const slug = data.slug || slugify(title);

  const templatePath = path.join(__dirname, 'template.html');
  let html = fs.readFileSync(templatePath, 'utf8');

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
    .replace(/{{INGREDIENTS_HTML}}/g, parseIngredients(ingredientsClean))
    .replace(/{{STEPS_HTML}}/g, parseSteps(stepsClean))
    .replace(/{{HOW_TO_SERVE_HTML}}/g, parseHowToServe(howToServe))
    .replace(/{{CHEFS_NOTE_HTML}}/g, parseChefsNote(chefsNote));

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
  const entry = { title, slug, description, category, prepTime, cookTime, servings, difficulty, coverImage, tags, emoji, dietaryTags };
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

module.exports = { generateRecipe, slugify };
