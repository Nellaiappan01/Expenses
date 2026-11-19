export default function SheetLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-md px-3 py-4 pb-12 sm:px-4">
        <header className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-zinc-300 bg-white" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Sheet</h1>
            <p className="text-sm text-zinc-500">New tab in the same Google Sheet</p>
          </div>
        </header>
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="rounded-xl bg-zinc-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active sheet</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">Reading the sheet…</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Previous closing</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">Reading…</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">New sheet name</p>
            <div className="h-14 rounded-xl border border-zinc-300 bg-white" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Opening balance</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#0B4A8C] px-2 py-3 text-center text-xs font-semibold text-white">
                Auto Carry Forward
              </div>
              <div className="rounded-xl border border-[#D6E6F5] px-2 py-3 text-center text-xs font-semibold text-[#0B4A8C]">
                Custom Opening Balance
              </div>
            </div>
          </div>
          <div className="ui-btn-primary opacity-60">Review opening</div>
        </div>
      </div>
    </div>
  );
}
