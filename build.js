#!/usr/bin/env node
/**
 * Fork & Float — recipe build step.
 *
 * Reads every recipe written by Sveltia CMS in content/recipes/*.md,
 * fills template.html, and writes:
 *   - recipes/<slug>.html      (one page per recipe)
 *   - recipes.json             (index used by the homepage grid)
 *   - public/recipes.json      (copy, kept for compatibility)
 *
 * Run with:  node build.js
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content', 'recipes');
const RECIPES_OUT = path.join(ROOT, 'recipes');
const TEMPLATE = path.join(ROOT, 'template.html');
const SITE_URL = 'https://recipes.forkandfloat.com';

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Google Drive share links -> directly embeddable image URL
function driveToDirect(url) {
  if (!url) return url;
  const s = String(url);
  if (s.includes('drive.google.com')) {
    const m = s.match(/id=([^&]+)/) || s.match(/\/d\/([^/]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  return s;
}

function coverImageHtml(url) {
  if (!url || !String(url).trim()) return '<div class="cover-placeholder">🍽️</div>';
  const src = driveToDirect(String(url).trim());
  return `<img class="cover-img" src="${esc(src)}" alt="Recipe cover photo">`;
}

// og:image wants a full, absolute URL
function ogImage(url) {
  if (!url || !String(url).trim()) return '';
  let src = driveToDirect(String(url).trim());
  if (src.startsWith('/')) src = SITE_URL + src; // local CMS upload
  return esc(src);
}

function ingredientsHtml(list = []) {
  return (list || []).map((it) => {
    const name = esc(it.name || '');
    const amount = (it.amount || '').toString().trim();
    return amount
      ? `<li><span>${name}</span><strong>${esc(amount)}</strong></li>`
      : `<li><span>${name}</span></li>`;
  }).join('\n        ');
}

function stepsHtml(list = []) {
  return (list || []).map((st) => {
    const title = esc(st.title || '');
    const body = (st.body || '').toString().trim();
    return `<li>
          ${title ? `<h3>${title}</h3>` : ''}
          ${body ? `<p>${esc(body)}</p>` : ''}
        </li>`;
  }).join('\n        ');
}

function howToServeHtml(list = []) {
  const items = (list || []).map((x) => (x || '').toString().trim()).filter(Boolean);
  if (!items.length) return '';
  const lis = items.map((i) => `<li>${esc(i)}</li>`).join('\n          ');
  return `
    <div class="how-to-serve">
      <span class="serve-label">How to Serve</span>
      <div class="serve-rich"><ul>${lis}</ul></div>
    </div>`;
}

function chefsNoteHtml(note) {
  if (!note || !note.toString().trim()) return '';
  return `
    <div class="chef-note">
      <span class="chef-note-label">Ava's note</span>
      <p>"${esc(note.toString().trim())}"</p>
    </div>`;
}

function build() {
  const template = fs.readFileSync(TEMPLATE, 'utf8');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content/recipes directory yet — nothing to build.');
    fs.writeFileSync(path.join(ROOT, 'recipes.json'), '[]', 'utf8');
    return;
  }

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  if (!fs.existsSync(RECIPES_OUT)) fs.mkdirSync(RECIPES_OUT, { recursive: true });

  const index = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
    const difficulty = data.difficulty || 'Easy';
    const coverImage = data.coverImage || '';

    const html = template
      .replace(/\{\{RECIPE_TITLE\}\}/g, esc(data.title || ''))
      .replace(/\{\{RECIPE_DESCRIPTION\}\}/g, esc(data.description || ''))
      .replace(/\{\{RECIPE_CATEGORY\}\}/g, esc(data.category || ''))
      .replace(/\{\{PREP_TIME\}\}/g, esc(data.prepTime || ''))
      .replace(/\{\{COOK_TIME\}\}/g, esc(data.cookTime || ''))
      .replace(/\{\{SERVINGS\}\}/g, esc(data.servings || ''))
      .replace(/\{\{DIFFICULTY\}\}/g, esc(difficulty))
      .replace(/\{\{RECIPE_COVER_IMAGE\}\}/g, ogImage(coverImage))
      .replace(/\{\{COVER_IMAGE_HTML\}\}/g, coverImageHtml(coverImage))
      .replace(/\{\{INGREDIENTS_HTML\}\}/g, ingredientsHtml(data.ingredients))
      .replace(/\{\{STEPS_HTML\}\}/g, stepsHtml(data.steps))
      .replace(/\{\{HOW_TO_SERVE_HTML\}\}/g, howToServeHtml(data.howToServe))
      .replace(/\{\{CHEFS_NOTE_HTML\}\}/g, chefsNoteHtml(data.chefsNote));

    fs.writeFileSync(path.join(RECIPES_OUT, `${slug}.html`), html, 'utf8');

    const cardImg = coverImageHtml(coverImage).match(/src="([^"]+)"/);
    index.push({
      title: data.title || '',
      slug,
      description: data.description || '',
      category: data.category || '',
      prepTime: data.prepTime || '',
      cookTime: data.cookTime || '',
      servings: data.servings || '',
      difficulty,
      coverImage: cardImg ? cardImg[1] : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      emoji: data.emoji || '🍽️',
      dietaryTags: data.dietaryTags || '',
      date: data.date || null,
    });
  }

  // Newest first (drives the "New" badge on the homepage)
  index.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const json = JSON.stringify(index, null, 2);
  fs.writeFileSync(path.join(ROOT, 'recipes.json'), json, 'utf8');
  const pub = path.join(ROOT, 'public');
  if (!fs.existsSync(pub)) fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, 'recipes.json'), json, 'utf8');

  console.log(`✅ Built ${index.length} recipe page(s) + recipes.json`);
}

build();
