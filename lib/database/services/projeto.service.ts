import { ProjetoRepository, CreateProjetoDTO, ListProjetoQuery } from '../repositories/projeto.repository';
import { AnaliseRepository } from '../repositories/analise.repository';
import { EditalRepository } from '../repositories/edital.repository';

export class ProjetoService {
  private projetoRepo: ProjetoRepository;
  private analiseRepo: AnaliseRepository;
  private editalRepo: EditalRepository;

  constructor() {
    this.projetoRepo = new ProjetoRepository();
    this.analiseRepo = new AnaliseRepository();
    this.editalRepo = new EditalRepository();
  }

  async criar(data: CreateProjetoDTO) {
    // Verificar se edital existe
    const edital = await this.editalRepo.findById(data.editalId);
    if (!edital) {
      throw new Error('Edital nao encontrado');
    }

    return this.projetoRepo.create(data);
  }

  async buscarPorId(id: string) {
    const projeto = await this.projetoRepo.findByIdWithEdital(id);
    if (!projeto) return null;

    const analise = await this.analiseRepo.findByEditalId(projeto.editalId);

    const parseJsonField = (value: any): any => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };

    let secoesDinamicasList: any[] = [];
    if (projeto.secoesDinamicas) {
      try {
        secoesDinamicasList = typeof projeto.secoesDinamicas === 'string'
          ? JSON.parse(projeto.secoesDinamicas)
          : projeto.secoesDinamicas;
      } catch {
        secoesDinamicasList = [];
      }
    }

