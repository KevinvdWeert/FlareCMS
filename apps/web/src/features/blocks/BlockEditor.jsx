import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { v4 as uuidv4 } from 'uuid';
import { uploadImageToServer } from '../../lib/storage';
import { Type, Image as ImageIcon, Heading1, Trash, ArrowUp, ArrowDown, Quote, Minus, Images } from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal';

// ---------------------------------------------------------------------------
// QuillEditor — Quill-powered rich-text paragraph editor
// ---------------------------------------------------------------------------

const QUILL_TOOLBAR_OPTIONS = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];

// Quill 2.x renders an empty editor as a single paragraph with a soft-break.
const QUILL_EMPTY_HTML = '<p><br></p>';

const QuillEditor = ({ initialHtml, onChange }) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder: 'Paragraph text…',
      modules: {
        toolbar: QUILL_TOOLBAR_OPTIONS,
      },
    });

    // Seed with existing content (HTML from saved block data).
    if (initialHtml) {
      const delta = quill.clipboard.convert({ html: initialHtml });
      quill.setContents(delta, 'silent');
    }

    quill.on('text-change', () => {
      // Emit empty string when the editor only contains the empty Quill paragraph.
      const html = quill.getSemanticHTML();
      onChange?.(html === QUILL_EMPTY_HTML ? '' : html);
    });

    quillRef.current = quill;

    return () => {
      // Clean up: remove the Quill-generated toolbar sibling before React
      // unmounts the container so we don't leave orphaned DOM nodes.
      const toolbar = quillRef.current?.getModule('toolbar');
      toolbar?.container?.remove();
      quillRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="quill-editor-wrap" ref={containerRef} />;
};

// ---------------------------------------------------------------------------
// BlockEditor
// ---------------------------------------------------------------------------

