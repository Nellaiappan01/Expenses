export default function UserViewNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Shop not found</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          This public stock link does not match any godown account. Use the{" "}
          <span className="font-semibold text-slate-700">View</span> button on the Godown page after
          login, or check your username in the URL.
        </p>
    </div>
  );
}
