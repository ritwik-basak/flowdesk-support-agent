export default function TypingIndicator() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      maxWidth: 80,
    }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--cyan)',
              opacity: 0.7,
              animation: `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              display: 'block',
            }}
          />
        ))}
      </div>
    </div>
  );
}