export const BlockEditor = ({ blocks, setBlocks }) => {
  const [pathError, setPathError] = useState('');
  const [uploadingBlockId, setUploadingBlockId] = useState('');
  const [mediaPickerBlockIndex, setMediaPickerBlockIndex] = useState(null);

  const addBlock = (type) => {
    const newBlock = { id: uuidv4(), type };
    if (type === 'heading') {
      newBlock.level = 2; // Default to H2 — H1 is reserved for the page title
      newBlock.text = '';
    } else if (type === 'paragraph') {
      newBlock.text = '';
    } else if (type === 'image') {
      newBlock.imageId = '';
      newBlock.imagePath = '';
      newBlock.alt = '';
      newBlock.caption = '';
    } else if (type === 'quote') {
      newBlock.text = '';
      newBlock.attribution = '';
    }
    // 'divider' has no extra fields
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (index, field, value) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    setBlocks(newBlocks);
  };

  const removeBlock = (index) => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Delete this block?')) {
      const newBlocks = [...blocks];
      newBlocks.splice(index, 1);
      setBlocks(newBlocks);
    }
  };

  const moveBlock = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === blocks.length - 1) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  const handleImageUpload = async (index, file) => {
    setPathError('');
    if (!file) return;
    const blockId = blocks[index]?.id;
    setUploadingBlockId(blockId || '');
    try {
      const uploaded = await uploadImageToServer(file);
      const normalizedPath = String(uploaded.path || '').replace(/^\//, '');
      const newBlocks = [...blocks];
      newBlocks[index] = {
        ...newBlocks[index],
        storagePath: normalizedPath,
        imagePath: normalizedPath,
        imageId: '',
        alt: newBlocks[index].alt || uploaded.fileName || file.name || '',
      };
      setBlocks(newBlocks);
    } catch (err) {
      console.error('Block image upload failed:', err);
      setPathError(err?.message || 'Image upload failed.');
    } finally {
      setUploadingBlockId('');
    }
  };

  const handleMediaPickerSelect = (asset) => {
    const index = mediaPickerBlockIndex;
    setMediaPickerBlockIndex(null);
    if (index === null || !asset) return;
    const normalizedPath = String(asset.storagePath || '').replace(/^\//, '');
    const newBlocks = [...blocks];
    newBlocks[index] = {
      ...newBlocks[index],
      storagePath: normalizedPath,
      imagePath: normalizedPath,
      imageId: asset.id || '',
      alt: newBlocks[index].alt || asset.fileName || normalizedPath.split('/').pop() || '',
    };
    setBlocks(newBlocks);
  };

  const blockTypeLabel = (type) => {
    switch (type) {
      case 'heading':   return 'Heading Block';
      case 'paragraph': return 'Paragraph Block';
      case 'image':     return 'Image Block';
      case 'quote':     return 'Quote Block';
      case 'divider':   return 'Divider Block';
      default:          return 'Block';
    }
  };

  return (
    <div className="block-editor">
      {/* Block-type toolbar */}
      <div className="block-toolbar">
        <button onClick={() => addBlock('heading')} className="block-toolbar-btn" type="button">
          <Heading1 size={16} /> Heading
        </button>
        <button onClick={() => addBlock('paragraph')} className="block-toolbar-btn" type="button">
          <Type size={16} /> Paragraph
        </button>
        <button onClick={() => addBlock('quote')} className="block-toolbar-btn" type="button">
          <Quote size={16} /> Quote
        </button>
        <button onClick={() => addBlock('image')} className="block-toolbar-btn" type="button">
          <ImageIcon size={16} /> Image
        </button>
        <button onClick={() => addBlock('divider')} className="block-toolbar-btn" type="button">
          <Minus size={16} /> Divider
        </button>
      </div>

      {pathError && (
        <div className="admin-editor-error" style={{ marginBottom: '10px' }}>{pathError}</div>
      )}

      <div className="block-list">
        {blocks.map((block, index) => (
          <div key={block.id} className="block-item">
            <div className="block-item-actions">
              <button disabled={index === 0} onClick={() => moveBlock(index, -1)} className="block-icon-btn" type="button"><ArrowUp size={14} /></button>
              <button disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} className="block-icon-btn" type="button"><ArrowDown size={14} /></button>
              <button onClick={() => removeBlock(index)} className="block-icon-btn danger" type="button"><Trash size={14} /></button>
            </div>

            <div className="block-type-label">{blockTypeLabel(block.type)}</div>

            {/* Heading */}
            {block.type === 'heading' && (
              <div className="block-form-row">
                <select value={block.level} onChange={(e) => updateBlock(index, 'level', parseInt(e.target.value, 10))} className="block-input">
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
                <input
                  type="text"
                  value={block.text}
                  onChange={(e) => updateBlock(index, 'text', e.target.value)}
                  placeholder="Heading text…"
                  className="block-input block-input-grow"
                />
              </div>
            )}

            {/* Paragraph — Quill rich-text editor */}
            {block.type === 'paragraph' && (
              <QuillEditor
                key={block.id}
                initialHtml={block.text || ''}
                onChange={(html) => updateBlock(index, 'text', html)}
              />
            )}

            {/* Quote */}
            {block.type === 'quote' && (
              <div className="block-form-column">
                <textarea
                  value={block.text || ''}
                  onChange={(e) => updateBlock(index, 'text', e.target.value)}
                  placeholder="Quote text…"
                  className="block-input block-input-grow block-textarea"
                />
                <input
                  type="text"
                  value={block.attribution || ''}
                  onChange={(e) => updateBlock(index, 'attribution', e.target.value)}
                  placeholder="Attribution — Author or Source (optional)"
                  className="block-input block-input-grow"
                />
              </div>
            )}

            {/* Divider */}
            {block.type === 'divider' && (
              <div className="block-divider-preview" aria-hidden="true">
                <hr className="block-divider-line" />
                <span className="block-type-label" style={{ display: 'block', textAlign: 'center', marginTop: '6px' }}>
                  Section Separator
                </span>
              </div>
            )}

            {/* Image */}
            {block.type === 'image' && (
              <div className="block-form-column">
                {/* Upload or pick from library */}
                {!block.storagePath && (
                  <div className="block-image-actions">
                    <label className="block-image-upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        className="block-image-file-input"
                        onChange={(e) => {
                          handleImageUpload(index, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                        disabled={uploadingBlockId === block.id}
                      />
                      <span className="block-toolbar-btn">
                        <ImageIcon size={14} />
                        {uploadingBlockId === block.id ? ' Uploading…' : ' Upload Image'}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="block-toolbar-btn"
                      onClick={() => setMediaPickerBlockIndex(index)}
                      disabled={uploadingBlockId === block.id}
                    >
                      <Images size={14} /> Browse Library
                    </button>
                  </div>
                )}

                {uploadingBlockId === block.id && (
                  <p className="admin-muted-text">Uploading image…</p>
                )}

                {block.storagePath && (
                  <div className="block-image-meta">
                    <img
                      src={`/${block.storagePath.replace(/^\/+/, '')}`}
                      alt={block.alt || ''}
                      style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px', display: 'block' }}
                    />
                    <p><strong>Path:</strong> /{block.storagePath}</p>
                    <button
                      type="button"
                      className="block-icon-btn"
                      style={{ marginTop: '6px' }}
                      onClick={() => {
                        const newBlocks = [...blocks];
                        newBlocks[index] = { ...newBlocks[index], imageId: '', imagePath: '', storagePath: '', alt: '' };
                        setBlocks(newBlocks);
                      }}
                    >
                      Replace image
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  value={block.alt || ''}
                  onChange={(e) => updateBlock(index, 'alt', e.target.value)}
                  placeholder="Alt text…"
                  className="block-input block-input-grow"
                />
                <input
                  type="text"
                  value={block.caption || ''}
                  onChange={(e) => updateBlock(index, 'caption', e.target.value)}
                  placeholder="Optional caption…"
                  className="block-input block-input-grow"
                />
              </div>
            )}
          </div>
        ))}

        {blocks.length === 0 && (
          <div className="block-empty-state">
            No blocks added yet. Use the buttons above to add content.
          </div>
        )}
      </div>

      {/* Media Picker Modal */}
      {mediaPickerBlockIndex !== null && (
        <MediaPickerModal
          onSelect={handleMediaPickerSelect}
          onClose={() => setMediaPickerBlockIndex(null)}
        />
      )}
    </div>
  );
};

