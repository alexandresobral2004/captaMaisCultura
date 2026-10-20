/**
 * Abrangência territorial: o sistema só quer editais abertos a quem está no Ceará,
 * ou seja, de abrangência Ceará, Nordeste ou Brasil. Editais restritos a outro estado
 * ou a um município são descartados.
 */

const ESTADOS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

/** Fundações estaduais de amparo à pesquisa de fora do Ceará (a FUNCAP é do Ceará e não entra aqui). */
const FAPS_OUTROS_ESTADOS = /\b(FAPESP|FAPEMIG|FAPERJ|FACEPE|FAPEAM|FAPES|FAPEMA|FAPESPA|FAPESB|FAPESC|FAPEG|FAPESQ|FAPEAL|FAPEMAT|FAPEPI|FAPERN|FAPERGS|FAPITEC|FUNDECT|FAPDF|FAPEAP|FAPERO|FAPEAC|FAPT|Funda[cç][aã]o Arauc[aá]ria)\b/;

/** Principais municípios cearenses: edital municipal deles é aberto a quem está no Ceará. */
const MUNICIPIOS_CEARA = /\b(Fortaleza|Sobral|Juazeiro do Norte|Caucaia|Maracana[uú]|Crato|Itapipoca|Maranguape|Iguatu|Quixad[aá]|Pacatuba|Aquiraz|Canind[eé]|Russas|Tiangu[aá]|Crate[uú]s|Aracati|Cascavel|Pacajus|Barbalha)\b/i;

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SINAIS_ABERTOS = /\b(nacional|brasil|federal|nordeste|todo o pa[ií]s|todo o brasil)\b/i;

export interface ResultadoRegiao {
  restrito: boolean;
  motivo?: string;
}

/** Texto antes do primeiro " - ", onde os portais costumam colocar a localidade ("BAHIA - CHAMAMENTO..."). */
function cabeca(titulo: string): string {
  return titulo.split(/\s[-–—]\s/)[0] ?? titulo;
}

function estadoCitado(texto: string): string | null {
  // Só casa com a grafia capitalizada ou em maiúsculas, para "para" (preposição) não virar "Pará"
  for (const [uf, nome] of Object.entries(ESTADOS)) {
    // "PARA" sem acento é a preposição em títulos em caixa alta, então Pará só casa acentuado
    const variantes = [nome, nome.toUpperCase(), ...(uf === 'PA' ? [] : [semAcento(nome).toUpperCase()])].join('|');
    if (new RegExp(`(?<![\\p{L}])(${variantes})(?![\\p{L}])`, 'u').test(texto)) return uf;
  }
  return null;
}

function siglaCitada(texto: string): string | null {
  const regex = /(?:^|[\s/(,-])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?=$|[\s/),.-])/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto))) {
    // "SE" seguido de outra palavra é o pronome ("ARTISTAS QUE SE DESTACAM"), não Sergipe
    if (m[1] === 'SE' && /^\s+[A-Za-zÀ-ÿ]/.test(texto.slice(m.index + m[0].length))) continue;
    return m[1];
  }
  return null;
}

export function restritoAOutraRegiao(entrada: { titulo: string; orgao?: string; descricao?: string }): ResultadoRegiao {
  const titulo = entrada.titulo || '';
  const orgao = entrada.orgao || '';
  const topo = cabeca(titulo);

  // Município: "CARATINGA MG - ...", "FORTALEZA/CE - ..." ou órgão municipal
  const sigla = siglaCitada(topo);
  const estadoNome = estadoCitado(topo);
  if (sigla && !SINAIS_ABERTOS.test(titulo)) {
    const antes = topo.split(new RegExp(`[\\s/(,-]${sigla}(?=$|[\\s/),.-])`))[0].replace(/[/\s-]+$/, '').trim();
    if (sigla !== 'CE' && antes.length > 0 && !estadoCitado(antes)) {
      return { restrito: true, motivo: `Restrito ao município de ${antes} (${sigla})` };
    }
  }
  const municipalDoCeara = MUNICIPIOS_CEARA.test(orgao) || MUNICIPIOS_CEARA.test(topo);
  if (/prefeitura|c[aâ]mara municipal|secretaria municipal|\bmunic[ií]pio de\b/i.test(orgao) && !SINAIS_ABERTOS.test(titulo) && !municipalDoCeara) {
    return { restrito: true, motivo: 'Edital municipal' };
  }

  // Estado: sigla ou nome na cabeça do título, ou sigla solta em qualquer parte
  const uf = estadoNome ?? sigla ?? siglaCitada(titulo);
  if (uf && uf !== 'CE' && !SINAIS_ABERTOS.test(titulo)) {
    return { restrito: true, motivo: `Restrito ao estado de ${ESTADOS[uf]}` };
  }

  // Órgão estadual de outro estado
  if (!uf && (FAPS_OUTROS_ESTADOS.test(orgao) || FAPS_OUTROS_ESTADOS.test(titulo))) {
    // FAPESP/ANR etc. citada em parceria nacional segue como restrita ao estado da fundação
    return { restrito: true, motivo: 'Fundação estadual de outro estado' };
  }
  const estadoOrgao = estadoCitado(orgao);
  if (/estado d[aeo]|governo d[aeo]|secretaria de estado/i.test(orgao) && estadoOrgao && estadoOrgao !== 'CE') {
    return { restrito: true, motivo: `Órgão do estado de ${ESTADOS[estadoOrgao]}` };
  }

  return { restrito: false };
}

export type Abrangencia = 'Ceará' | 'Nordeste' | 'Brasil';
export const ABRANGENCIAS: Abrangencia[] = ['Brasil', 'Nordeste', 'Ceará'];

/** Abrangência de um edital já aceito: Ceará, Nordeste ou Brasil (padrão). */
export function classificarAbrangencia(entrada: { titulo: string; orgao?: string; abrangencia?: string | null }): Abrangencia {
  if (entrada.abrangencia && (ABRANGENCIAS as string[]).includes(entrada.abrangencia)) return entrada.abrangencia as Abrangencia;
  const texto = `${entrada.titulo} ${entrada.orgao ?? ''}`;
  if (new RegExp('(?<![\\p{L}])(Cear[áa]|CEAR[ÁA]|FUNCAP|cearense)(?![\\p{L}])', 'u').test(texto) || siglaCitada(cabeca(entrada.titulo)) === 'CE') return 'Ceará';
  if (/nordeste/i.test(texto)) return 'Nordeste';
  return 'Brasil';
}
