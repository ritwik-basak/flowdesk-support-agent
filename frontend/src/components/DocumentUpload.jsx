import { useState } from 'react';
import axios from 'axios';
import { FileUp, LoaderCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function DocumentUpload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleUpload() {
    if (!file || status === 'uploading' || status === 'processing') return;

    const formData = new FormData();
    formData.append('file', file);

    setStatus('uploading');
    setMessage('');

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: progressEvent => {
          const total = progressEvent.total || file.size || 1;
          const progress = Math.round((progressEvent.loaded / total) * 100);
          if (progress >= 100) {
            setStatus('processing');
            setMessage('Processing and indexing document...');
          } else {
            setStatus('uploading');
            setMessage(`Uploading... ${progress}%`);
          }
        },
      });

      setStatus('success');
      setMessage(`✓ ${response.data.filename} added — ${response.data.chunks_created} chunks indexed`);
      setFile(null);
    } catch (error) {
      const detail = error.response?.data?.detail || error.response?.data?.message || error.message || 'Upload failed';
      setStatus('error');
      setMessage(detail);
    }
  }

  return (
    <div className="glass" style={{
      padding: '14px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <p style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}>
            KNOWLEDGE BASE
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            Upload PDF
          </p>
        </div>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cyan-dim)',
          border: '1px solid rgba(0,212,255,0.22)',
          color: 'var(--cyan)',
          flexShrink: 0,
        }}>
          <FileUp size={16} />
        </div>
      </div>

      <label style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-md)',
        color: file ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12,
        cursor: 'pointer',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'Choose a PDF document'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}>
          .PDF
        </span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={e => {
            const nextFile = e.target.files?.[0] || null;
            setFile(nextFile);
            setStatus('idle');
            setMessage('');
          }}
        />
      </label>

      <button
        onClick={handleUpload}
        disabled={!file || status === 'uploading' || status === 'processing'}
        style={{
          height: 40,
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${!file || status === 'uploading' || status === 'processing' ? 'var(--border)' : 'rgba(0,212,255,0.35)'}`,
          background: !file || status === 'uploading' || status === 'processing' ? 'rgba(0,212,255,0.05)' : 'var(--cyan-dim)',
          color: !file || status === 'uploading' || status === 'processing' ? 'var(--text-tertiary)' : 'var(--cyan)',
          fontSize: 12,
          fontWeight: 600,
          cursor: !file || status === 'uploading' || status === 'processing' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'var(--transition)',
        }}
      >
        {(status === 'uploading' || status === 'processing') && <LoaderCircle size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        {status === 'processing' ? 'Processing...' : status === 'uploading' ? 'Uploading...' : 'Upload to RAG'}
      </button>

      {message && (
        <p style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          color: status === 'error' ? 'var(--rose)' : status === 'success' ? 'var(--emerald)' : 'var(--text-secondary)',
        }}>
          {message}
        </p>
      )}
    </div>
  );
}
