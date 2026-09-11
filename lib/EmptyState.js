function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
      <path d="M4 12h4l1.8 3h4.4l1.8-3h4" />
      <path d="M5.5 5.5h13l1.5 6.5v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6l1.5-6.5Z" />
    </svg>
  );
}

export default function EmptyState({ title, hint }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><InboxIcon /></div>
      <div className="empty-title">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}
