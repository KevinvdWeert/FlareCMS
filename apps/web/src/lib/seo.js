const DEFAULT_TITLE = 'FlareCMS';
const DEFAULT_DESCRIPTION =
  'FlareCMS is a fast, modern editorial CMS powered by React and Firebase.';

const resolveAbsoluteUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw || typeof window === 'undefined') return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${window.location.origin}${raw}`;
  return raw;
};

const upsertMetaTag = ({ selector, attr, value, content }) => {
  if (typeof document === 'undefined') return;

  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content || '');
};

export const applySeo = ({ title, description, type = 'article', ogImage, faviconUrl } = {}) => {
  if (typeof document === 'undefined') return;

  const resolvedTitle = String(title || '').trim() || DEFAULT_TITLE;
  const resolvedDescription = String(description || '').trim() || DEFAULT_DESCRIPTION;
  const resolvedOgImage = resolveAbsoluteUrl(ogImage || '');
  const resolvedFavicon = resolveAbsoluteUrl(faviconUrl || '');

  document.title = resolvedTitle;

  upsertMetaTag({
    selector: 'meta[name="description"]',
    attr: 'name',
    value: 'description',
    content: resolvedDescription,
  });

  upsertMetaTag({
    selector: 'meta[property="og:title"]',
    attr: 'property',
    value: 'og:title',
    content: resolvedTitle,
  });

  upsertMetaTag({
    selector: 'meta[property="og:description"]',
    attr: 'property',
    value: 'og:description',
    content: resolvedDescription,
  });

  upsertMetaTag({
    selector: 'meta[property="og:type"]',
    attr: 'property',
    value: 'og:type',
    content: type,
  });

  upsertMetaTag({
    selector: 'meta[name="twitter:card"]',
    attr: 'name',
    value: 'twitter:card',
    content: 'summary_large_image',
  });

  upsertMetaTag({
    selector: 'meta[name="twitter:title"]',
    attr: 'name',
    value: 'twitter:title',
    content: resolvedTitle,
  });

  upsertMetaTag({
    selector: 'meta[name="twitter:description"]',
    attr: 'name',
    value: 'twitter:description',
    content: resolvedDescription,
  });

  if (resolvedOgImage) {
    upsertMetaTag({
      selector: 'meta[property="og:image"]',
      attr: 'property',
      value: 'og:image',
      content: resolvedOgImage,
    });

    upsertMetaTag({
      selector: 'meta[name="twitter:image"]',
      attr: 'name',
      value: 'twitter:image',
      content: resolvedOgImage,
    });
  }

  if (resolvedFavicon) {
    let icon = document.head.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.setAttribute('rel', 'icon');
      document.head.appendChild(icon);
    }
    icon.setAttribute('href', resolvedFavicon);
  }
};

export const fallbackDescriptionFromBlocks = (blocks = []) => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  const raw = blocks
    .map((b) => `${b?.text || ''} ${b?.caption || ''}`.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return '';
  return raw.slice(0, 160);
};
