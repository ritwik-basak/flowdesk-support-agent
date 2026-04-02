import { useEffect, useState } from 'react';

export default function MetricCard({ label, value, icon: Icon, color = 'var(--cyan)', suffix = '' }) {
  const [displayed, setDisplayed] = useState(0);
  const isNumber = typeof value === 'number';

  useEffect(() => {
    if (!isNumber) return;
    const target = value;
    const duration = 800;
    const steps = 30;
    const increment = target / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = step >= steps ? target : current + increment;
      setDisplayed(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, isNumber]);

  const displayValue = isNumber
    ? (Number.isInteger(value) ? Math.round(displayed) : displayed.toFixed(1))
    : value;

  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        transition: 'var(--transition)',
        cursor: 'default',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${color}40`;
        e.currentTarget.style.background = 'var(--glass-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--glass)';
      }}
    >
      {/* Subtle glow */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0,
        width: 60, height: 60,
        borderRadius: '50%',
        background: `${color}08`,
        transform: 'translate(20px, -20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1,
          animation: 'fade-in-up 0.4s ease',
        }}>
          {displayValue}{suffix}
        </span>
        {Icon && (
          <div style={{
            width: 28, height: 28,
            background: `${color}15`,
            border: `1px solid ${color}25`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color={color} />
          </div>
        )}
      </div>

      <span style={{
        fontSize: 11,
        color: 'var(--text-secondary)',
        fontWeight: 500,
        letterSpacing: '0.04em',
      }}>
        {label}
      </span>
    </div>
  );
}
