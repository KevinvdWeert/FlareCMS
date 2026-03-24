import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { uploadBlockImage, validateImageFile } from '../../lib/storage';
import { Type, Image as ImageIcon, Heading1, Trash, ArrowUp, ArrowDown } from 'lucide-react';

export const BlockEditor = ({ blocks, setBlocks, pageId }) => {
  const [uploadError, setUploadError] = useState('');

  const addBlock = (type) => {
    const newBlock = { id: uuidv4(), type };
    if (type === 'heading') {
      newBlock.level = 1;
      newBlock.text = '';
    } else if (type === 'paragraph') {
      newBlock.text = '';
    } else if (type === 'image') {
      newBlock.storagePath = '';
      newBlock.alt = '';
      newBlock.caption = '';
    }
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (index, field, value) => {
    const newBlocks = [...blocks];
    newBlocks[index][field] = value;
    setBlocks(newBlocks);
  };

  const removeBlock = (index) => {
    if (window.confirm("Delete this block?")) {
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
    setUploadError('');
    if (!file) {
      return;
    }
    if (!pageId) {
      setUploadError('Please save the page first before uploading images to blocks.');
      return;
    }
    try {
      validateImageFile(file);
      const imageData = await uploadBlockImage(pageId, file);
      const newBlocks = [...blocks];
      newBlocks[index].storagePath = imageData.storagePath;
      newBlocks[index].alt = imageData.alt;
      setBlocks(newBlocks);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Image upload failed.');
    }
  };

  return (
    <div className="block-editor">
      <div className="block-toolbar">
        <button onClick={() => addBlock('heading')} className="block-toolbar-btn" type="button">
          <Heading1 size={16} /> Heading
        </button>
        <button onClick={() => addBlock('paragraph')} className="block-toolbar-btn" type="button">
          <Type size={16} /> Paragraph
        </button>
        <button onClick={() => addBlock('image')} className="block-toolbar-btn" type="button">
          <ImageIcon size={16} /> Image
        </button>
      </div>

      {uploadError && (
        <div className="admin-editor-error" style={{ marginBottom: '10px' }}>{uploadError}</div>
      )}

      <div className="block-list">
        {blocks.map((block, index) => (
          <div key={block.id} className="block-item">
            
            <div className="block-item-actions">
              <button disabled={index === 0} onClick={() => moveBlock(index, -1)} className="block-icon-btn" type="button"><ArrowUp size={14} /></button>
              <button disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} className="block-icon-btn" type="button"><ArrowDown size={14} /></button>
              <button onClick={() => removeBlock(index)} className="block-icon-btn danger" type="button"><Trash size={14} /></button>
            </div>

            <div className="block-type-label">
              {block.type === 'heading' ? 'Heading Block' : block.type === 'paragraph' ? 'Paragraph Block' : 'Image Block'}
            </div>

            {block.type === 'heading' && (
              <div className="block-form-row">
                <select value={block.level} onChange={(e) => updateBlock(index, 'level', parseInt(e.target.value))} className="block-input">
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
                <input 
                  type="text" 
                  value={block.text} 
                  onChange={(e) => updateBlock(index, 'text', e.target.value)} 
                  placeholder="Heading text..." 
                  className="block-input block-input-grow"
                />
              </div>
            )}

            {block.type === 'paragraph' && (
              <div className="block-form-row">
                <textarea 
                  value={block.text} 
                  onChange={(e) => updateBlock(index, 'text', e.target.value)} 
                  placeholder="Paragraph text..." 
                  className="block-input block-input-grow block-textarea"
                />
              </div>
            )}

            {block.type === 'image' && (
              <div className="block-form-column">
                {block.storagePath ? (
                  <div className="block-image-meta">
                    <p><strong>Image Path:</strong> {block.storagePath}</p>
                    <p><strong>Alt:</strong> {block.alt}</p>
                  </div>
                ) : (
                  <input className="block-input block-input-grow" type="file" accept="image/*" onChange={(e) => handleImageUpload(index, e.target.files?.[0])} />
                )}
                <input 
                  type="text" 
                  value={block.caption || ''} 
                  onChange={(e) => updateBlock(index, 'caption', e.target.value)} 
                  placeholder="Optional caption..." 
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
    </div>
  );
};
