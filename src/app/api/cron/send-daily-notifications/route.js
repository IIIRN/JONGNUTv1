import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebaseAdmin';
import { sendDailyAppointmentNotificationFlexMessage } from '@/app/actions/lineFlexActions';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request) {
    try {
        console.log('Cron job triggered: Starting daily appointment notification process...');

        // Check if daily notifications are enabled
        const settingsRef = db.collection('settings').doc('notifications');
        const settingsDoc = await settingsRef.get();
        
        if (settingsDoc.exists()) {
            const settingsData = settingsDoc.data();
            const notificationsEnabled = settingsData.allNotifications?.enabled && 
                                        settingsData.customerNotifications?.enabled &&
                                        settingsData.customerNotifications?.dailyAppointmentNotification;
            
            if (!notificationsEnabled) {
                console.log('Daily appointment notifications are disabled in settings');
                return NextResponse.json({ 
                    success: true, 
                    message: "การแจ้งเตือนประจำวันถูกปิดใช้งานในการตั้งค่า" 
                });
            }
        }

        // Get today's date in Thailand timezone
        const today = new Date();
        // Convert to Thailand timezone (UTC+7)
        const thailandTime = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
        const todayString = thailandTime.toISOString().split('T')[0]; // YYYY-MM-DD format

        console.log(`System time: ${today.toISOString()}`);
        console.log(`Thailand time: ${thailandTime.toISOString()}`);
        console.log(`Looking for appointments on ${todayString}`);

        // Query appointments for today
        const appointmentsSnapshot = await db.collection('appointments')
            .where('date', '==', todayString)
            .get();

        if (appointmentsSnapshot.empty) {
            console.log("No appointments found for today");
            return NextResponse.json({ 
                success: true, 
                message: "ไม่มีนัดหมายสำหรับวันนี้" 
            });
        }

        // Filter appointments by status: only "awaiting_confirmation" and "confirmed"
        const validStatuses = ['awaiting_confirmation', 'confirmed'];
        const filteredAppointments = [];
        
        appointmentsSnapshot.forEach(doc => {
            const appointmentData = doc.data();
            if (validStatuses.includes(appointmentData.status)) {
                filteredAppointments.push({
                    id: doc.id,
                    data: appointmentData
                });
            }
        });

        console.log(`Found ${appointmentsSnapshot.size} total appointments for today`);
        console.log(`Found ${filteredAppointments.length} appointments with valid status (awaiting_confirmation, confirmed)`);

        if (filteredAppointments.length === 0) {
            console.log("No appointments with valid status found for today");
            return NextResponse.json({ 
                success: true, 
                message: "ไม่มีนัดหมายที่มีสถานะ awaiting_confirmation หรือ confirmed สำหรับวันนี้" 
            });
        }

        const notificationPromises = [];
        let sentCount = 0;
        let skipCount = 0;

        filteredAppointments.forEach(appointment => {
            const appointmentData = appointment.data;
            const appointmentId = appointment.id;

            console.log(`Processing appointment ${appointmentId} with status: ${appointmentData.status}`);

            // Check if customer has LINE ID
            if (appointmentData.userId) {
                const notificationData = {
                    id: appointmentId,
                    ...appointmentData
                };

                notificationPromises.push(
                    sendDailyAppointmentNotificationFlexMessage(appointmentData.userId, notificationData)
                        .then(result => {
                            if (result.success) {
                                console.log(`Daily notification sent successfully to ${appointmentData.userId} for appointment ${appointmentId}`);
                                sentCount++;
                                return { appointmentId, success: true };
                            } else {
                                console.error(`Failed to send daily notification to ${appointmentData.userId}:`, result.error);
                                return { appointmentId, success: false, error: result.error };
                            }
                        })
                        .catch(error => {
                            console.error(`Error sending daily notification for appointment ${appointmentId}:`, error);
                            return { appointmentId, success: false, error: error.message };
                        })
                );
            } else {
                console.log(`Appointment ${appointmentId} has no LINE ID, skipping notification`);
                skipCount++;
            }
        });

        // Wait for all notifications to be sent
        const results = await Promise.all(notificationPromises);
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        console.log(`Daily notification process completed:`);
        console.log(`- Total appointments today: ${appointmentsSnapshot.size}`);
        console.log(`- Valid status appointments: ${filteredAppointments.length}`);
        console.log(`- Notifications sent: ${successCount}`);
        console.log(`- Notifications failed: ${failureCount}`);
        console.log(`- Appointments without LINE ID: ${skipCount}`);

        return NextResponse.json({ 
            success: true, 
            message: `ส่งแจ้งเตือนประจำวันสำเร็จ ${successCount}/${filteredAppointments.length} คน (จากการจองที่มีสถานะรอยืนยัน/ยืนยันแล้ว)`,
            data: {
                totalAppointments: appointmentsSnapshot.size,
                validStatusAppointments: filteredAppointments.length,
                sentCount: successCount,
                failureCount,
                skipCount,
                date: todayString
            }
        });

    } catch (error) {
        console.error("Daily notification cron job error:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}