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
import { termosCulturaEncontrados, pareceNaoEdital } from './cultura';
import { restritoAOutraRegiao } from './regiao';

export type { Eixo } from '../filtros-ti/jev-classifier';

/** Eixo configurado no portal: fixo (Cultura/Pesquisa) ou decidido edital a edital (auto). */
export type EixoPortal = 'auto' | Eixo;

export type EtapaTriagem = 'eixo' | 'whitelist' | 'ia' | 'blacklist' | 'cultura' | 'regiao';

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

async function triarPesquisa(
  entrada: EntradaEdital,
  respostas: RespostasEdital | null,
  suspeitos: string[]
): Promise<ResultadoTriagem> {
  const whitelist = validarWhitelistTI(entrada.titulo, entrada.descricao);
  const termosBranco = whitelist.termosBranco;

  // Julgamento do Jev já em mãos: evita nova consulta; incerto escala para a OpenAI (reserva)
  let validacaoIA: AiClassificationResult | null = respostas
    ? resultadoTIDasRespostas(respostas, entrada.titulo)
    : null;
  const doJev = validacaoIA !== null;

  // A whitelist não rejeita mais sozinha: ela só vira informação para as IAs
  if (!validacaoIA) {
    validacaoIA = await validarComOpenAI(
      entrada.titulo,
      entrada.descricao,
      entrada.valor,
      entrada.orgao,
      termosBranco.length > 0 ? termosBranco : entrada.termosBranco,
      entrada.tipoEdital,
      { pularJev: respostas !== null }
    );
    // Nenhuma IA respondeu e não há nenhum termo de TI: nada que sustente aceitar o edital
    if (!validacaoIA.ok && !whitelist.válido) {
      return rejeitar('whitelist', 'Sem termo de TI/Pesquisa e nenhuma IA disponível', 'Pesquisa');
    }
  }

  if (validacaoIA.ok && !validacaoIA.válido) {
    const certeza = validacaoIA.confianca ?? validacaoIA.confiança ?? 0;
    if (certeza >= confiancaParaDescartar()) {
      return { ...rejeitar('ia', validacaoIA.razão, 'Pesquisa', termosBranco), validacaoIA };
    }
    return { ...emDuvida('ia', `Pouca certeza de que não é relevante (${certeza}%): ${validacaoIA.razão}`, 'Pesquisa', termosBranco), validacaoIA };
  }

  // Termos da blacklist não rejeitam: com o Jev seguro só ficam no motivo; sem ele, vão para revisão
  const nota = suspeitos.length > 0 ? ` Termos suspeitos: ${suspeitos.slice(0, 3).join(', ')}.` : '';
  return {
    aceito: true,
    incerto: !validacaoIA.ok || (suspeitos.length > 0 && !doJev),
    categoriaArea: 'Pesquisa',
    etapa: 'ia',
    motivo: (validacaoIA.ok ? validacaoIA.razão : `Classificação indisponível: ${validacaoIA.mensagem}`) + nota,
    termosBranco,
    validacaoIA,
  };
}

function triarCultura(entrada: EntradaEdital, respostas: RespostasEdital | null): ResultadoTriagem {
  const termosBranco = termosCulturaEncontrados(entrada.titulo, entrada.descricao);

  if (respostas) {
    const j = julgamentoCulturaDasRespostas(respostas);
    if (j.confianca >= confiancaMinimaJev()) {
      if (j.valido) return { aceito: true, incerto: false, categoriaArea: 'Cultura', etapa: 'cultura', motivo: j.razao, termosBranco };
      return j.confianca >= confiancaParaDescartar()
        ? rejeitar('cultura', j.razao, 'Cultura', termosBranco)
        : emDuvida('cultura', `Pouca certeza de que não é relevante (${j.confianca}%): ${j.razao}`, 'Cultura', termosBranco);
    }
    // Jev incerto: segue para a regra por termos, aceitando com ressalva
  }

  if (pareceNaoEdital(entrada.titulo, entrada.descricao)) {
    return rejeitar('cultura', 'Parece notícia/resultado, não edital', 'Cultura', termosBranco);
  }
  if (termosBranco.length === 0) {
    return respostas
      ? emDuvida('cultura', 'Jev incerto e sem termos de cultura: revisar', 'Cultura')
      : rejeitar('whitelist', 'Sem termo de cultura', 'Cultura');
  }
  return {
    aceito: true,
    incerto: true,
    categoriaArea: 'Cultura',
    etapa: 'cultura',
    motivo: `Aceito por termos de cultura (${termosBranco.slice(0, 3).join(', ')}), sem confirmação da IA`,
    termosBranco,
  };
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
  if (pRestrito !== undefined && pRestrito >= 0.8) {
    return rejeitar('regiao', `Jev: restrito a outra região (${Math.round(pRestrito * 100)}%)`, null);
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
