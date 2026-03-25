import React from 'react';
import { useImageUrl } from '../../hooks/useImageUrl';

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
    return (
      <p style={{ margin: 0, lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-wrap' }}>
        {block.text}
      </p>
    );
  }

  if (block.type === 'image') {
    // Prefer new imagePath field; fall back to legacy storagePath for existing data
    const imageSrc = block.imagePath || block.storagePath || null;
    if (!imageSrc) return null;
    return <RenderedImage src={imageSrc} alt={block.alt} caption={block.caption} />;
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
