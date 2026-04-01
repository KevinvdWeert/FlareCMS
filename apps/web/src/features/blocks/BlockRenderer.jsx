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
// Video URL parser — converts watch URLs to embeddable iframes
// ---------------------------------------------------------------------------

const getVideoEmbedUrl = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);

    // YouTube: youtube.com/watch?v=ID or youtu.be/ID
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo: vimeo.com/ID
    if (u.hostname === 'vimeo.com' || u.hostname === 'www.vimeo.com') {
      const id = u.pathname.replace('/', '');
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // Invalid URL — ignore
  }
  return null;
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
  // ── Heading ──────────────────────────────────────────────────────────────
  if (block.type === 'heading') {
    const Tag = `h${block.level || 1}`;
    return <Tag style={{ margin: '0' }}>{block.text}</Tag>;
  }

  // ── Paragraph ────────────────────────────────────────────────────────────
  if (block.type === 'paragraph') {
    const text = block.text || '';
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

  // ── Quote ────────────────────────────────────────────────────────────────
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

  // ── Divider ──────────────────────────────────────────────────────────────
  if (block.type === 'divider') {
    return (
      <hr style={{ border: 'none', borderTop: '1px solid #e2e0d4', margin: '8px 0' }} />
    );
  }

  // ── Image ────────────────────────────────────────────────────────────────
  if (block.type === 'image') {
    const imageSrc = block.imagePath || block.storagePath || null;
    if (!imageSrc) return null;
    const imageAlt = block.alt || block.imageAlt || block.image?.alt || '';
    return <RenderedImage src={imageSrc} alt={imageAlt} caption={block.caption} />;
  }

  // ── Video Embed ──────────────────────────────────────────────────────────
  if (block.type === 'video') {
    const embedUrl = getVideoEmbedUrl(block.url);
    if (!embedUrl) {
      return (
        <div className="rendered-video-placeholder">
          <p>No valid YouTube or Vimeo URL provided.</p>
        </div>
      );
    }
    return (
      <figure style={{ margin: 0 }}>
        <div className="rendered-video-wrapper">
          <iframe
            src={embedUrl}
            title={block.caption || 'Embedded video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        {block.caption && (
          <figcaption style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '10px' }}>
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // ── Code Block ───────────────────────────────────────────────────────────
  if (block.type === 'code') {
    return (
      <figure style={{ margin: 0 }}>
        {block.language && block.language !== 'plain' && (
          <div className="rendered-code-lang">{block.language}</div>
        )}
        <pre className="rendered-code-block">
          <code>{block.code || ''}</code>
        </pre>
      </figure>
    );
  }

  // ── Callout ──────────────────────────────────────────────────────────────
  if (block.type === 'callout') {
    const variant = block.variant || 'info';
    return (
      <div className={`rendered-callout rendered-callout--${variant}`}>
        {block.title && <p className="rendered-callout-title">{block.title}</p>}
        <p className="rendered-callout-text" style={{ whiteSpace: 'pre-wrap' }}>{block.text || ''}</p>
      </div>
    );
  }

  // ── Button / CTA ─────────────────────────────────────────────────────────
  if (block.type === 'button') {
    if (!block.url || !block.label) return null;
    const isExternal = block.target === '_blank';
    return (
      <div style={{ display: 'flex' }}>
        <a
          href={block.url}
          target={block.target || '_self'}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className={`rendered-btn rendered-btn--${block.variant || 'primary'}`}
        >
          {block.label}
        </a>
      </div>
    );
  }

  // ── Spacer ───────────────────────────────────────────────────────────────
  if (block.type === 'spacer') {
    const heights = { small: 24, medium: 48, large: 96 };
    const h = heights[block.size] ?? 48;
    return <div aria-hidden="true" style={{ height: `${h}px` }} />;
  }

  // ── Two-Column Layout ────────────────────────────────────────────────────
  if (block.type === 'columns') {
    const renderCol = (html) => {
      if (!html) return null;
      const isHtml = /<(b|i|em|strong|u|a|br|ul|ol|li|span|p)[\s/>]/i.test(html);
      if (isHtml) {
        return (
          <div
            style={{ lineHeight: '1.6', color: '#334155' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
          />
        );
      }
      return <p style={{ margin: 0, lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-wrap' }}>{html}</p>;
    };
    return (
      <div className="rendered-columns">
        <div className="rendered-columns-col">{renderCol(block.leftText)}</div>
        <div className="rendered-columns-col">{renderCol(block.rightText)}</div>
      </div>
    );
  }

  // ── HTML Embed ───────────────────────────────────────────────────────────
  if (block.type === 'html') {
    if (!block.content) return null;
    return (
      // eslint-disable-next-line react/no-danger
      <div dangerouslySetInnerHTML={{ __html: block.content }} />
    );
  }

  // ── File Download ────────────────────────────────────────────────────────
  if (block.type === 'file') {
    if (!block.url) return null;
    return (
      <div className="rendered-file">
        <div className="rendered-file-icon" aria-hidden="true">↓</div>
        <div className="rendered-file-info">
          <a
            href={block.url}
            download
            className="rendered-file-link"
            rel="noopener noreferrer"
          >
            {block.label || 'Download file'}
          </a>
          {block.description && (
            <p className="rendered-file-desc">{block.description}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Accordion / FAQ ──────────────────────────────────────────────────────
  if (block.type === 'accordion') {
    return (
      <details className="rendered-accordion">
        <summary className="rendered-accordion-question">
          {block.question || 'Question'}
        </summary>
        <div className="rendered-accordion-answer" style={{ whiteSpace: 'pre-wrap' }}>
          {block.answer || ''}
        </div>
      </details>
    );
  }

  // ── Card ─────────────────────────────────────────────────────────────────
  if (block.type === 'card') {
    return (
      <div className="rendered-card">
        {block.heading && <h3 className="rendered-card-heading">{block.heading}</h3>}
        {block.body && <p className="rendered-card-body">{block.body}</p>}
        {block.linkUrl && block.linkLabel && (
          <a href={block.linkUrl} className="rendered-card-link">
            {block.linkLabel} →
          </a>
        )}
      </div>
    );
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
