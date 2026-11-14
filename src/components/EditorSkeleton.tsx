export function EditorSkeleton() {
  return (
    <div role="status" className="flex h-full flex-col gap-3 bg-[#0f1115] p-6" aria-label="Loading editor">
      {[60, 80, 45, 70, 30, 55].map((w, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-line" style={{ width: `${w}%` }} />
      ))}
      <span className="sr-only">Loading editor…</span>
    </div>
  );
}
