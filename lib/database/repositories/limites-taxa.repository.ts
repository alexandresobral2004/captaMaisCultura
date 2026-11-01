import { lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { limitesTaxa } from '../schema';

export interface ResultadoTentativa {
  permitido: boolean;
  tentativas: number;
  expiraEm: number;
}

// O driver pode devolver bigint como texto (postgres-js); z.coerce normaliza para número
const LinhaContador = z.object({
  contador: z.coerce.number(),
  expiraEm: z.coerce.number(),
});

/**
 * Só nome e código do erro. A mensagem e os parâmetros do drizzle trazem a query com a chave (e-mail ou IP).
 */
function descreverErro(erro: unknown) {
  if (!(erro instanceof Error)) return { nome: 'desconhecido', codigo: undefined };
  const causa: unknown = erro.cause;
  const codigo = typeof causa === 'object' && causa !== null && 'code' in causa ? String(causa.code) : undefined;
  return { nome: erro.name, codigo };
}

/**
 * Conta uma tentativa na chave e diz se ainda cabe no limite da janela.
 * Um único INSERT ... ON CONFLICT: o banco resolve a concorrência entre réplicas, sem leitura prévia.
 * Usa o construtor do drizzle (e não SQL cru) porque ele gera o mesmo upsert no Postgres e no SQLite.
 * Falha de banco: permite a requisição e registra o erro (fail open), para não derrubar o login.
 */
export async function contarTentativa(chave: string, janelaMs: number, limite: number): Promise<ResultadoTentativa> {
  const agora = Date.now();
  const novaExpiracao = agora + janelaMs;

  try {
    const linhas = await db
      .insert(limitesTaxa)
      .values({ chave, contador: 1, expiraEm: novaExpiracao })
      .onConflictDoUpdate({
        target: limitesTaxa.chave,
        set: {
          contador: sql`CASE WHEN ${limitesTaxa.expiraEm} < ${agora} THEN 1 ELSE ${limitesTaxa.contador} + 1 END`,
          expiraEm: sql`CASE WHEN ${limitesTaxa.expiraEm} < ${agora} THEN ${novaExpiracao} ELSE ${limitesTaxa.expiraEm} END`,
        },
      })
      .returning({ contador: limitesTaxa.contador, expiraEm: limitesTaxa.expiraEm });

    const [linha] = LinhaContador.array().parse(linhas);
    return {
      permitido: linha.contador <= limite,
      tentativas: linha.contador,
      expiraEm: linha.expiraEm,
    };
  } catch (erro) {
    console.error('❌ [LIMITE DE TAXA] Falha no banco; requisição permitida (fail open):', descreverErro(erro));
    return { permitido: true, tentativas: 0, expiraEm: novaExpiracao };
  }
}

/**
 * Apaga as contagens cuja janela já terminou. Chamada de hora em hora pelo worker.
 * Uma linha expirada se comporta como ausente (a próxima tentativa recomeça em 1), então apagar não muda o resultado.
 */
export async function limparLimitesExpirados(): Promise<void> {
  await db.delete(limitesTaxa).where(lt(limitesTaxa.expiraEm, Date.now()));
}
