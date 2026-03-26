#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'apps', 'web', 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const SERVICE_KEY_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  path.join(__dirname, 'serviceAccountKey.json');

const SITE_URL = String(process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://example.com').replace(/\/+$/, '');

const DEFAULT_TITLE = 'FlareCMS';
const DEFAULT_DESCRIPTION = 'FlareCMS is a fast, modern editorial CMS powered by React and Firebase.';

const htmlEscape = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const normalizeRoutePath = (slug) => {
  const safe = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  return safe ? `/${safe}` : '/';
};

const textFromBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return '';
  const merged = blocks
    .map((b) => `${b?.text || ''} ${b?.caption || ''}`.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return merged.slice(0, 160);
};

const absoluteAssetUrl = (assetPath) => {
  const raw = String(assetPath || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE_URL}/${raw.replace(/^\/+/, '')}`;
};

const injectSeo = ({ template, title, description, canonicalUrl, ogImageUrl, ogType }) => {
  const safeTitle = htmlEscape(title || DEFAULT_TITLE);
  const safeDescription = htmlEscape(description || DEFAULT_DESCRIPTION);
  const safeCanonical = htmlEscape(canonicalUrl || SITE_URL);
  const safeOgImage = htmlEscape(ogImageUrl || '');
  const typeValue = htmlEscape(ogType || 'website');

  const metaTags = [
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDescription}">`,
    `<link rel="canonical" href="${safeCanonical}">`,
    `<meta property="og:title" content="${safeTitle}">`,
    `<meta property="og:description" content="${safeDescription}">`,
    `<meta property="og:type" content="${typeValue}">`,
    `<meta property="og:url" content="${safeCanonical}">`,
    safeOgImage ? `<meta property="og:image" content="${safeOgImage}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${safeTitle}">`,
    `<meta name="twitter:description" content="${safeDescription}">`,
    safeOgImage ? `<meta name="twitter:image" content="${safeOgImage}">` : '',
  ].filter(Boolean).join('\n    ');

  const withoutTitle = template.replace(/<title>[\s\S]*?<\/title>/i, '');
  const marker = '</head>';
  const idx = withoutTitle.indexOf(marker);
  if (idx === -1) {
    return withoutTitle;
  }

  return `${withoutTitle.slice(0, idx)}    ${metaTags}\n${withoutTitle.slice(idx)}`;
};

const writeHtmlForRoute = ({ routePath, html }) => {
  const normalized = normalizeRoutePath(routePath);

  if (normalized === '/') {
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf8');
    return;
  }

  const routeDir = path.join(DIST_DIR, normalized.slice(1));
  ensureDir(routeDir);
  fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
};

const writeSitemap = (routes) => {
  const urls = Array.from(new Set(routes.map((r) => normalizeRoutePath(r))));
  const body = urls
    .map((route) => `  <url><loc>${htmlEscape(`${SITE_URL}${route}`)}</loc></url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), xml, 'utf8');
};

const writeRobots = () => {
  const txt = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), txt, 'utf8');
};

const initAdmin = () => {
  if (getApps().length) return;

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp();
    return;
  }

  if (!fs.existsSync(SERVICE_KEY_PATH)) {
    console.warn('[seo] No service account key found. Skipping Firestore-backed prerender routes.');
    return;
  }

  initializeApp({ credential: cert(SERVICE_KEY_PATH) });
};

const fetchSeoPages = async () => {
  try {
    initAdmin();
    if (!getApps().length) {
      return { pages: [], frontPageId: null };
    }

    const db = getFirestore();
    const pagesSnap = await db.collection('pages').where('status', '==', 'published').get();
    const pages = pagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let frontPageId = null;
    const explicitFront = pages.find((p) => p.isHomepage === true);
    if (explicitFront) {
      frontPageId = explicitFront.id;
    } else {
      const settingsSnap = await db.collection('settings').doc('general').get();
      frontPageId = settingsSnap.exists ? settingsSnap.data()?.frontPageId || null : null;
    }

    return { pages, frontPageId };
  } catch (err) {
    console.warn('[seo] Failed to fetch Firestore pages. Continuing with base route only.');
    console.warn('[seo] Reason:', err?.message || err);
    return { pages: [], frontPageId: null };
  }
};

const run = async () => {
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    throw new Error(`Missing build artifact: ${INDEX_HTML_PATH}. Run web build first.`);
  }

  const template = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const { pages, frontPageId } = await fetchSeoPages();

  const frontPage = pages.find((p) => p.id === frontPageId) || pages.find((p) => p.isHomepage === true) || null;
  const frontTitle = frontPage?.seoMetadata?.metaTitle || frontPage?.title || DEFAULT_TITLE;
  const frontDescription = frontPage?.seoMetadata?.metaDescription || textFromBlocks(frontPage?.blocks) || DEFAULT_DESCRIPTION;
  const frontImage = absoluteAssetUrl(
    frontPage?.featuredImagePath || frontPage?.featuredImage?.storagePath || frontPage?.featuredImage?.path || ''
  );

  const homeHtml = injectSeo({
    template,
    title: frontTitle,
    description: frontDescription,
    canonicalUrl: `${SITE_URL}/`,
    ogImageUrl: frontImage,
    ogType: 'website',
  });

  writeHtmlForRoute({ routePath: '/', html: homeHtml });

  const routes = ['/'];
  pages.forEach((page) => {
    const slug = String(page.slug || '').trim();
    if (!slug) return;

    const routePath = normalizeRoutePath(slug);
    routes.push(routePath);

    const pageTitle = page?.seoMetadata?.metaTitle || page.title || DEFAULT_TITLE;
    const pageDescription = page?.seoMetadata?.metaDescription || textFromBlocks(page.blocks) || DEFAULT_DESCRIPTION;
    const pageImage = absoluteAssetUrl(
      page?.featuredImagePath || page?.featuredImage?.storagePath || page?.featuredImage?.path || ''
    );

    const html = injectSeo({
      template,
      title: pageTitle,
      description: pageDescription,
      canonicalUrl: `${SITE_URL}${routePath}`,
      ogImageUrl: pageImage,
      ogType: 'article',
    });

    writeHtmlForRoute({ routePath, html });
  });

  writeSitemap(routes);
  writeRobots();

  console.log(`[seo] Generated prerendered routes: ${Array.from(new Set(routes)).length}`);
  console.log('[seo] Wrote dist/sitemap.xml and dist/robots.txt');
};

run().catch((err) => {
  console.error('[seo] Generation failed:', err?.message || err);
  process.exit(1);
});
