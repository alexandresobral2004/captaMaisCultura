import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="max-w-md text-sm text-slate-500">O endereço pode estar errado ou o conteúdo foi removido.</p>
      <Link href="/" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Voltar ao início
      </Link>
    </main>
  );
}