    if (!secoesDinamicasList || secoesDinamicasList.length === 0) {
      if (analise && analise.secoesRequeridas && analise.secoesRequeridas.length > 0) {
        secoesDinamicasList = analise.secoesRequeridas.map((secaoNome: string, idx: number) => {
          const chave = secaoNome
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "")
            .trim();
          return {
            id: chave || `secao${idx}`,
            chave: chave || `secao${idx}`,
            titulo: secaoNome,
            conteudo: '',
            ordem: idx,
            editavel: true
          };
        });
      } else {
        const defaultSecoes = [
          {
            id: 'resumoExecutivo',
            chave: 'resumoExecutivo',
            titulo: 'Resumo Executivo',
            conteudo: projeto.resumoExecutivo ? `<p>${projeto.resumoExecutivo.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '',
            ordem: 0,
            editavel: true
          },
          {
            id: 'justificativa',
            chave: 'justificativa',
            titulo: 'Justificativa',
            conteudo: projeto.justificativa ? `<p>${projeto.justificativa.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '',
            ordem: 1,
            editavel: true
          },
          {
            id: 'objetivos',
            chave: 'objetivos',
            titulo: 'Objetivos',
            conteudo: projeto.objetivos ? formatarObjetivosHTML(projeto.objetivos) : '',
            ordem: 2,
            editavel: true
          },
          {
            id: 'metodologia',
            chave: 'metodologia',
            titulo: 'Metodologia',
            conteudo: projeto.metodologia ? `<p>${projeto.metodologia.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '',
            ordem: 3,
            editavel: true
          },
          {
            id: 'resultadosEsperados',
            chave: 'resultadosEsperados',
            titulo: 'Resultados Esperados',
            conteudo: projeto.resultadosEsperados ? formatarResultadosHTML(projeto.resultadosEsperados) : '',
            ordem: 4,
            editavel: true
          },
          {
            id: 'cronograma',
            chave: 'cronograma',
            titulo: 'Cronograma',
            conteudo: projeto.cronograma ? `<p>${projeto.cronograma.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '',
            ordem: 5,
            editavel: true
          },
          {
            id: 'orcamentoDetalhado',
            chave: 'orcamentoDetalhado',
            titulo: 'Orçamento Detalhado',
            conteudo: projeto.orcamentoDetalhado ? formatarOrcamentoHTML(projeto.orcamentoDetalhado) : '',
            ordem: 6,
            editavel: true
          },
        ];
        secoesDinamicasList = defaultSecoes;
      }

      // Atualizar o banco de dados com as seções migradas ou geradas
      await this.projetoRepo.update(projeto.id, {
        secoesDinamicas: JSON.stringify(secoesDinamicasList)
      });
    }

    let secoesDinamicasAlteradas = false;
    if (secoesDinamicasList.length > 0) {
      secoesDinamicasList = secoesDinamicasList.map(s => {
        const conteudoStr = (s.conteudo || '').trim();
        // Detecta se o conteudo é JSON bruto (começa com { ou [) ou se parece com JSON stringificado
        const isJsonBruto = conteudoStr.startsWith('{') || conteudoStr.startsWith('[');
        // Verifica por chaves JSON mesmo com escapes (ex: \"curtoPrazo\" ou \\\"curtoPrazo\\\")
        const pareceJsonString =
          conteudoStr.includes('curtoPrazo') ||
          conteudoStr.includes('medioPrazo') ||
          conteudoStr.includes('longoPrazo') ||
          conteudoStr.includes('"curtoPrazo"') ||
          conteudoStr.includes('"medioPrazo"') ||
          conteudoStr.includes('"longoPrazo"') ||
          conteudoStr.includes('\\"curtoPrazo\\"') ||
          conteudoStr.includes('\\"medioPrazo\\"') ||
          conteudoStr.includes('\\"longoPrazo\\"');

        if (isJsonBruto || pareceJsonString) {
          secoesDinamicasAlteradas = true;
          if (s.chave === 'objetivos') {
            return { ...s, conteudo: formatarObjetivosHTML(conteudoStr) };
          } else if (s.chave === 'orcamentoDetalhado') {
            return { ...s, conteudo: formatarOrcamentoHTML(conteudoStr) };
          } else if (s.chave === 'resultadosEsperados') {
            return { ...s, conteudo: formatarResultadosHTML(conteudoStr) };
          }
        }
        return s;
      });

      if (secoesDinamicasAlteradas) {
        await this.projetoRepo.update(projeto.id, {
          secoesDinamicas: JSON.stringify(secoesDinamicasList)
        });
      }
    }

    return {
      ...projeto,
      secoesDinamicas: secoesDinamicasList,
      equipe: parseJsonField(projeto.equipe),
      criteriosAtendidos: parseJsonField(projeto.criteriosAtendidos),
      criteriosPendentes: parseJsonField(projeto.criteriosPendentes),
      dadosProponente: parseJsonField(projeto.dadosProponente),
      edital: {
        ...projeto.edital,
        analiseIA: analise,
      },
    };
  }

  async listar(query: ListProjetoQuery) {
    return this.projetoRepo.findAll(query);
  }

