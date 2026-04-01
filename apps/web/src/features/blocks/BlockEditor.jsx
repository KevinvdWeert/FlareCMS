import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { v4 as uuidv4 } from 'uuid';
import { uploadImageToServer } from '../../lib/storage';
import {
  Type, Image as ImageIcon, Heading1, Trash, ArrowUp, ArrowDown, Quote, Minus, Images,
  Video, Code, AlertCircle, Link, ArrowUpDown, LayoutGrid, Code2, Download, HelpCircle, CreditCard,
} from 'lucide-react';
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

const QuillEditor = ({ initialHtml, onChange, placeholder = 'Paragraph text…' }) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder,
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

const CODE_LANGUAGES = [
  { value: 'plain', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX / TSX' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'php', label: 'PHP' },
  { value: 'yaml', label: 'YAML' },
];

const CALLOUT_VARIANTS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
];

const BUTTON_VARIANTS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'outline', label: 'Outline' },
];

const SPACER_SIZES = [
  { value: 'small', label: 'Small (24 px)' },
  { value: 'medium', label: 'Medium (48 px)' },
  { value: 'large', label: 'Large (96 px)' },
];

export const BlockEditor = ({ blocks, setBlocks }) => {
  const [pathError, setPathError] = useState('');
  const [uploadingBlockId, setUploadingBlockId] = useState('');
  const [mediaPickerBlockIndex, setMediaPickerBlockIndex] = useState(null);

  const addBlock = (type) => {
    const newBlock = { id: uuidv4(), type };

    if (type === 'heading') {
      newBlock.level = 2;
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
    } else if (type === 'video') {
      newBlock.url = '';
      newBlock.caption = '';
    } else if (type === 'code') {
      newBlock.language = 'javascript';
      newBlock.code = '';
    } else if (type === 'callout') {
      newBlock.variant = 'info';
      newBlock.title = '';
      newBlock.text = '';
    } else if (type === 'button') {
      newBlock.label = '';
      newBlock.url = '';
      newBlock.target = '_self';
      newBlock.variant = 'primary';
    } else if (type === 'spacer') {
      newBlock.size = 'medium';
    } else if (type === 'columns') {
      newBlock.leftText = '';
      newBlock.rightText = '';
    } else if (type === 'html') {
      newBlock.content = '';
    } else if (type === 'file') {
      newBlock.url = '';
      newBlock.label = '';
      newBlock.description = '';
    } else if (type === 'accordion') {
      newBlock.question = '';
      newBlock.answer = '';
    } else if (type === 'card') {
      newBlock.heading = '';
      newBlock.body = '';
      newBlock.linkUrl = '';
      newBlock.linkLabel = '';
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
      case 'video':     return 'Video Embed Block';
      case 'code':      return 'Code Block';
      case 'callout':   return 'Callout Block';
      case 'button':    return 'Button / CTA Block';
      case 'spacer':    return 'Spacer Block';
      case 'columns':   return 'Two-Column Block';
      case 'html':      return 'HTML Embed Block';
      case 'file':      return 'File Download Block';
      case 'accordion': return 'Accordion / FAQ Block';
      case 'card':      return 'Card Block';
      default:          return 'Block';
    }
  };

  return (
    <div className="block-editor">
      {/* Block-type toolbar */}
      <div className="block-toolbar">
        {/* Text */}
        <button onClick={() => addBlock('heading')} className="block-toolbar-btn" type="button">
          <Heading1 size={16} /> Heading
        </button>
        <button onClick={() => addBlock('paragraph')} className="block-toolbar-btn" type="button">
          <Type size={16} /> Paragraph
        </button>
        <button onClick={() => addBlock('quote')} className="block-toolbar-btn" type="button">
          <Quote size={16} /> Quote
        </button>
        <button onClick={() => addBlock('code')} className="block-toolbar-btn" type="button">
          <Code size={16} /> Code
        </button>

        {/* Separtor */}
        <span className="block-toolbar-sep" aria-hidden="true" />

        {/* Media */}
        <button onClick={() => addBlock('image')} className="block-toolbar-btn" type="button">
          <ImageIcon size={16} /> Image
        </button>
        <button onClick={() => addBlock('video')} className="block-toolbar-btn" type="button">
          <Video size={16} /> Video
        </button>
        <button onClick={() => addBlock('file')} className="block-toolbar-btn" type="button">
          <Download size={16} /> File
        </button>

        {/* Separtor */}
        <span className="block-toolbar-sep" aria-hidden="true" />

        {/* Layout */}
        <button onClick={() => addBlock('divider')} className="block-toolbar-btn" type="button">
          <Minus size={16} /> Divider
        </button>
        <button onClick={() => addBlock('spacer')} className="block-toolbar-btn" type="button">
          <ArrowUpDown size={16} /> Spacer
        </button>
        <button onClick={() => addBlock('columns')} className="block-toolbar-btn" type="button">
          <LayoutGrid size={16} /> Columns
        </button>

        {/* Separtor */}
        <span className="block-toolbar-sep" aria-hidden="true" />

        {/* Content */}
        <button onClick={() => addBlock('callout')} className="block-toolbar-btn" type="button">
          <AlertCircle size={16} /> Callout
        </button>
        <button onClick={() => addBlock('button')} className="block-toolbar-btn" type="button">
          <Link size={16} /> Button
        </button>
        <button onClick={() => addBlock('card')} className="block-toolbar-btn" type="button">
          <CreditCard size={16} /> Card
        </button>
        <button onClick={() => addBlock('accordion')} className="block-toolbar-btn" type="button">
          <HelpCircle size={16} /> FAQ
        </button>
        <button onClick={() => addBlock('html')} className="block-toolbar-btn" type="button">
          <Code2 size={16} /> HTML
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

            {/* ── Heading ─────────────────────────────── */}
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

            {/* ── Paragraph — Quill rich-text editor ─── */}
            {block.type === 'paragraph' && (
              <QuillEditor
                key={block.id}
                initialHtml={block.text || ''}
                onChange={(html) => updateBlock(index, 'text', html)}
              />
            )}

            {/* ── Quote ───────────────────────────────── */}
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

            {/* ── Divider ─────────────────────────────── */}
            {block.type === 'divider' && (
              <div className="block-divider-preview" aria-hidden="true">
                <hr className="block-divider-line" />
                <span className="block-type-label" style={{ display: 'block', textAlign: 'center', marginTop: '6px' }}>
                  Section Separator
                </span>
              </div>
            )}

            {/* ── Image ───────────────────────────────── */}
            {block.type === 'image' && (
              <div className="block-form-column">
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

            {/* ── Video Embed ─────────────────────────── */}
            {block.type === 'video' && (
              <div className="block-form-column">
                <input
                  type="url"
                  value={block.url || ''}
                  onChange={(e) => updateBlock(index, 'url', e.target.value)}
                  placeholder="YouTube or Vimeo URL — e.g. https://www.youtube.com/watch?v=…"
                  className="block-input block-input-grow"
                />
                <input
                  type="text"
                  value={block.caption || ''}
                  onChange={(e) => updateBlock(index, 'caption', e.target.value)}
                  placeholder="Optional caption…"
                  className="block-input block-input-grow"
                />
                {block.url && (
                  <p className="block-video-hint">Preview will appear on the published page.</p>
                )}
              </div>
            )}

            {/* ── Code Block ──────────────────────────── */}
            {block.type === 'code' && (
              <div className="block-form-column">
                <select
                  value={block.language || 'plain'}
                  onChange={(e) => updateBlock(index, 'language', e.target.value)}
                  className="block-input"
                  style={{ width: 'fit-content' }}
                >
                  {CODE_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
                <textarea
                  value={block.code || ''}
                  onChange={(e) => updateBlock(index, 'code', e.target.value)}
                  placeholder="Paste or type your code here…"
                  className="block-input block-input-grow block-code-textarea"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </div>
            )}

            {/* ── Callout ─────────────────────────────── */}
            {block.type === 'callout' && (
              <div className="block-form-column">
                <div className="block-form-row">
                  <select
                    value={block.variant || 'info'}
                    onChange={(e) => updateBlock(index, 'variant', e.target.value)}
                    className="block-input"
                  >
                    {CALLOUT_VARIANTS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={block.title || ''}
                    onChange={(e) => updateBlock(index, 'title', e.target.value)}
                    placeholder="Callout title (optional)…"
                    className="block-input block-input-grow"
                  />
                </div>
                <textarea
                  value={block.text || ''}
                  onChange={(e) => updateBlock(index, 'text', e.target.value)}
                  placeholder="Callout body text…"
                  className="block-input block-input-grow block-textarea"
                />
                <div className={`block-callout-preview block-callout-preview--${block.variant || 'info'}`}>
                  {block.title && <strong className="block-callout-preview-title">{block.title}</strong>}
                  <span>{block.text || 'Callout text will appear here…'}</span>
                </div>
              </div>
            )}

            {/* ── Button / CTA ────────────────────────── */}
            {block.type === 'button' && (
              <div className="block-form-column">
                <div className="block-form-row">
                  <select
                    value={block.variant || 'primary'}
                    onChange={(e) => updateBlock(index, 'variant', e.target.value)}
                    className="block-input"
                  >
                    {BUTTON_VARIANTS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                  <select
                    value={block.target || '_self'}
                    onChange={(e) => updateBlock(index, 'target', e.target.value)}
                    className="block-input"
                  >
                    <option value="_self">Same tab</option>
                    <option value="_blank">New tab</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={block.label || ''}
                  onChange={(e) => updateBlock(index, 'label', e.target.value)}
                  placeholder="Button label…"
                  className="block-input block-input-grow"
                />
                <input
                  type="url"
                  value={block.url || ''}
                  onChange={(e) => updateBlock(index, 'url', e.target.value)}
                  placeholder="Button URL — https://…"
                  className="block-input block-input-grow"
                />
              </div>
            )}

            {/* ── Spacer ──────────────────────────────── */}
            {block.type === 'spacer' && (
              <div className="block-form-row" style={{ alignItems: 'center' }}>
                <select
                  value={block.size || 'medium'}
                  onChange={(e) => updateBlock(index, 'size', e.target.value)}
                  className="block-input"
                >
                  {SPACER_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <span className="block-spacer-preview" aria-hidden="true">
                  <span className={`block-spacer-indicator block-spacer-indicator--${block.size || 'medium'}`} />
                </span>
              </div>
            )}

            {/* ── Two-Column Layout ───────────────────── */}
            {block.type === 'columns' && (
              <div className="block-columns-editor">
                <div className="block-columns-editor-col">
                  <p className="block-columns-editor-label">Left column</p>
                  <QuillEditor
                    key={`${block.id}-left`}
                    initialHtml={block.leftText || ''}
                    onChange={(html) => updateBlock(index, 'leftText', html)}
                    placeholder="Left column text…"
                  />
                </div>
                <div className="block-columns-editor-col">
                  <p className="block-columns-editor-label">Right column</p>
                  <QuillEditor
                    key={`${block.id}-right`}
                    initialHtml={block.rightText || ''}
                    onChange={(html) => updateBlock(index, 'rightText', html)}
                    placeholder="Right column text…"
                  />
                </div>
              </div>
            )}

            {/* ── HTML Embed ──────────────────────────── */}
            {block.type === 'html' && (
              <div className="block-form-column">
                <p className="block-html-warning">
                  Raw HTML is rendered as-is on the published page. Only use trusted markup.
                </p>
                <textarea
                  value={block.content || ''}
                  onChange={(e) => updateBlock(index, 'content', e.target.value)}
                  placeholder="<div>Your HTML here…</div>"
                  className="block-input block-input-grow block-code-textarea"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </div>
            )}

            {/* ── File Download ───────────────────────── */}
            {block.type === 'file' && (
              <div className="block-form-column">
                <input
                  type="text"
                  value={block.label || ''}
                  onChange={(e) => updateBlock(index, 'label', e.target.value)}
                  placeholder="Download label — e.g. Annual Report 2024"
                  className="block-input block-input-grow"
                />
                <input
                  type="url"
                  value={block.url || ''}
                  onChange={(e) => updateBlock(index, 'url', e.target.value)}
                  placeholder="File URL — https://… or /files/…"
                  className="block-input block-input-grow"
                />
                <input
                  type="text"
                  value={block.description || ''}
                  onChange={(e) => updateBlock(index, 'description', e.target.value)}
                  placeholder="Short description (optional)…"
                  className="block-input block-input-grow"
                />
              </div>
            )}

            {/* ── Accordion / FAQ ─────────────────────── */}
            {block.type === 'accordion' && (
              <div className="block-form-column">
                <input
                  type="text"
                  value={block.question || ''}
                  onChange={(e) => updateBlock(index, 'question', e.target.value)}
                  placeholder="Question…"
                  className="block-input block-input-grow"
                />
                <textarea
                  value={block.answer || ''}
                  onChange={(e) => updateBlock(index, 'answer', e.target.value)}
                  placeholder="Answer…"
                  className="block-input block-input-grow block-textarea"
                />
              </div>
            )}

            {/* ── Card ────────────────────────────────── */}
            {block.type === 'card' && (
              <div className="block-form-column">
                <input
                  type="text"
                  value={block.heading || ''}
                  onChange={(e) => updateBlock(index, 'heading', e.target.value)}
                  placeholder="Card heading…"
                  className="block-input block-input-grow"
                />
                <textarea
                  value={block.body || ''}
                  onChange={(e) => updateBlock(index, 'body', e.target.value)}
                  placeholder="Card body text…"
                  className="block-input block-input-grow block-textarea"
                />
                <div className="block-form-row">
                  <input
                    type="url"
                    value={block.linkUrl || ''}
                    onChange={(e) => updateBlock(index, 'linkUrl', e.target.value)}
                    placeholder="Link URL (optional)…"
                    className="block-input block-input-grow"
                  />
                  <input
                    type="text"
                    value={block.linkLabel || ''}
                    onChange={(e) => updateBlock(index, 'linkLabel', e.target.value)}
                    placeholder="Link label…"
                    className="block-input"
                    style={{ minWidth: '140px' }}
                  />
                </div>
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
