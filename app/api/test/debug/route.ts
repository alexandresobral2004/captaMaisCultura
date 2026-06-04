import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Body received:', JSON.stringify(body));
    
    return NextResponse.json({
      received: body,
      contentType: request.headers.get('content-type'),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Debug route working' });
}
