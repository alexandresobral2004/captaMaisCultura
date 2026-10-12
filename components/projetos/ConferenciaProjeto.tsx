import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ResultadoConferencia {
  secoesExigidas: string[];
  secoesFaltando: string[];
  criterios: { criterio: string; situacao: 'atendido' | 'parcial' | 'ausente'; observacao: string }[];
  avisos: string[];
}

const ROTULO = { atendido: 'Atendido', parcial: 'Parcial', ausente: 'Ausente' } as const;
const COR = {
  atendido: 'bg-green-100 text-green-800',
  parcial: 'bg-amber-100 text-amber-800',
  ausente: 'bg-red-100 text-red-800',
} as const;

export function ConferenciaProjeto({ resultado, onFechar }: { resultado: ResultadoConferencia; onFechar: () => void }) {
  const atendidos = resultado.criterios.filter(c => c.situacao === 'atendido').length;
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          Conferência com o edital
          {resultado.criterios.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-600">
              {atendidos} de {resultado.criterios.length} critérios atendidos
            </span>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onFechar}>Fechar</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {resultado.avisos.map(a => (
          <p key={a} className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{a}</p>
        ))}
        {resultado.secoesFaltando.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Seções que o edital pede e ainda estão sem texto:</p>
            <ul className="list-disc pl-5 text-sm text-slate-700">
              {resultado.secoesFaltando.map(s => <li key={s}>{s}</li>)}
            </ul>
          </div>
        ) : resultado.secoesExigidas.length > 0 ? (
          <p className="text-sm text-green-700">Todas as seções exigidas pelo edital têm texto.</p>
        ) : null}
        {resultado.criterios.length > 0 && (
          <ul className="space-y-2">
            {resultado.criterios.map(c => (
              <li key={c.criterio} className="text-sm">
                <Badge className={COR[c.situacao]}>{ROTULO[c.situacao]}</Badge>{' '}
                <span className="font-medium">{c.criterio}</span>
                {c.observacao && <p className="ml-1 mt-1 text-slate-600">{c.observacao}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
