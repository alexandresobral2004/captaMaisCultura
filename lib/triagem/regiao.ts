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
const FAPS_OUTROS_ESTADOS = /\b(FAPESP|FAPEMIG|FAPERJ|FACEPE|FAPEAM|FAPES|FAPEMA|FAPESPA|FAPESB|FAPESC|FAPEG|FAPESQ|FAPEAL|FAPEMAT|FAPEPI|FAPERN|FAPERGS|FAPITEC|FUNDECT|FAPDF|Funda[cç][aã]o Arauc[aá]ria)\b/;

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
    const variantes = [nome, nome.toUpperCase(), semAcento(nome).toUpperCase()].join('|');
    if (new RegExp(`(?<![\\p{L}])(${variantes})(?![\\p{L}])`, 'u').test(texto)) return uf;
  }
  return null;
}

function siglaCitada(texto: string): string | null {
  const m = texto.match(/(?:^|[\s/(,-])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?=$|[\s/),.-])/);
  return m ? m[1] : null;
}

export function restritoAOutraRegiao(entrada: { titulo: string; orgao?: string; descricao?: string }): ResultadoRegiao {
  const titulo = entrada.titulo || '';
  const orgao = entrada.orgao || '';
  const topo = cabeca(titulo);

  // Município: "CARATINGA MG - ...", "FORTALEZA/CE - ..." ou órgão municipal
  const sigla = siglaCitada(topo);
  const estadoNome = estadoCitado(topo);
  if (sigla) {
    const antes = topo.split(new RegExp(`[\\s/(,-]${sigla}(?=$|[\\s/),.-])`))[0].replace(/[/\s-]+$/, '').trim();
    if (antes.length > 0 && !estadoCitado(antes)) {
      return { restrito: true, motivo: `Restrito ao município de ${antes} (${sigla})` };
    }
  }
  if (/prefeitura|c[aâ]mara municipal|secretaria municipal|\bmunic[ií]pio de\b/i.test(orgao) && !SINAIS_ABERTOS.test(titulo)) {
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