  async atualizar(id: string, data: Partial<CreateProjetoDTO>) {
    const existente = await this.projetoRepo.findById(id);
    if (!existente) {
      throw new Error('Projeto nao encontrado');
    }

    // Se estamos atualizando campos estáticos individuais (como na geração por IA),
    // devemos refletir essas atualizações nas seções dinâmicas.
    if (
      data.resumoExecutivo !== undefined ||
      data.justificativa !== undefined ||
      data.objetivos !== undefined ||
      data.metodologia !== undefined ||
      data.resultadosEsperados !== undefined ||
      data.cronograma !== undefined ||
      data.orcamentoDetalhado !== undefined
    ) {
      let secoesDinamicasList: any[] = [];
      if (data.secoesDinamicas !== undefined) {
        try {
          secoesDinamicasList = typeof data.secoesDinamicas === 'string'
            ? JSON.parse(data.secoesDinamicas)
            : data.secoesDinamicas;
        } catch {
          secoesDinamicasList = [];
        }
      } else if (existente.secoesDinamicas) {
        try {
          secoesDinamicasList = JSON.parse(existente.secoesDinamicas);
        } catch {
          secoesDinamicasList = [];
        }
      }

      if (secoesDinamicasList.length === 0) {
        secoesDinamicasList = [
          { id: 'resumoExecutivo', chave: 'resumoExecutivo', titulo: 'Resumo Executivo', conteudo: '', ordem: 0, editavel: true },
          { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: '', ordem: 1, editavel: true },
          { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', ordem: 2, editavel: true },
          { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: '', ordem: 3, editavel: true },
          { id: 'resultadosEsperados', chave: 'resultadosEsperados', titulo: 'Resultados Esperados', conteudo: '', ordem: 4, editavel: true },
          { id: 'cronograma', chave: 'cronograma', titulo: 'Cronograma', conteudo: '', ordem: 5, editavel: true },
          { id: 'orcamentoDetalhado', chave: 'orcamentoDetalhado', titulo: 'Orçamento Detalhado', conteudo: '', ordem: 6, editavel: true },
        ];
      }

      const updateSecao = (chave: string, novoConteudoHTML: string) => {
        const idx = secoesDinamicasList.findIndex(s => s.chave === chave);
        if (idx !== -1) {
          secoesDinamicasList[idx].conteudo = novoConteudoHTML;
        } else {
          secoesDinamicasList.push({
            id: chave,
            chave,
            titulo: chave.charAt(0).toUpperCase() + chave.slice(1).replace(/([A-Z])/g, ' $1'),
            conteudo: novoConteudoHTML,
            ordem: secoesDinamicasList.length,
            editavel: true
          });
        }
      };

      if (data.resumoExecutivo !== undefined) {
        updateSecao('resumoExecutivo', data.resumoExecutivo ? `<p>${data.resumoExecutivo.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '');
      }
      if (data.justificativa !== undefined) {
        updateSecao('justificativa', data.justificativa ? `<p>${data.justificativa.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '');
      }
      if (data.objetivos !== undefined) {
        updateSecao('objetivos', data.objetivos ? formatarObjetivosHTML(data.objetivos) : '');
      }
      if (data.metodologia !== undefined) {
        updateSecao('metodologia', data.metodologia ? `<p>${data.metodologia.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '');
      }
      if (data.resultadosEsperados !== undefined) {
        updateSecao('resultadosEsperados', data.resultadosEsperados ? formatarResultadosHTML(data.resultadosEsperados) : '');
      }
      if (data.cronograma !== undefined) {
        updateSecao('cronograma', data.cronograma ? `<p>${data.cronograma.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '');
      }
      if (data.orcamentoDetalhado !== undefined) {
        updateSecao('orcamentoDetalhado', data.orcamentoDetalhado ? formatarOrcamentoHTML(data.orcamentoDetalhado) : '');
      }

      data.secoesDinamicas = JSON.stringify(secoesDinamicasList);
    }

    return this.projetoRepo.update(id, data);
  }

  async deletar(id: string) {
    const existente = await this.projetoRepo.findById(id);
    if (!existente) {
      throw new Error('Projeto nao encontrado');
    }

    await this.projetoRepo.delete(id);
    return true;
  }

  async contarTotal(): Promise<number> {
    return this.projetoRepo.count();
  }

  async buscarPorEditalId(editalId: string) {
    return this.projetoRepo.findByEditalId(editalId);
  }
}

// Funções Auxiliares de Formatação para Migração
function cleanJsonString(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (char === '"' && !escaped) {
      inString = !inString;
    }

    if (char === '\\' && inString) {
      escaped = !escaped;
    } else {
      escaped = false;
    }

    if (inString && (char === '\n' || char === '\r')) {
      result += '\\n';
    } else {
      result += char;
    }
  }
  return result;
}

function safeParse(val: any): any {
  if (typeof val !== 'string') return val;
  try {
    const sanitized = cleanJsonString(val);
    let parsed = JSON.parse(sanitized);
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(cleanJsonString(parsed)); } catch { return parsed; }
    }
    return parsed;
  } catch {
    return val;
  }
}

