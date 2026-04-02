import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, AlertCircle, ThumbsUp, RefreshCw, Layers, AlertTriangle } from 'lucide-react';
import MetricCard from './MetricCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function Skeleton({ width = '100%', height = 16, radius = 6 }) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '400px 100%',
      animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
    }} />
  );
}

function IntentBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
          <span style={{ fontSize: 11, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pct}%</span>
        </div>
      </div>
      <div style={{
        height: 5,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          animation: 'bar-fill 0.8s ease',
          boxShadow: `0 0 8px ${color}60`,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function CircularProgress({ pct, color = 'var(--emerald)' }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <circle
          cx={36} cy={36} r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontWeight: 600,
        fontSize: 14, color: 'var(--text-primary)',
      }}>
        {pct}%
      </div>
    </div>
  );
}

export default function MetricsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/metrics`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      // keep old data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const metrics = data?.metrics || {};
  const failing = data?.top_failing_queries || [];
  const feedback = data?.feedback || {};

  // intent_breakdown is a plain dict — normalize keys to lowercase
  const rawByType = metrics.intent_breakdown || {};
  const byType = {};
  Object.entries(rawByType).forEach(([k, v]) => { byType[k.toLowerCase()] = v; });
  const totalByType = Object.values(byType).reduce((acc, v) => acc + v, 0);

  const positiveFeedback = feedback.positive || 0;
  const negativeFeedback = feedback.negative || 0;
  const totalFeedback = feedback.total_feedback || 0;
  const positivePct = Math.round(feedback.positive_rate || 0);

  // escalation_rate already comes as a percentage (e.g. 14.28)
  const escalationRate = metrics.escalation_rate != null
    ? Math.round(metrics.escalation_rate)
    : 0;

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="glass" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--cyan)',
            boxShadow: '0 0 6px var(--cyan)',
            animation: 'pulse-dot 2s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
          }}>
            LIVE METRICS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
            {timeStr}
          </span>
          <button
            onClick={fetchMetrics}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center',
              padding: 3,
              borderRadius: 4,
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

        {/* Key numbers */}
        <section>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
            KEY NUMBERS
          </p>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ padding: '14px 16px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <Skeleton height={24} width="60%" radius={4} />
                  <div style={{ marginTop: 10 }}><Skeleton height={12} width="80%" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <MetricCard label="Total Queries" value={metrics.total_queries || 0} icon={BarChart2} color="var(--cyan)" />
              <MetricCard label="Avg Confidence" value={metrics.avg_confidence != null ? Math.round(metrics.avg_confidence * 100) : 0} icon={TrendingUp} color="var(--violet)" suffix="%" />
              <MetricCard label="Escalation Rate" value={escalationRate} icon={AlertCircle} color={escalationRate > 20 ? 'var(--rose)' : 'var(--amber)'} suffix="%" />
              <MetricCard label="Avg Chunks Retrieved" value={metrics.avg_chunks_retrieved != null ? parseFloat(metrics.avg_chunks_retrieved.toFixed(1)) : 0} icon={Layers} color="var(--cyan)" />
              <MetricCard label="Positive Feedback" value={positivePct} icon={ThumbsUp} color="var(--emerald)" suffix="%" />
              <MetricCard label="Total Feedback" value={totalFeedback} icon={ThumbsUp} color="var(--violet)" />
            </div>
          )}
        </section>

        {/* Intent breakdown */}
        <section>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
            INTENT BREAKDOWN
          </p>
          <div style={{ padding: '14px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} height={14} />)
            ) : (
              <>
                <IntentBar label="FAQ" value={byType.faq || 0} total={totalByType} color="var(--cyan)" />
                <IntentBar label="TECHNICAL" value={byType.technical || 0} total={totalByType} color="var(--violet)" />
                <IntentBar label="BILLING" value={byType.billing || 0} total={totalByType} color="var(--amber)" />
              </>
            )}
          </div>
        </section>

        {/* Feedback summary */}
        <section>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
            FEEDBACK SUMMARY
          </p>
          <div style={{ padding: '14px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 16 }}>
            {loading ? <Skeleton height={72} width={72} radius={36} /> : <CircularProgress pct={positivePct} color="var(--emerald)" />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total responses</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{totalFeedback}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Positive</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--emerald)' }}>+{positiveFeedback}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Negative</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--rose)' }}>-{negativeFeedback}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Satisfaction rate</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--emerald)', fontWeight: 600 }}>{positivePct}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Top failing queries */}
        <section>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
            TOP ESCALATED QUERIES
          </p>
          <div style={{ padding: '14px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} height={14} />)
            ) : failing.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--emerald)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '8px 0' }}>
                No escalated queries — system performing well ✓
              </p>
            ) : (
              failing.slice(0, 5).map((q, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: i < failing.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                      {q.user_message}
                    </p>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', flexShrink: 0, padding: '2px 6px', background: 'var(--rose-dim)', borderRadius: 4 }}>
                      {q.confidence != null ? Math.round(q.confidence * 100) + '%' : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {q.intent && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                        {q.intent.toUpperCase()}
                      </span>
                    )}
                    {q.timestamp && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
                        {new Date(q.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Low confidence queries */}
        <section>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
            LOW CONFIDENCE QUERIES
          </p>
          <div style={{ padding: '14px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              [...Array(2)].map((_, i) => <Skeleton key={i} height={14} />)
            ) : (metrics.low_confidence_queries || []).length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--emerald)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '8px 0' }}>
                No low confidence queries ✓
              </p>
            ) : (
              (metrics.low_confidence_queries || []).map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottom: i < metrics.low_confidence_queries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <AlertTriangle size={11} color="var(--amber)" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {q}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
