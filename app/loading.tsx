export default function Carregando() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" aria-hidden="true" />
      <span className="sr-only">Carregando...</span>
    </main>
  );
}
