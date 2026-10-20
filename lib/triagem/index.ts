import {
  julgarEditalComJev,
  eixoDasRespostas,
  resultadoTIDasRespostas,
  julgamentoCulturaDasRespostas,
  confiancaMinimaJev,
  confiancaParaDescartar,
  type Eixo,
  type EntradaEdital,
  type RespostasEdital,
} from '../filtros-ti/jev-classifier';
import { validarComOpenAI, type AiClassificationResult } from '../filtros-ti/openai-classifier';
import { validarWhitelistTI } from '../filtros-ti/whitelist';
import { analisarBlacklist } from '../filtros-ti/blacklist';
import { termosCulturaEncontrados } from './cultura';
import { restritoAOutraRegiao } from './regiao';
import { REGIAO_REJEITAR } from './limiares';
import { pontuar, comporNota, notaDoJev, descreverPontuacao, type Pontuacao, type Nota } from './pontuacao';

export type { Eixo } from '../filtros-ti/jev-classifier';

/** Eixo configurado no portal: fixo (Cultura/Pesquisa) ou decidido edital a edital (auto). */
export type EixoPortal = 'auto' | Eixo;

export type EtapaTriagem = 'eixo' | 'whitelist' | 'ia' | 'blacklist' | 'cultura' | 'regiao' | 'pontuacao';

export interface ResultadoTriagem {
  aceito: boolean;
  /** Aceito, mas sem confirmação forte (IA indisponível ou pouco confiante): marcar para revisão. */
  incerto: boolean;
  categoriaArea: Eixo | null;
  etapa: EtapaTriagem;
  motivo: string;
  termosBranco: string[];
  /** Classificação de TI (tecnologia, tipo, score) quando o eixo é Pesquisa. */
  validacaoIA?: AiClassificationResult;
  /** Notas e achados por camada, quando a decisão passou pela pontuação (ver pontuacao.ts). */
  pontuacao?: { nota: Nota; resumo: string };
}

export interface EntradaTriagem extends EntradaEdital {
  eixoPortal?: EixoPortal;
}

/** Aceita para revisão humana: o caso ficou entre "aceitar" e "descartar com certeza". */
function emDuvida(etapa: EtapaTriagem, motivo: string, categoriaArea: Eixo | null, termosBranco: string[] = []): ResultadoTriagem {
  return { aceito: true, incerto: true, categoriaArea, etapa, motivo, termosBranco };
}

function rejeitar(etapa: EtapaTriagem, motivo: string, categoriaArea: Eixo | null, termosBranco: string[] = []): ResultadoTriagem {
  return { aceito: false, incerto: false, categoriaArea, etapa, motivo, termosBranco };
}

/**
 * Sem Jev (ou com Jev incerto) decide o eixo pelos termos de cada lista.
 * Empate favorece TI/Pesquisa, que é o comportamento anterior do sistema.
 */
function eixoPorTermos(entrada: EntradaEdital): { eixo: Eixo | null; termosTI: string[]; termosCultura: string[] } {
  const ti = validarWhitelistTI(entrada.titulo, entrada.descricao);
  const termosTI = ti.válido ? ti.termosBranco : [];
  const termosCultura = termosCulturaEncontrados(entrada.titulo, entrada.descricao);
  if (termosTI.length === 0 && termosCultura.length === 0) return { eixo: null, termosTI, termosCultura };
  return { eixo: termosCultura.length > termosTI.length ? 'Cultura' : 'Pesquisa', termosTI, termosCultura };
}

/** Resultado de uma decisão tomada pela nota: carrega as notas e o resumo por camada para o registro do funil. */
function comNota(r: ResultadoTriagem, pont: Pontuacao, nota: Nota): ResultadoTriagem {
  return { ...r, pontuacao: { nota, resumo: descreverPontuacao(pont, nota) } };
}

/** Rótulo curto da nota para o motivo ("nota 72"). */
const rotuloNota = (nota: Nota) => `nota ${nota.notaFinal}`;

