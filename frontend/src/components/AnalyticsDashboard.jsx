import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronUp, ChevronDown, Search, Download } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function Skeleton({ width = '100%', height = 14, radius = 4 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '400px 100%',
      animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
    }} />
  );
}

const INTENT_COLORS = {
  faq:        'var(--cyan)',
  technical:  'var(--violet)',
  billing:    'var(--amber)',
  escalation: 'var(--rose)',
};

const ACTION_COLORS = {
  send:     'var(--emerald)',
  escalate: 'var(--rose)',
  retry:    'var(--amber)',
};

function Badge({ value, colorMap, defaultColor = 'var(--text-tertiary)' }) {
  const key = (value || '').toLowerCase();
  const color = colorMap[key] || defaultColor;
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 20,
      background: `${color}18`,
      border: `1px solid ${color}35`,
      color,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {(value || '—').toUpperCase()}
    </span>
  );
}

function ConfBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 75 ? 'var(--emerald)' : pct >= 50 ? 'var(--amber)' : 'var(--rose)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronUp size={11} style={{ opacity: 0.2 }} />;
  return sortDir === 'asc' ? <ChevronUp size={11} color="var(--cyan)" /> : <ChevronDown size={11} color="var(--cyan)" />;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('queries'); // 'queries' | 'sessions'

  // Query table state
  const [search, setSearch] = useState('');
  const [filterIntent, setFilterIntent] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/analytics`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      // keep old
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(0);
  }

  const queries = data?.queries || [];
  const sessions = data?.sessions || [];

  // Filter + sort queries
  const filtered = queries
    .filter(q => {
      if (search && !q.user_message?.toLowerCase().includes(search.toLowerCase()) &&
          !q.session_id?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterIntent !== 'all' && q.intent?.toLowerCase() !== filterIntent) return false;
      if (filterAction !== 'all' && q.action_taken?.toLowerCase() !== filterAction) return false;
      return true;
    })
    .sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === 'timestamp') { av = new Date(av || 0); bv = new Date(bv || 0); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function exportCSV() {
    const headers = ['session_id','user_message','intent','confidence','action_taken','chunks_retrieved','retry_count','timestamp'];
    const rows = filtered.map(q => headers.map(h => JSON.stringify(q[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'flowdesk_queries.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const thStyle = (field) => ({
    padding: '8px 12px',
    textAlign: 'left',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: sortField === field ? 'var(--cyan)' : 'var(--text-tertiary)',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    borderBottom: '1px solid var(--border)',
  });

  const tdStyle = {
    padding: '9px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14, minHeight: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            ANALYTICS
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Detailed query logs and session data for the backend team
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'var(--transition)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {[['queries', `Query Logs (${queries.length})`], ['sessions', `Sessions (${sessions.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '7px 16px',
            background: activeTab === key ? 'var(--cyan-dim)' : 'var(--glass)',
            border: `1px solid ${activeTab === key ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: activeTab === key ? 'var(--cyan)' : 'var(--text-secondary)',
            fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer',
            fontWeight: activeTab === key ? 600 : 400,
            transition: 'var(--transition)',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Query Logs Tab */}
      {activeTab === 'queries' && (
        <div className="glass" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search queries or session ID..."
                style={{ width: '100%', padding: '7px 10px 7px 30px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'var(--cyan)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
              />
            </div>
            {/* Intent filter */}
            <select value={filterIntent} onChange={e => { setFilterIntent(e.target.value); setPage(0); }}
              style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', outline: 'none' }}>
              <option value="all">All Intents</option>
              <option value="faq">FAQ</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
            </select>
            {/* Action filter */}
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
              style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer', outline: 'none' }}>
              <option value="all">All Actions</option>
              <option value="send">Send</option>
              <option value="escalate">Escalate</option>
              <option value="retry">Retry</option>
            </select>
            {/* Export */}
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'var(--transition)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--emerald)'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
              <Download size={12} /> Export CSV
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', alignSelf: 'center', marginLeft: 'auto' }}>
              {filtered.length} results
            </span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(8)].map((_, i) => <Skeleton key={i} height={36} radius={6} />)}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#080810', zIndex: 1 }}>
                  <tr>
                    {[
                      ['timestamp', 'TIME'],
                      ['session_id', 'SESSION'],
                      ['user_message', 'QUERY'],
                      ['intent', 'INTENT'],
                      ['confidence', 'CONFIDENCE'],
                      ['action_taken', 'ACTION'],
                      ['chunks_retrieved', 'CHUNKS'],
                      ['retry_count', 'RETRIES'],
                    ].map(([field, label]) => (
                      <th key={field} style={thStyle(field)} onClick={() => toggleSort(field)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No results found</td></tr>
                  ) : pageData.map((q, i) => (
                    <tr key={i}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap' }}>
                        {formatTime(q.timestamp)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', whiteSpace: 'nowrap' }}>
                        #{(q.session_id || '').slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-primary)', maxWidth: 280 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.user_message}>
                          {q.user_message}
                        </div>
                      </td>
                      <td style={tdStyle}><Badge value={q.intent} colorMap={INTENT_COLORS} /></td>
                      <td style={tdStyle}><ConfBar value={q.confidence} /></td>
                      <td style={tdStyle}><Badge value={q.action_taken} colorMap={ACTION_COLORS} /></td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {q.chunks_retrieved ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: q.retry_count > 0 ? 'var(--amber)' : 'var(--text-tertiary)', textAlign: 'center' }}>
                        {q.retry_count ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                  <button key={i} onClick={() => setPage(i)} style={{
                    width: 28, height: 28,
                    background: page === i ? 'var(--cyan-dim)' : 'transparent',
                    border: `1px solid ${page === i ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
                    borderRadius: 6,
                    color: page === i ? 'var(--cyan)' : 'var(--text-secondary)',
                    fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="glass" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(6)].map((_, i) => <Skeleton key={i} height={52} radius={8} />)}
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No sessions yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#080810', zIndex: 1 }}>
                  <tr>
                    {['SESSION ID', 'QUERIES', 'AVG CONFIDENCE', 'ESCALATIONS', 'RETRIES', 'DURATION', 'LAST ACTIVE'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={i}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>
                        #{(s.session_id || '').slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', textAlign: 'center' }}>
                        {s.total_queries}
                      </td>
                      <td style={tdStyle}><ConfBar value={s.avg_confidence} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {s.escalations > 0
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rose)', background: 'var(--rose-dim)', padding: '2px 8px', borderRadius: 4 }}>{s.escalations}</span>
                          : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>0</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: s.total_retries > 0 ? 'var(--amber)' : 'var(--text-tertiary)', textAlign: 'center' }}>
                        {s.total_retries || 0}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {formatDuration(s.started_at, s.last_activity)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {formatTime(s.last_activity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
