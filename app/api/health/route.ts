import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'podrabotka154',
    timestamp: new Date().toISOString(),
  });
}
