import { NextResponse } from 'next/server';
import {
    sendNewBookingFlexMessage,
    sendAppointmentConfirmedFlexMessage,
    sendPaymentFlexMessage,
    sendServiceCompletedFlexMessage,
    sendReviewFlexMessage,
    sendAppointmentReminderFlexMessage
} from '@/app/actions/lineFlexActions';

export async function POST(request) {
    try {
        const { action, userId, data } = await request.json();

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'LINE User ID is required' },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case 'testNewBooking':
                result = await sendNewBookingFlexMessage(userId, data);
                break;

            case 'testAppointmentConfirmed':
                result = await sendAppointmentConfirmedFlexMessage(userId, data);
                break;

            case 'testPaymentRequest':
                result = await sendPaymentFlexMessage(userId, data);
                break;

            case 'testServiceCompleted':
                result = await sendServiceCompletedFlexMessage(userId, data);
                break;

            case 'testReviewRequest':
                result = await sendReviewFlexMessage(userId, data);
                break;

            case 'testAppointmentReminder':
                result = await sendAppointmentReminderFlexMessage(userId, data);
                break;

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action type' },
                    { status: 400 }
                );
        }

        // Handle the result from the Flex message functions
        if (result && result.success !== undefined) {
            return NextResponse.json(result);
        } else {
            // If no explicit result, assume success
            return NextResponse.json({
                success: true,
                message: `ส่ง ${action} สำเร็จแล้ว`
            });
        }

    } catch (error) {
        console.error('Error in test-flex API:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message || 'เกิดข้อผิดพลาดในการส่งข้อความ' 
            },
            { status: 500 }
        );
    }
}

