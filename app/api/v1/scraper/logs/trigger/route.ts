import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Fire and forget via fetch to our own API
  try {
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    const token = process.env.SCAN_TOKEN || 'capta-mais-scan-token-secret-2026';
    
    // We use the existing weekly scan endpoint but run it asynchronously
    fetch(`${baseUrl}/api/jobs/run-weekly-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
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
