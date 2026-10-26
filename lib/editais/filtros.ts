import type { Edital } from '@/components/editais/tipos';
import { classificarAbrangencia } from '@/lib/triagem/regiao';

export type EixoFiltro = 'todos' | 'Cultura' | 'Pesquisa';

export interface FiltrosEditais {
  busca: string;
  eixo: EixoFiltro;
  areas: string[];
  tipos: string[];
  tiposEdital: string[];
  abrangencias: string[];
  ordenacao: 'recentes' | 'antigos';
}

export const FILTROS_INICIAIS: FiltrosEditais = {
  busca: '',
  eixo: 'todos',
  areas: [],
  tipos: [],
  tiposEdital: [],
  abrangencias: [],
  ordenacao: 'recentes',
};

/** Normaliza texto para comparação: sem acentos, minúsculo e com espaços colapsados. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aplica os filtros da tela e ordena por data (criação ou limite). */
export function filtrarEOrdenarEditais(editais: Edital[], filtros: FiltrosEditais): Edital[] {
return editais.filter(edital => {
  if (edital.statusAnalise === 'descartado') return false; // Esconde os descartados

  // Busca ignora maiúsculas, acentos e quebras de linha do PDF; cobre o texto completo, não só a descrição
  const termo = normalizarBusca(filtros.busca);
  const matchSearch = !termo ||
    normalizarBusca(edital.titulo).includes(termo) ||
    normalizarBusca(edital.orgao).includes(termo) ||
    normalizarBusca(edital.descricao).includes(termo) ||
    normalizarBusca(edital.conteudoCompleto ?? '').includes(termo);
    
  // Áreas do IA se existirem, senão fallback simples
  const matchArea = filtros.areas.length === 0 || filtros.areas.some(area => {
    if (edital.areasTematicas && edital.areasTematicas.length > 0) {
       return edital.areasTematicas.some(a => a.toLowerCase().includes(area.toLowerCase()));
    }
    const t = edital.titulo.toLowerCase() + ' ' + edital.descricao.toLowerCase();
    if (area === "Saúde") return t.includes('saúde') || t.includes('médico') || t.includes('hospital');
    if (area === "Educação") return t.includes('escola') || t.includes('educação') || t.includes('ensino') || t.includes('universidade');
    if (area === "Cultura") return t.includes('cultura') || t.includes('biblioteca') || t.includes('museu') || t.includes('patrimônio');
    if (area === "Infraestrutura") return t.includes('via') || t.includes('pavimentação') || t.includes('infraestrutura') || t.includes('construção');
    if (area === "Esporte") return t.includes('esporte') || t.includes('quadra') || t.includes('poliesportiva');
    return false;
  });

  const matchTipo = filtros.tipos.length === 0 || filtros.tipos.some(tipo => {
    if (edital.tipoProponente && edital.tipoProponente.length > 0) {
      return edital.tipoProponente.some(t => t.toLowerCase().includes(tipo.toLowerCase()));
    }
    const o = edital.orgao.toLowerCase();
    if (tipo === "Federal") return o.includes('ministério') || o.includes('finep') || o.includes('cnpq');
    if (tipo === "Estadual") return o.includes('secretaria') || o.includes('fapesp') || o.includes('estadual');
    if (tipo === "ONG") return edital.descricao.toLowerCase().includes('ong') || edital.descricao.toLowerCase().includes('terceiro setor');
    return true;
  });

  const matchAbrangencia = filtros.abrangencias.length === 0 || filtros.abrangencias.includes(classificarAbrangencia(edital));

  // Filtro por tipo de edital (Evento, TI, etc)
  const matchTipoEdital = filtros.tiposEdital.length === 0 || filtros.tiposEdital.some(tipoFiltro => {
    if (tipoFiltro === "Evento") {
      return edital.tipoEdital === 'evento_cientifico' || 
             edital.titulo.toLowerCase().includes('congresso') ||
             edital.titulo.toLowerCase().includes('seminário') ||
             edital.titulo.toLowerCase().includes('conferência') ||
             edital.titulo.toLowerCase().includes('workshop');
    }
    if (tipoFiltro === "TI") {
      return edital.tecnologiaFoco && (
        edital.tecnologiaFoco.includes('Software') ||
        edital.tecnologiaFoco.includes('Cloud') ||
        edital.tecnologiaFoco.includes('Machine Learning') ||
        edital.tecnologiaFoco.includes('Desenvolvimento')
      ) ||
      edital.titulo.toLowerCase().includes('software') ||
      edital.titulo.toLowerCase().includes('tecnologia') ||
      edital.titulo.toLowerCase().includes('programação') ||
      edital.titulo.toLowerCase().includes('sistema');
    }
    if (tipoFiltro === "Pesquisa") {
      return edital.tipoEdital === 'chamada_publica' ||
             edital.titulo.toLowerCase().includes('pesquisa') ||
             edital.titulo.toLowerCase().includes('bolsa') ||
             edital.titulo.toLowerCase().includes('investigação');
    }
    return true;
  });

  // Eixo gravado na triagem; editais antigos sem eixo contam como Cultura (padrão do banco)
  const matchEixo = filtros.eixo === 'todos' || (edital.categoriaArea || 'Cultura') === filtros.eixo;

  return matchEixo && matchSearch && matchArea && matchTipo && matchTipoEdital && matchAbrangencia;
}).sort((a, b) => {
  // Ordenar por data de lançamento
  const dataA = new Date(a.criadoEm || a.dataLimite || 0).getTime();
  const dataB = new Date(b.criadoEm || b.dataLimite || 0).getTime();
  
  if (filtros.ordenacao === 'recentes') {
    return dataB - dataA; // Mais recentes primeiro
  } else {
    return dataA - dataB; // Mais antigos primeiro
  }
});
}
