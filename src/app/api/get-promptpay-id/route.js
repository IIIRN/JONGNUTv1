// src/app/api/get-promptpay-id/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const promptPayId = process.env.PROMPTPAY_ID;
    
    if (!promptPayId) {
      return NextResponse.json(
        { error: 'PromptPay ID not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ promptPayId });
  } catch (error) {
    console.error('Error getting PromptPay ID:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
