import { useState } from 'react';
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function ConfidencePill({ score }) {
  const pct = Math.round(score * 100);
  let color = 'var(--emerald)';
  let bg = 'var(--emerald-dim)';
  if (score < 0.5) { color = 'var(--rose)'; bg = 'var(--rose-dim)'; }
  else if (score < 0.75) { color = 'var(--amber)'; bg = 'var(--amber-dim)'; }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 20,
      background: bg,
      border: `1px solid ${color}30`,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color,
      fontWeight: 600,
    }}>
      {pct}%
    </span>
  );
}

function IssueTypeBadge({ type }) {
  const map = {
    faq:        { color: 'var(--cyan)',    bg: 'var(--cyan-dim)',    label: 'FAQ' },
    technical:  { color: 'var(--violet)',  bg: 'var(--violet-dim)', label: 'TECHNICAL' },
    billing:    { color: 'var(--amber)',   bg: 'var(--amber-dim)',  label: 'BILLING' },
    escalation: { color: 'var(--rose)',    bg: 'var(--rose-dim)',   label: 'ESCALATION' },
  };
  const s = map[type?.toLowerCase()] || map.faq;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 20,
      background: s.bg,
      border: `1px solid ${s.color}30`,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: s.color,
      fontWeight: 600,
      letterSpacing: '0.06em',
    }}>
      {s.label}
    </span>
  );
}

function SourceChip({ doc }) {
  const label = doc?.metadata?.header || doc?.metadata?.source || 'Source';
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 20,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid var(--border)',
      fontSize: 10,
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 120,
    }}>
      {label}
    </span>
  );
}

export default function MessageBubble({ message, onFeedback, onToast }) {
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const isUser = message.role === 'user';
  const isEscalation = message.metadata?.issue_type?.toLowerCase() === 'escalation';

  async function handleFeedback(type) {
    if (feedbackGiven) return;
    setFeedbackGiven(type);
    try {
      await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: message.sessionId,
          user_message: message.userMessage || '',
          agent_answer: message.content,
          feedback_type: type,
        }),
      });
      onToast('Thanks for your feedback!');
    } catch {
      // silent fail
    }
  }

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fade-in-up 0.25s ease' }}>
        <div style={{
          maxWidth: '72%',
          padding: '10px 14px',
          background: 'var(--cyan-dim)',
          border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: '16px 16px 4px 16px',
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          fontSize: 14,
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fade-in-up 0.25s ease' }}>
      <div style={{
        maxWidth: '85%',
        padding: '12px 16px',
        background: isEscalation ? 'rgba(255,184,0,0.05)' : 'var(--glass)',
        backdropFilter: 'blur(20px)',
        border: isEscalation
          ? '1px solid rgba(255,184,0,0.25)'
          : '1px solid var(--border)',
        borderLeft: isEscalation ? '3px solid var(--amber)' : undefined,
        borderRadius: isEscalation ? '4px 16px 16px 16px' : '16px 16px 16px 4px',
        color: 'var(--text-primary)',
        lineHeight: 1.7,
        fontSize: 14,
        wordBreak: 'break-word',
        position: 'relative',
      }}>
        {isEscalation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--amber)', fontSize: 12 }}>
            <AlertTriangle size={13} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em' }}>ESCALATED TO HUMAN</span>
          </div>
        )}
        <ReactMarkdown
          components={{
            p: ({ children }) => <p style={{ margin: '0 0 6px 0', lineHeight: 1.7 }}>{children}</p>,
            strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>,
            ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</ol>,
            ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</ul>,
            li: ({ children }) => <li style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>{children}</li>,
            code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>{children}</code>,
          }}
        >
          {message.content}
        </ReactMarkdown>
        {message.streaming && (
          <span style={{
            display: 'inline-block',
            width: 2, height: '1em',
            background: 'var(--cyan)',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'blink-cursor 0.9s step-end infinite',
          }} />
        )}
      </div>

      {/* Metadata row — only shown after streaming done */}
      {message.metadata && !message.streaming && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          paddingLeft: 4,
        }}>
          <ConfidencePill score={message.metadata.confidence} />
          <IssueTypeBadge type={message.metadata.issue_type} />
          {(message.metadata.source_docs || []).slice(0, 3).map((doc, i) => (
            <SourceChip key={i} doc={doc} />
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Feedback */}
          <button
            onClick={() => handleFeedback('positive')}
            title="Helpful"
            style={{
              background: feedbackGiven === 'positive' ? 'var(--emerald-dim)' : 'transparent',
              border: 'none',
              cursor: feedbackGiven ? 'default' : 'pointer',
              color: feedbackGiven === 'positive' ? 'var(--emerald)' : 'var(--text-tertiary)',
              padding: '3px 6px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              transition: 'var(--transition)',
            }}
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => handleFeedback('negative')}
            title="Not helpful"
            style={{
              background: feedbackGiven === 'negative' ? 'var(--rose-dim)' : 'transparent',
              border: 'none',
              cursor: feedbackGiven ? 'default' : 'pointer',
              color: feedbackGiven === 'negative' ? 'var(--rose)' : 'var(--text-tertiary)',
              padding: '3px 6px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              transition: 'var(--transition)',
            }}
          >
            <ThumbsDown size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
