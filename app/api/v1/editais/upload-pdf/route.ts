import { NextRequest, NextResponse } from 'next/server';
import { EditalUploadService } from '@/lib/database/services/edital-upload.service';

export async function POST(request: NextRequest) {
  try {
    const service = new EditalUploadService();

    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;
    const titulo = formData.get('titulo') as string | null;
    const orgao = formData.get('orgao') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: 'Arquivo PDF é obrigatório' } },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: { message: 'Apenas arquivos PDF são permitidos' } },
        { status: 400 }
      );
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: { message: 'Arquivo deve ter no máximo 50MB' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await service.processarUpload({
      titulo: titulo || undefined,
      orgao: orgao || undefined,
      pdfBuffer: buffer,
      nomeOriginal: file.name,
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro no upload de PDF:', error);
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Erro ao processar upload' } },
      { status: 500 }
    );
  }
}