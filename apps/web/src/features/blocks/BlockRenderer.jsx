import React from 'react';
import { useImageUrl } from '../../hooks/useImageUrl';

// ---------------------------------------------------------------------------
// HTML sanitizer (DOM-based, allow-list, no extra dependencies)
// ---------------------------------------------------------------------------

const SAFE_TAGS = new Set(['b', 'i', 'em', 'strong', 'u', 'a', 'br', 'ul', 'ol', 'li', 'span', 'p']);

/**
 * Strips disallowed elements and unsafe attributes from rich-text HTML.
 * Runs client-side using the browser's DOM parser; returns the original
 * string unchanged in non-browser environments (SSR/tests).
 */
const sanitizeRichText = (html) => {
  if (!html) return '';
  if (typeof document === 'undefined') return html;

  const root = document.createElement('div');
  root.innerHTML = html;

  const clean = (node) => {
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i];
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = child.tagName.toLowerCase();

      if (!SAFE_TAGS.has(tag)) {
        // Unwrap: replace the element with its children so text is kept
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        node.replaceChild(frag, child);
        continue;
      }

      // Strip all attributes, keeping only href/target/rel on <a>
      for (const attr of [...child.attributes]) {
        if (tag === 'a' && (attr.name === 'href' || attr.name === 'target' || attr.name === 'rel')) {
          if (attr.name === 'href') {
            const v = (attr.value || '').trim().toLowerCase();
            // Allow-list safe protocols; reject everything else (javascript:,
            // vbscript:, data:, and any other potentially executable scheme).
            const isSafe =
              v.startsWith('http:') ||
              v.startsWith('https:') ||
              v.startsWith('mailto:') ||
              v.startsWith('#') ||
              v.startsWith('/');
            if (!isSafe) {
              child.removeAttribute('href');
            }
          }
        } else {
          child.removeAttribute(attr.name);
        }
      }

      // Ensure external links can't hijack the parent tab
      if (tag === 'a' && child.getAttribute('target') === '_blank') {
        child.setAttribute('rel', 'noopener noreferrer');
      }

      clean(child);
    }
  };

  clean(root);
  return root.innerHTML;
};

// ---------------------------------------------------------------------------
// BlockRenderer
// ---------------------------------------------------------------------------

export const BlockRenderer = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="blocks-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {blocks.map((block) => (
        <Block key={block.id} block={block} />
      ))}
    </div>
  );
};

const Block = ({ block }) => {
  if (block.type === 'heading') {
    const Tag = `h${block.level || 1}`;
    return <Tag style={{ margin: '0' }}>{block.text}</Tag>;
  }

  if (block.type === 'paragraph') {
    const text = block.text || '';
    // Detect rich-text HTML by looking specifically for the formatting tags
    // produced by the RichTextEditor (execCommand output).  A plain-text
    // comparison string such as "a < b > c" does NOT match this pattern.
    const isHtml = /<(b|i|em|strong|u|a|br|ul|ol|li|span|p)[\s/>]/i.test(text);
    if (isHtml) {
      return (
        <div
          style={{ margin: 0, lineHeight: '1.6', color: '#334155' }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }}
        />
      );
    }
    return (
      <p style={{ margin: 0, lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote style={{ margin: 0, padding: '12px 20px', borderLeft: '4px solid #7a542c', background: '#faf9f3', borderRadius: '0 6px 6px 0' }}>
        <p style={{ margin: 0, fontStyle: 'italic', lineHeight: '1.7', color: '#50453b', whiteSpace: 'pre-wrap' }}>
          {block.text || ''}
        </p>
        {block.attribution && (
          <footer style={{ marginTop: '8px', fontSize: '0.85rem', color: '#82756a', fontWeight: 600 }}>
            — {block.attribution}
          </footer>
        )}
      </blockquote>
    );
  }

  if (block.type === 'divider') {
    return (
      <hr style={{ border: 'none', borderTop: '1px solid #e2e0d4', margin: '8px 0' }} />
    );
  }

  if (block.type === 'image') {
    // Prefer new imagePath field; fall back to legacy storagePath for existing data
    const imageSrc = block.imagePath || block.storagePath || null;
    if (!imageSrc) return null;
    const imageAlt = block.alt || block.imageAlt || block.image?.alt || '';
    return <RenderedImage src={imageSrc} alt={imageAlt} caption={block.caption} />;
  }

  return null;
};

/**
 * Renders an image block.  Uses useImageUrl so that:
 *  - relative paths (/images/…) render directly
 *  - absolute URLs render directly
 *  - legacy Firebase Storage paths show a graceful placeholder
 */
const RenderedImage = ({ src, alt, caption }) => {
  const { url, error } = useImageUrl(src);

  if (error) {
    return (
      <div style={{ background: '#fee2e2', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '14px' }}>
        Image not available.
      </div>
    );
  }
  if (!url) {
    return (
      <div style={{ background: '#f1f5f9', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Loading image…
      </div>
    );
  }

  return (
    <figure style={{ margin: 0 }}>
      <img src={url} alt={alt || ''} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
      {caption && <figcaption style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '10px' }}>{caption}</figcaption>}
    </figure>
  );
};
