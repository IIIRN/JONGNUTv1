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


        // ตรวจสอบเงื่อนไขเปิด/ปิดแจ้งเตือนจาก settings/notifications
        const { db } = await import('@/app/lib/firebaseAdmin');
        const settingsRef = db.collection('settings').doc('notifications');
        const settingsDoc = await settingsRef.get();
        let notificationsEnabled = true;
        if (settingsDoc.exists) {
            const settingsData = settingsDoc.data();
            notificationsEnabled = settingsData.allNotifications?.enabled && settingsData.customerNotifications?.enabled;
        }
        if (!notificationsEnabled) {
            return NextResponse.json({ success: false, error: 'การแจ้งเตือนถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
        }

        let result;
        const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
        switch (action) {
            case 'testNewBooking':
                if (!settingsData.customerNotifications?.newBooking) {
                    return NextResponse.json({ success: false, error: 'การแจ้งเตือนการจองใหม่ถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
                }
                result = await sendNewBookingFlexMessage(userId, data);
                break;
            case 'testAppointmentConfirmed':
                if (!settingsData.customerNotifications?.appointmentConfirmed) {
                    return NextResponse.json({ success: false, error: 'การแจ้งเตือนยืนยันนัดถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
                }
                result = await sendAppointmentConfirmedFlexMessage(userId, data);
                break;
            case 'testPaymentRequest':
                if (!settingsData.customerNotifications?.paymentInvoice) {
                    return NextResponse.json({ success: false, error: 'การแจ้งเตือนชำระเงินถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
                }
                result = await sendPaymentFlexMessage(userId, data);
                break;
            case 'testServiceCompleted':
                if (!settingsData.customerNotifications?.serviceCompleted) {
                    return NextResponse.json({ success: false, error: 'การแจ้งเตือนงานเสร็จถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
                }
                result = await sendServiceCompletedFlexMessage(userId, data);
                break;
            case 'testReviewRequest':
                if (!settingsData.customerNotifications?.reviewRequest) {
                    return NextResponse.json({ success: false, error: 'การแจ้งเตือนขอรีวิวถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
                }
                result = await sendReviewFlexMessage(userId, data);
                break;
            case 'testAppointmentReminder':
                if (!settingsData.customerNotifications?.appointmentReminder) {
                    return NextResponse.json({ success: false, error: 'การแจ้งเตือนเตือนนัดถูกปิดใช้งานในการตั้งค่า' }, { status: 403 });
                }
                result = await sendAppointmentReminderFlexMessage(userId, data);
                break;
            case 'testAdminNotification':
                if (!data?.adminUserId) {
                    return NextResponse.json({ success: false, error: 'Admin LINE User ID is required' }, { status: 400 });
                }
                // ตัวอย่าง: ส่ง Flex Message แบบเดียวกับลูกค้าไปยังแอดมิน
                result = await sendNewBookingFlexMessage(data.adminUserId, data);
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