async function triarPesquisa(
  entrada: EntradaEdital,
  respostas: RespostasEdital | null,
  suspeitos: string[]
): Promise<ResultadoTriagem> {
  const whitelist = validarWhitelistTI(entrada.titulo, entrada.descricao);
  const termosBranco = whitelist.termosBranco;

  const pont = pontuar({ titulo: entrada.titulo, descricao: entrada.descricao, orgao: entrada.orgao, eixo: 'Pesquisa' });
  // Jev em mãos: classificação de tecnologia e probabilidades vêm da mesma consulta, sem nova chamada
  const doJev = respostas ? resultadoTIDasRespostas(respostas, entrada.titulo, { aceitarIncerto: true }) : null;
  const notaJev = respostas ? notaDoJev(respostas.eh_chamada.noul, respostas.relevante_ti.noul) : null;
  const nota = comporNota(pont.notaRegex, notaJev);
  // Sem Jev e sem nenhum termo forte de TI/Pesquisa não há o que pontuar: cai direto no bloqueio
  const faixa = !respostas && pont.eixo.fortes === 0 ? 'bloquear' : nota.faixa;
  const notaFinal: Nota = { ...nota, faixa };

  if (faixa === 'bloquear') {
    return comNota({ ...rejeitar('pontuacao', `Nota baixa (${rotuloNota(nota)}): sem sinais de TI/Pesquisa${respostas ? ' e o Jev confirma' : ''}`, 'Pesquisa', termosBranco), validacaoIA: doJev ?? undefined }, pont, notaFinal);
  }

  // Zona cinzenta (ou liberada sem Jev): a OpenAI, reserva já existente, desempata e completa a classificação
  let validacaoIA: AiClassificationResult | null = doJev;
  let desempate: AiClassificationResult | null = null;
  if (faixa === 'cinza' || !respostas) {
    desempate = await validarComOpenAI(
      entrada.titulo,
      entrada.descricao,
      entrada.valor,
      entrada.orgao,
      termosBranco.length > 0 ? termosBranco : entrada.termosBranco,
      entrada.tipoEdital,
      { pularJev: respostas !== null }
    );
    if (desempate.ok) validacaoIA = desempate;
  }

  const nota3 = suspeitos.length > 0 ? ` Termos suspeitos: ${suspeitos.slice(0, 3).join(', ')}.` : '';
  const base = { categoriaArea: 'Pesquisa' as const, termosBranco, ...(validacaoIA ? { validacaoIA } : {}) };

  if (desempate?.ok && !desempate.válido) {
    const certeza = desempate.confianca ?? desempate.confiança ?? 0;
    return comNota(
      certeza >= confiancaParaDescartar()
        ? { ...rejeitar('ia', desempate.razão, 'Pesquisa', termosBranco), ...base }
        : { ...emDuvida('ia', `Pouca certeza de que não é relevante (${certeza}%): ${desempate.razão}`, 'Pesquisa', termosBranco), ...base },
      pont, notaFinal
    );
  }

  if (faixa === 'liberar') {
    // Sem Jev a regra aceita, mas só a OpenAI confirmando tira a marca de incerto; termos suspeitos pedem revisão
    const confirmado = respostas !== null || desempate?.ok === true;
    return comNota({
      aceito: true,
      incerto: !confirmado || (suspeitos.length > 0 && !respostas),
      etapa: 'pontuacao',
      motivo: `Aprovado pela pontuação (${rotuloNota(nota)})${desempate?.ok ? `: ${desempate.razão}` : ''}.${nota3}`,
      ...base,
    }, pont, notaFinal);
  }

  // Zona cinzenta: só vale aceitar se a OpenAI confirmou com confiança; senão, Revisão Humana
  if (desempate?.ok && desempate.válido && (desempate.confianca ?? desempate.confiança ?? 0) >= confiancaMinimaJev()) {
    return comNota({
      aceito: true,
      incerto: false,
      etapa: 'ia',
      motivo: `${desempate.razão} (${rotuloNota(nota)}, desempate da OpenAI).${nota3}`,
      ...base,
    }, pont, notaFinal);
  }
  return comNota({
    ...emDuvida('pontuacao', `Pontuação indecisa (${rotuloNota(nota)}) e sem confirmação da IA: revisar.${nota3}`, 'Pesquisa', termosBranco),
    ...(validacaoIA ? { validacaoIA } : {}),
  }, pont, notaFinal);
}

