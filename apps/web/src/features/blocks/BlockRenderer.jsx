import React, { useEffect, useState } from 'react';
import { getImageUrl } from '../../lib/storage';

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
    if (!block.storagePath) return null;
    return <RenderedImage block={block} />;
  }

  return null;
};

// Extracted component to handle async image url fetching
const RenderedImage = ({ block }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const downloadUrl = await getImageUrl(block.storagePath);
        setUrl(downloadUrl);
      } catch (err) {
        console.error("Failed to load image", err);
      }
    };
    fetchUrl();
  }, [block.storagePath]);

  if (!url) return <div style={{ background: '#f1f5f9', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading image...</div>;

  return (
    <figure style={{ margin: 0 }}>
      <img src={url} alt={block.alt || ''} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
      {block.caption && <figcaption style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '10px' }}>{block.caption}</figcaption>}
    </figure>
  );
};
