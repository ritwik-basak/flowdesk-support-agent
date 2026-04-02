import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, BarChart2 } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import MetricsDashboard from './components/MetricsDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DocumentUpload from './components/DocumentUpload';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const panelVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

export default function App() {
  const [view, setView] = useState('chat'); // 'chat' | 'analytics'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 56,
          borderBottom: '1px solid var(--border)',
          background: 'rgba(5,5,8,0.8)',
          backdropFilter: 'blur(20px)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--cyan)',
            boxShadow: '0 0 8px var(--cyan)',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
          }}>
            FLOWDESK
          </span>
          <span style={{
            marginLeft: 6,
            fontSize: 11,
            color: 'var(--text-secondary)',
            letterSpacing: '0.06em',
            fontWeight: 500,
            paddingLeft: 10,
            borderLeft: '1px solid var(--border)',
          }}>
            AI Support Agent
          </span>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'chat', label: 'Chat', icon: MessageSquare },
            { key: 'analytics', label: 'Analytics', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px',
              background: view === key ? 'var(--cyan-dim)' : 'transparent',
              border: `1px solid ${view === key ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: view === key ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer',
              fontWeight: view === key ? 600 : 400,
              transition: 'var(--transition)',
            }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--emerald)',
            boxShadow: '0 0 8px var(--emerald)',
            animation: 'pulse-dot 2s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--emerald)',
            letterSpacing: '0.08em',
          }}>
            LIVE
          </span>
        </div>
      </motion.header>

      {/* ── Main panels ── */}
      {view === 'chat' ? (
        <motion.div
          key="chat"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flex: 1, gap: 12, padding: 12, overflow: 'hidden', minHeight: 0 }}
        >
          <motion.div variants={panelVariants} style={{ flex: '0 0 60%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <ChatInterface />
          </motion.div>
          <motion.div variants={panelVariants} style={{ flex: '0 0 calc(40% - 12px)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MetricsDashboard />
            </div>
            <DocumentUpload />
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="analytics"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{ flex: 1, padding: 12, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <AnalyticsDashboard />
        </motion.div>
      )}
    </div>
  );
}
