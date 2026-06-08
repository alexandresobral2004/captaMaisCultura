import { NextRequest, NextResponse } from 'next/server';
import { PromptRepository } from '@/lib/database/repositories/prompt.repository';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/api/auth';

const updatePromptSchema = z.object({
  conteudo: z.string().min(1),
  justificativa: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const repository = new PromptRepository();
    const { searchParams } = new URL(request.url);
    const modulo = searchParams.get('modulo');
    const chave = searchParams.get('chave');

    if (modulo && chave) {
      const completo = await repository.getPromptCompleto(modulo, chave);
      if (!completo) {
        return NextResponse.json(
          { success: false, error: 'Prompt não encontrado' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: completo,
      });
    }

    const promptsPorModulo = await repository.listarPromptsPorModulo();

    return NextResponse.json({
      success: true,
      data: promptsPorModulo,
    });
  } catch (error: any) {
    console.error('Erro ao listar prompts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = verificarAdmin(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body = await request.json();
    const validated = updatePromptSchema.parse(body);

    const { modulo, chave } = body;
    if (!modulo || !chave) {
      return NextResponse.json(
        { success: false, error: 'Módulo e chave são obrigatórios' },
        { status: 400 }
      );
    }

    const repository = new PromptRepository();
    const promptSistema = await repository.getSistemaByModuloChave(modulo, chave);

    if (!promptSistema) {
      return NextResponse.json(
        { success: false, error: 'Prompt sistema não encontrado' },
        { status: 404 }
      );
    }

    const customizadoExistente = await repository.getCustomizadoBySistemaId(promptSistema.id);
    const criadoPor = adminCheck.usuario.email;

    if (customizadoExistente) {
      await repository.updateCustomizado(
        customizadoExistente.id,
        validated.conteudo,
        criadoPor,
        validated.justificativa
      );

      return NextResponse.json({
        success: true,
        message: 'Prompt atualizado com sucesso',
        data: { id: customizadoExistente.id },
      });
    } else {
      const id = await repository.createCustomizadoFromSistema(
        promptSistema.id,
        validated.conteudo,
        criadoPor
      );

      return NextResponse.json({
        success: true,
        message: 'Prompt customizado criado com sucesso',
        data: { id },
      }, { status: 201 });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Erro ao salvar prompt:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