function formatarObjetivosHTML(objetivosJson: string): string {
  try {
    const obj = safeParse(objetivosJson);
    if (!obj || typeof obj !== 'object') {
      return objetivosJson ? `<p>${objetivosJson}</p>` : '';
    }
    let html = '';
    if (obj.geral) {
      html += `<h3>Objetivo Geral</h3><p>${obj.geral}</p>`;
    }
    if (obj.especificos && Array.isArray(obj.especificos) && obj.especificos.length > 0) {
      html += `<h3>Objetivos Específicos</h3><ul>`;
      obj.especificos.forEach((oe: any) => {
        html += `<li><strong>${oe.cod || 'OE'}</strong>: ${oe.descricao || ''}`;
        if (oe.indicador || oe.meta) {
          html += ` <em>(Indicador: ${oe.indicador || '-'} | Meta: ${oe.meta || '-'})</em>`;
        }
        html += `</li>`;
      });
      html += `</ul>`;
    }
    return html || (objetivosJson ? `<p>${objetivosJson}</p>` : '');
  } catch {
    return objetivosJson ? `<p>${objetivosJson}</p>` : '';
  }
}

function formatarOrcamentoHTML(orcamentoJson: string): string {
  try {
    const obj = safeParse(orcamentoJson);
    if (!obj || typeof obj !== 'object') {
      return orcamentoJson ? `<p>${orcamentoJson}</p>` : '';
    }
    let html = `<h3>Orçamento Detalhado</h3><table border="1" style="width:100%; border-collapse:collapse; text-align:left;">`;
    html += `<thead style="background-color:#f1f5f9;"><tr><th style="padding:8px;">Categoria</th><th style="padding:8px; text-align:right;">Valor</th><th style="padding:8px;">Justificativa</th></tr></thead><tbody>`;

    const categorias = ['administracao', 'divulgacao', 'equipe', 'materiais', 'outros'];
    categorias.forEach(cat => {
      if (obj[cat]) {
        const valor = obj[cat].valor ? `R$ ${Number(obj[cat].valor).toLocaleString('pt-BR')}` : 'R$ 0,00';
        html += `<tr><td style="padding:8px; text-transform:capitalize;"><strong>${cat}</strong></td><td style="padding:8px; text-align:right;">${valor}</td><td style="padding:8px; color:#475569;">${obj[cat].justificativa || ''}</td></tr>`;
      }
    });

    const total = obj.total ? `R$ ${Number(obj.total).toLocaleString('pt-BR')}` : 'R$ 0,00';
    html += `</tbody><tfoot><tr style="background-color:#f1f5f9; font-weight:bold;"><td style="padding:8px;">TOTAL</td><td style="padding:8px; text-align:right;">${total}</td><td style="padding:8px;"></td></tr></tfoot></table>`;
    return html;
  } catch {
    return orcamentoJson ? `<p>${orcamentoJson}</p>` : '';
  }
}

function formatarResultadosHTML(resultadosJson: string): string {
  try {
    const obj = safeParse(resultadosJson);
    if (!obj || typeof obj !== 'object') {
      return resultadosJson ? `<p>${resultadosJson}</p>` : '';
    }
    let html = '';
    const horizontes = [
      { key: 'curtoPrazo', label: 'Curto Prazo (0-12 meses)' },
      { key: 'medioPrazo', label: 'Médio Prazo (1-3 anos)' },
      { key: 'longoPrazo', label: 'Longo Prazo (3+ anos)' },
    ];
    horizontes.forEach(h => {
      if (obj[h.key]) {
        html += `<h3>${h.label}</h3><p>${obj[h.key].descricao || ''}</p>`;
        if (obj[h.key].indicadores && Array.isArray(obj[h.key].indicadores) && obj[h.key].indicadores.length > 0) {
          html += `<ul>`;
          obj[h.key].indicadores.forEach((ind: any) => {
            html += `<li><strong>Indicador:</strong> ${ind.indicador || ''} — <strong>Meta:</strong> ${ind.meta || ''}</li>`;
          });
          html += `</ul>`;
        }
      }
    });
    return html || (resultadosJson ? `<p>${resultadosJson}</p>` : '');
  } catch {
    return resultadosJson ? `<p>${resultadosJson}</p>` : '';
  }
}
