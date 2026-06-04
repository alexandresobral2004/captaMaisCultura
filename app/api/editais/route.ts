import { NextResponse } from 'next/server';
import { getAllEditais, saveEdital } from '@/lib/db/editais-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const editais = await getAllEditais(); // Retorna apenas os editais abertos por padrão (TRAVA ATIVA)
    return NextResponse.json(editais);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar editais cadastrados: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.titulo || !body.orgao || !body.dataLimite) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }

    const edital = await saveEdital(body);
    return NextResponse.json(edital);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao cadastrar edital: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
