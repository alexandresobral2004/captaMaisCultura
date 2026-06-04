import { loadWhitelist } from '../scraper/filtros/loaders';

export function validarWhitelistTI(titulo: string, descricao: string): {
  válido: boolean;
  confidence: 'alta' | 'média' | 'baixa';
  termoEncontrado?: string;
  termosBranco: string[];
  categoria?: string;
} {
  const whitelist = loadWhitelist();
  const textoCompleto = `${titulo} ${descricao}`.toLowerCase();
  const termosBranco: string[] = [];

  for (const termo of whitelist.tecnologia) {
    if (textoCompleto.includes(termo.toLowerCase())) {
      termosBranco.push(termo);
    }
  }

  if (termosBranco.length >= 2) {
    return {
      válido: true,
      confidence: 'alta',
      termoEncontrado: termosBranco[0],
      termosBranco,
      categoria: 'Tecnologia TI'
    };
  }

  if (termosBranco.length === 1) {
    return {
      válido: true,
      confidence: 'média',
      termoEncontrado: termosBranco[0],
      termosBranco,
      categoria: 'Tecnologia TI'
    };
  }

  for (const termo of whitelist.contexto_institucional) {
    if (textoCompleto.includes(termo.toLowerCase())) {
      termosBranco.push(termo);
      return {
        válido: true,
        confidence: 'alta',
        termoEncontrado: termo,
        termosBranco,
        categoria: 'Pesquisa & Academia'
      };
    }
  }

  for (const termo of whitelist.contexto_geral) {
    if (textoCompleto.includes(termo.toLowerCase())) {
      termosBranco.push(termo);
      return {
        válido: true,
        confidence: 'baixa',
        termoEncontrado: termo,
        termosBranco,
        categoria: 'Desenvolvimento & Inovação'
      };
    }
  }

  return {
    válido: false,
    confidence: 'alta',
    termosBranco: [],
    categoria: 'Não identificado'
  };
}

// Para manter compatibilidade com exportações existentes que podem usar como objeto estático:
export const WHITELIST_TI = {
  get tecnologia() {
    return loadWhitelist().tecnologia;
  },
  get contexto_institucional() {
    return loadWhitelist().contexto_institucional;
  },
  get contexto_geral() {
    return loadWhitelist().contexto_geral;
  }
};