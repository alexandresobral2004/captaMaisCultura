import { NextRequest, NextResponse } from 'next/server';
import { criarProjetoCientificoSchema } from '@/lib/analise-cientifica/schema';
import { Logger } from '@/lib/analise-cientifica/logger';
import { projetos } from '@/lib/analise-cientifica/db-mock';
import { db } from '@/lib/database/db';
import { editais as editaisTable } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

// Logger para esta API
const logger = new Logger('api/projetos');

export async function GET(request: NextRequest) {
  try {
    logger.info(`GET /api/analise-cientifica/projetos`, 'api');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const area = searchParams.get('area');

    let lista = Array.from(projetos.values());

    // Filtrar apenas projetos com edital da categoria 'Pesquisa' (ou sem edital)
    const filteredLista = [];
    for (const p of lista) {
      if (!p.editalId) {
        filteredLista.push(p);
      } else {
        const [edital] = await db
          .select()
          .from(editaisTable)
          .where(eq(editaisTable.id, p.editalId))
          .limit(1);
        if (edital && edital.categoriaArea === 'Pesquisa') {
          filteredLista.push(p);
        }
      }
    }
    lista = filteredLista;

    if (status && status !== 'todos') {
      lista = lista.filter(p => p.status === status);
    }

    if (area && area !== 'todas') {
      lista = lista.filter(p => p.areaTematica === area);
    }

    logger.info(`Retornando ${lista.length} projetos`, 'api', { status, area });

    return NextResponse.json({
      success: true,
      data: lista,
      total: lista.length,
    });
  } catch (error: any) {
    logger.error(`Erro no GET /api/analise-cientifica/projetos`, 'api', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao buscar projetos',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.info(`POST /api/analise-cientifica/projetos`, 'api');

    const body = await request.json();

    // Validar dados de entrada
    const validado = criarProjetoCientificoSchema.parse(body);

    // Criar novo projeto
    const projeto = {
      id: crypto.randomUUID(),
      titulo: validado.titulo,
      areaTematica: validado.areaTematica,
      nivel: validado.nivel,
      status: 'rascunho',
      resumoExecutivo: '',
      justificativa: '',
      objetivos: {
        geral: '',
        especificos: [],
      },
      metodologia: '',
      resultadosEsperados: '',
      referencias: '',
      titulosPersonalizados: '{}',
      pesquisadoresProponentes: '[]',
      secoesDinamicas: JSON.stringify([
        { id: 'resumo', chave: 'resumo', titulo: 'Resumo Executivo', conteudo: '', completa: false, editavel: true, ordem: 0 },
        { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: '', completa: false, editavel: true, ordem: 1 },
        { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', completa: false, editavel: true, ordem: 2 },
        { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: '', completa: false, editavel: true, ordem: 3 },
        { id: 'resultados', chave: 'resultados', titulo: 'Resultados Esperados', conteudo: '', completa: false, editavel: true, ordem: 4 },
        { id: 'referencias', chave: 'referencias', titulo: 'Referências Bibliográficas (ABNT)', conteudo: '', completa: false, editavel: true, ordem: 5 }
      ]),
      orcamento: null,
      cronograma: [],
      equipe: [],
      editalId: validado.editalId,
      palavrasChave: [],
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      versao: 1,
    };

    projetos.set(projeto.id, projeto);

    logger.info(`Projeto criado: ${projeto.id}`, 'api', { titulo: projeto.titulo });

    return NextResponse.json({
      success: true,
      data: projeto,
    }, { status: 201 });
  } catch (error: any) {
    logger.error(`Erro no POST /api/analise-cientifica/projetos`, 'api', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao criar projeto',
    }, { status: 400 });
  }
}
