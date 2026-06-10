import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import OpenAI from 'openai';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const PROIBIDOS_REESCRITA = [
  'mergulhe', 'jornada', 'desvendar', 'em resumo', 'em conclusao',
  'crucial', 'imperativo', 'notavel', 'tesouro', 'ademais',
  'primeiramente', 'eh importante ressaltar', 'no cenario atual',
  'uma tapeçaria de', 'alavancar', 'multifacetado', 'sinergia', 'catalisador',
  'nesse contexto', 'é de fundamental importância', 'contribuindo assim para',
  'a fim de que', 'no âmbito', 'em consonância', 'consoante', 'outrossim',
  'haja vista', 'tendo em vista que', 'sobretudo', 'destarte', 'mormente',
  'acerca de', 'denota-se', 'ressalta-se', 'evidencia-se', 'depreende-se'
].join(', ');

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { secaoChave, secaoTitulo, conteudoAtual } = body;

    if (!secaoChave || !secaoTitulo || !conteudoAtual) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros ausentes (secaoChave, secaoTitulo, conteudoAtual são obrigatórios)' },
        { status: 400 }
      );
    }

    const service = new ProjetoService();
    const projeto = await service.buscarPorId(id);
    if (!projeto) {
      return NextResponse.json(
        { success: false, error: 'Projeto não encontrado' },
        { status: 404 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Chave OpenAI não configurada no servidor' },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // Informações adicionais do edital para contextualização
    const editalData = projeto.edital as any;
    const editalTitulo = editalData?.titulo || '';
    const editalObjetivo = editalData?.analiseIA?.objetivo || '';
    const editalOrgao = editalData?.orgao || '';

    const systemPrompt = `Você é um Produtor Cultural Sênior com 15 anos de atuação em captação de recursos via PRONAC, Lei Rouanet, Fundo Nacional de Cultura, Programa Aldir Blanc, editais da Secult-CE e FAR-CE. Sua escrita deve ser técnica, precisa e adaptada à realidade das bancas avaliadoras brasileiras.

A TAREFA:
Sua missão é aprimorar/reescrever o conteúdo atual da seção "${secaoTitulo}" (chave: "${secaoChave}") de um projeto cultural.
O objetivo é reescrever o texto sob uma abordagem narrativa DIFERENTE (mude a ordem das ideias, altere a estrutura dos argumentos, use outro vocabulário e expressões), mantendo todos os fatos, dados, quantitativos e metas descritos pelo usuário.

DIRETRIZES TÉCNICAS E RESTRICÕES RÍGIDAS:
1. Retorne o texto formatado obrigatoriamente em HTML rico, utilizando tags de parágrafos (<p>), listas (<ul>, <li>), negrito (<strong>), tabelas se necessário (<table>) para manter a excelente legibilidade do documento.
2. Não adicione saudações, conclusões amigáveis, conversas ou explicações. Retorne EXCLUSIVAMENTE o código HTML correspondente à seção.
3. Não use voz passiva ou linguagem poética. O tom deve ser formal, profissional, direto e ativo.
4. Você está terminantemente PROIBIDO de utilizar as seguintes expressões de IA e clichês: ${PROIBIDOS_REESCRITA}.`;

    const userPrompt = `PROJETO:
Título: ${projeto.titulo}
Descrição: ${projeto.descricao || ''}
Área de atuação: ${projeto.areaAtuacao || ''}

EDITAL:
Título: ${editalTitulo}
Órgão: ${editalOrgao}
Objetivo: ${editalObjetivo}

CONTEÚDO ATUAL DA SEÇÃO "${secaoTitulo}":
${conteudoAtual}

Reescreva a seção acima de forma inovadora e com variação semântica real, mantendo rigorosamente a conformidade técnica com o edital e os dados do projeto.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Maior temperatura para variação/criatividade na reescrita
    });

    const conteudoNovo = response.choices[0]?.message?.content?.trim() || '';

    // Atualizar no banco de dados para persistir a nova seção
    const secoesDinamicasAtuais = (projeto.secoesDinamicas as any[]) || [];
    const secoesDinamicasList = secoesDinamicasAtuais.map((s: any) => {
      if (s.chave === secaoChave) {
        return { ...s, conteudo: conteudoNovo };
      }
      return s;
    });

    const fieldsToUpdate: any = {
      secoesDinamicas: JSON.stringify(secoesDinamicasList)
    };

    // Atualiza também o campo plano correspondente caso seja uma seção padrão
    if (secaoChave === 'justificativa') fieldsToUpdate.justificativa = conteudoNovo;
    if (secaoChave === 'metodologia') fieldsToUpdate.metodologia = conteudoNovo;
    if (secaoChave === 'objetivos') fieldsToUpdate.objetivos = conteudoNovo;
    if (secaoChave === 'resumoExecutivo') fieldsToUpdate.resumoExecutivo = conteudoNovo;
    if (secaoChave === 'resultadosEsperados') fieldsToUpdate.resultadosEsperados = conteudoNovo;
    if (secaoChave === 'cronograma') fieldsToUpdate.cronograma = conteudoNovo;
    if (secaoChave === 'orcamentoDetalhado') fieldsToUpdate.orcamentoDetalhado = conteudoNovo;

    await service.atualizar(id, fieldsToUpdate);

    return NextResponse.json({
      success: true,
      conteudoNovo
    });
  } catch (error: any) {
    console.error('Erro ao aprimorar seção:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
