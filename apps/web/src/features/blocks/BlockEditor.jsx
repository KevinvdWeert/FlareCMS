import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { uploadBlockImage, getImageUrl } from '../../lib/storage';
import { Type, Image as ImageIcon, Heading1, Trash, ArrowUp, ArrowDown } from 'lucide-react';

export const BlockEditor = ({ blocks, setBlocks, pageId }) => {

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
    if (!pageId) {
      alert("Please save the page first before uploading images to blocks.");
      return;
    }
    try {
      const imageData = await uploadBlockImage(pageId, file);
      const newBlocks = [...blocks];
      newBlocks[index].storagePath = imageData.storagePath;
      newBlocks[index].alt = imageData.alt;
      setBlocks(newBlocks);
    } catch (err) {
      console.error(err);
      alert("Image upload failed");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => addBlock('heading')} style={toolbarBtnStyle}>
          <Heading1 size={16} /> Add Heading
        </button>
        <button onClick={() => addBlock('paragraph')} style={toolbarBtnStyle}>
          <Type size={16} /> Add Paragraph
        </button>
        <button onClick={() => addBlock('image')} style={toolbarBtnStyle}>
          <ImageIcon size={16} /> Add Image
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {blocks.map((block, index) => (
          <div key={block.id} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '15px', background: '#f8fafc', position: 'relative' }}>
            
            <div style={{ position: 'absolute', right: '10px', top: '10px', display: 'flex', gap: '5px' }}>
              <button disabled={index === 0} onClick={() => moveBlock(index, -1)} style={iconBtnStyle}><ArrowUp size={14} /></button>
              <button disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} style={iconBtnStyle}><ArrowDown size={14} /></button>
              <button onClick={() => removeBlock(index)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash size={14} /></button>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px' }}>
              {block.type}
            </div>

            {block.type === 'heading' && (
              <div style={innerFormStyle}>
                <select value={block.level} onChange={(e) => updateBlock(index, 'level', parseInt(e.target.value))} style={inputStyle}>
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
                <input 
                  type="text" 
                  value={block.text} 
                  onChange={(e) => updateBlock(index, 'text', e.target.value)} 
                  placeholder="Heading text..." 
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
            )}

            {block.type === 'paragraph' && (
              <div style={innerFormStyle}>
                <textarea 
                  value={block.text} 
                  onChange={(e) => updateBlock(index, 'text', e.target.value)} 
                  placeholder="Paragraph text..." 
                  style={{ ...inputStyle, width: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
            )}

            {block.type === 'image' && (
              <div style={{ ...innerFormStyle, flexDirection: 'column' }}>
                {block.storagePath ? (
                  <div style={{ background: '#e2e8f0', padding: '10px', fontSize: '12px', borderRadius: '4px' }}>
                    Image Path: {block.storagePath} <br/>
                    Alt: {block.alt}
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(index, e.target.files[0])} />
                )}
                <input 
                  type="text" 
                  value={block.caption || ''} 
                  onChange={(e) => updateBlock(index, 'caption', e.target.value)} 
                  placeholder="Optional caption..." 
                  style={{ ...inputStyle, width: '100%', marginTop: '10px' }}
                />
              </div>
            )}

          </div>
        ))}
        {blocks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
            No blocks added yet. Use the buttons above to add content.
          </div>
        )}
      </div>
    </div>
  );
};

const toolbarBtnStyle = {
  background: 'white',
  border: '1px solid #cbd5e1',
  padding: '6px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '14px',
  color: '#475569'
};

const iconBtnStyle = {
  background: 'white',
  border: '1px solid #cbd5e1',
  padding: '4px',
  borderRadius: '4px',
  cursor: 'pointer',
  color: '#475569',
  display: 'flex',
  alignItems: 'center'
};

const innerFormStyle = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start'
};

const inputStyle = {
  padding: '8px',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontFamily: 'inherit'
};
