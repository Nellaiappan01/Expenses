export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-md animate-pulse space-y-4 px-4 py-4">
      <div className="h-10 w-40 rounded-xl bg-slate-200/80" />
      <div className="ui-card h-28" />
      <div className="ui-card space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-11 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
