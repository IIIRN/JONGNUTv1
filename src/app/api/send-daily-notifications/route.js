import { NextResponse } from 'next/server';
import { sendDailyNotificationsNow } from '@/app/actions/dailyNotificationActions';

export async function POST(request) {
    try {
        const result = await sendDailyNotificationsNow();
        
        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json(result, { status: 400 });
        }
    } catch (error) {
        console.error("Manual daily notification API error:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}

export async function GET(request) {
    // Allow GET requests too for easier testing
    return POST(request);
}

