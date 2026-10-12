import { NextRequest, NextResponse } from 'next/server';
import { obterScanToken } from '@/lib/api/scan-token';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Fire and forget via fetch to our own API
  try {
    // URL vem da configuração, nunca de headers da requisição (evita vazar o token via Host forjado)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const token = obterScanToken();
    if (!token) {
      return NextResponse.json({ started: false, error: 'SCAN_TOKEN não configurado' }, { status: 500 });
    }
    
    // We use the existing weekly scan endpoint but run it asynchronously
    fetch(`${baseUrl}/api/jobs/run-weekly-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scan-Token': token,
      },
    }).catch(err => {
      console.error('Failed to trigger background scan:', err);
    });

    return NextResponse.json({ 
      started: true, 
      ts: new Date().toISOString() 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      started: false, 
      error: error.message 
    }, { status: 500 });
  }
}
