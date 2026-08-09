export function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="skeleton sk-img" />
      <div className="sk-body">
        <div className="skeleton sk-title" />
        <div className="skeleton sk-sub" />
        <div className="skeleton sk-meta" />
      </div>
      <style>{`
        .sk-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
        .sk-img { height: 180px; border-radius: 0; }
        .sk-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
        .sk-title { height: 18px; width: 70%; }
        .sk-sub { height: 13px; width: 50%; }
        .sk-meta { height: 13px; width: 85%; }
      `}</style>
    </div>
  );
}

export function SkeletonText({ width = '100%', height = '16px' }) {
  return <div className="skeleton" style={{ width, height, borderRadius: '6px' }} />;
}

export function SkeletonMenuCard() {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
      <div className="skeleton" style={{ width: 100, height: 90, borderRadius: '10px', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ height: '16px', width: '60%' }} />
        <div className="skeleton" style={{ height: '12px', width: '80%' }} />
        <div className="skeleton" style={{ height: '12px', width: '40%' }} />
      </div>
    </div>
  );
}
