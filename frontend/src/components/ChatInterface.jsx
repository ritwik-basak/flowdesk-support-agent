import { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, MessageSquare } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const SUGGESTIONS = [
  'How do I invite team members?',
  "My notifications aren't working",
  'What are the pricing plans?',
];

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      padding: '10px 18px',
      background: 'var(--emerald-dim)',
      border: '1px solid rgba(0,255,136,0.3)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--emerald)',
      fontSize: 13,
      fontWeight: 500,
      zIndex: 100,
      animation: 'toast-in 0.3s ease',
      backdropFilter: 'blur(20px)',
    }}>
      {message}
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastUserMessageRef = useRef('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  function newSession() {
    setSessionId(uuidv4());
    setMessages([]);
    setInput('');
    setIsStreaming(false);
    setShowTyping(false);
    inputRef.current?.focus();
  }

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;

    lastUserMessageRef.current = msg;
    setInput('');
    setIsStreaming(true);

    // Add user message
    setMessages(prev => [...prev, { id: uuidv4(), role: 'user', content: msg }]);
    setShowTyping(true);

    // Placeholder for assistant message
    const assistantId = uuidv4();

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let currentEventType = null;
      let buffer = '';
      let metadata = null;
      let serverSessionId = sessionId;

      setShowTyping(false);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        metadata: null,
        sessionId: serverSessionId,
        userMessage: msg,
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { currentEventType = null; continue; }

          if (trimmed.startsWith('event:')) {
            currentEventType = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const raw = trimmed.slice(5).trim();
            try {
              const data = JSON.parse(raw);

              if (currentEventType === 'session') {
                serverSessionId = data.session_id;
              } else if (currentEventType === 'metadata') {
                metadata = data;
              } else if (currentEventType === 'token') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (data.token || '') }
                    : m
                ));
              } else if (currentEventType === 'done') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, streaming: false, metadata, sessionId: serverSessionId }
                    : m
                ));
              } else if (currentEventType === 'error') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: data.error || 'Something went wrong.', streaming: false }
                    : m
                ));
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setShowTyping(false);
      setMessages(prev => {
        const hasPlaceholder = prev.some(m => m.id === assistantId);
        if (hasPlaceholder) {
          return prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `Error: ${err.message}`, streaming: false }
              : m
          );
        }
        return [...prev, {
          id: assistantId,
          role: 'assistant',
          content: `Error: ${err.message}`,
          streaming: false,
        }];
      });
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const shortSession = sessionId.slice(0, 8).toUpperCase();

  return (
    <div className="glass" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Session bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            SESSION
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: '0.08em' }}>
            #{shortSession}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {messages.filter(m => m.role === 'user').length} MSG
          </span>
        </div>
        <button
          onClick={newSession}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <RefreshCw size={11} />
          New Session
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            opacity: 0.8,
          }}>
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: 'var(--cyan-dim)',
              border: '1px solid rgba(0,212,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare size={22} color="var(--cyan)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4, fontFamily: 'var(--font-display)' }}>
                Ask me anything about Flowdesk
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Multi-agent AI support — powered by RAG
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '9px 14px',
                    background: 'var(--glass)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--transition)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--cyan-dim)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'var(--glass)';
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onToast={setToast}
              />
            ))}
            {showTyping && (
              <div style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                borderRadius: '16px 16px 16px 4px',
                display: 'inline-block',
              }}>
                <TypingIndicator />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={isStreaming ? 'Waiting for response...' : 'Ask a question...'}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'var(--transition)',
                opacity: isStreaming ? 0.5 : 1,
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.boxShadow = '0 0 0 2px var(--cyan-glow)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              background: isStreaming || !input.trim() ? 'rgba(0,212,255,0.05)' : 'var(--cyan-dim)',
              border: `1px solid ${isStreaming || !input.trim() ? 'var(--border)' : 'rgba(0,212,255,0.4)'}`,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'var(--transition)',
              color: isStreaming || !input.trim() ? 'var(--text-tertiary)' : 'var(--cyan)',
            }}
            onMouseEnter={e => {
              if (!isStreaming && input.trim()) {
                e.currentTarget.style.boxShadow = '0 0 12px var(--cyan-glow)';
              }
            }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <Send size={15} />
          </button>
        </div>
        <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 2 }}>
          Press Enter to send
        </p>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