function triarCultura(entrada: EntradaEdital, respostas: RespostasEdital | null): ResultadoTriagem {
  const termosBranco = termosCulturaEncontrados(entrada.titulo, entrada.descricao);
  const pont = pontuar({ titulo: entrada.titulo, descricao: entrada.descricao, orgao: entrada.orgao, eixo: 'Cultura' });
  const notaJev = respostas ? notaDoJev(respostas.eh_chamada.noul, respostas.relevante_cultura.noul) : null;
  const nota = comporNota(pont.notaRegex, notaJev);
  // Sem Jev e sem nenhum termo forte de cultura não há o que pontuar: cai direto no bloqueio
  const faixa = !respostas && pont.eixo.fortes === 0 ? 'bloquear' : nota.faixa;
  const notaFinal: Nota = { ...nota, faixa };
  const razaoJev = respostas ? julgamentoCulturaDasRespostas(respostas).razao : 'sem confirmação da IA';

  if (faixa === 'bloquear') {
    return comNota(rejeitar('pontuacao', `Nota baixa (${rotuloNota(nota)}): ${respostas ? razaoJev : 'sem termos de cultura'}`, 'Cultura', termosBranco), pont, notaFinal);
  }
  if (faixa === 'liberar') {
    return comNota({
      aceito: true,
      incerto: !respostas,
      categoriaArea: 'Cultura',
      etapa: 'cultura',
      motivo: respostas ? `${razaoJev} (${rotuloNota(nota)})` : `Aceito por termos de cultura (${termosBranco.slice(0, 3).join(', ')}), ${razaoJev} (${rotuloNota(nota)})`,
      termosBranco,
    }, pont, notaFinal);
  }
  return comNota(emDuvida('cultura', `Pontuação indecisa (${rotuloNota(nota)}), ${razaoJev}: revisar`, 'Cultura', termosBranco), pont, notaFinal);
}

/**
 * Triagem de um edital pelos dois eixos do sistema (Cultura e TI/Pesquisa).
 *
 * Eixo fixo no portal: aplica só a regra daquele eixo. Eixo `auto`: o Jev decide o eixo e a
 * relevância em uma única consulta; sem Jev, decide pelos termos de cada lista.
 */
export async function triarEdital(entrada: EntradaTriagem): Promise<ResultadoTriagem> {
  const regiao = restritoAOutraRegiao(entrada);
  if (regiao.restrito) return rejeitar('regiao', regiao.motivo ?? 'Restrito a outra região', null);

  const eixoPortal = entrada.eixoPortal ?? 'auto';
  // Termos da blacklist de TI viram informação para o Jev (não se aplicam ao eixo Cultura)
  const suspeitos = eixoPortal === 'Cultura'
    ? []
    : analisarBlacklist(entrada.titulo, `${entrada.titulo} ${entrada.descricao}`).termosEncontrados.map(t => t.termo);
  const respostas = await julgarEditalComJev({ ...entrada, termosSuspeitos: suspeitos });

  // Segunda camada (Jev): restrição territorial que as palavras do título não revelam
  const pRestrito = respostas?.restrito_a_outra_regiao?.noul;
  if (pRestrito !== undefined && pRestrito >= REGIAO_REJEITAR) {
    return rejeitar('regiao', `Jev: restrito a outra região (${Math.round(pRestrito * 100)}%)`, null);
  }

  // Primeiro filtro do Jev, comum aos dois eixos: precisa ser uma chamada com inscrição, não uma página do site
  if (respostas) {
    const pChamada = respostas.eh_chamada.noul;
    const certezaNaoChamada = Math.round((1 - pChamada) * 100);
    if (pChamada < 0.5 && certezaNaoChamada >= confiancaMinimaJev()) {
      return certezaNaoChamada >= confiancaParaDescartar()
        ? rejeitar('eixo', `Jev: não é chamada/edital, parece página do site (${certezaNaoChamada}%)`, null)
        : emDuvida('eixo', `Jev: possivelmente não é chamada/edital (${certezaNaoChamada}%), revisar`, null);
    }
  }

  let eixo: Eixo | null = eixoPortal === 'auto' ? null : eixoPortal;

  if (!eixo) {
    if (respostas) {
      const decidido = eixoDasRespostas(respostas);
      if (decidido.certeza >= confiancaMinimaJev()) {
        if (decidido.eixo === 'Fora') {
          return decidido.certeza >= confiancaParaDescartar()
            ? rejeitar('eixo', `Jev: fora do escopo (${decidido.certeza}%)`, null)
            : emDuvida('eixo', `Jev: possivelmente fora do escopo (${decidido.certeza}%), revisar`, null);
        }
        eixo = decidido.eixo;
      }
    }
    if (!eixo) {
      const porTermos = eixoPorTermos(entrada);
      if (!porTermos.eixo) {
        return respostas
          ? emDuvida('eixo', 'Jev incerto e sem termos de TI nem de cultura: revisar', null)
          : rejeitar('eixo', 'Sem termos de TI nem de cultura', null);
      }
      eixo = porTermos.eixo;
    }
  }

  return eixo === 'Cultura' ? triarCultura(entrada, respostas) : triarPesquisa(entrada, respostas, suspeitos);
}
