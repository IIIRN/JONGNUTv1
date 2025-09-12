"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendDailyAppointmentNotificationFlexMessage } from '@/app/actions/lineFlexActions';

/**
 * Sends daily appointment notifications to customers immediately (manual trigger)
 * @param {boolean} mockMode - If true, simulates sending without calling LINE API
 */
export async function sendDailyNotificationsNow(mockMode = false) {
  try {
    // ...existing code...
    if (mockMode) {
    // ...existing code...
    }

    // Get today's date in Thailand timezone
    const today = new Date();
    // Convert to Thailand timezone (UTC+7)
    const thailandTime = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
    const todayString = thailandTime.toISOString().split('T')[0]; // YYYY-MM-DD format

    // ...existing code...

    // Query appointments for today with specific statuses
    const appointmentsSnapshot = await db.collection('appointments')
        .where('date', '==', todayString)
        .get();

    if (appointmentsSnapshot.empty) {
    // ...existing code...
        return { 
            success: true, 
            message: "ไม่มีนัดหมายสำหรับวันนี้",
            data: {
                totalAppointments: 0,
                sentCount: 0,
                failureCount: 0,
                skipCount: 0,
                date: todayString
            }
        };
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

    // ...existing code...

    if (filteredAppointments.length === 0) {
    // ...existing code...
        return { 
            success: true, 
            message: "ไม่มีนัดหมายที่มีสถานะ awaiting_confirmation หรือ confirmed สำหรับวันนี้",
            data: {
                totalAppointments: appointmentsSnapshot.size,
                validStatusAppointments: 0,
                sentCount: 0,
                failureCount: 0,
                skipCount: 0,
                date: todayString
            }
        };
    }

    const notificationPromises = [];
    let sentCount = 0;
    let skipCount = 0;

    filteredAppointments.forEach(appointment => {
        const appointmentData = appointment.data;
        const appointmentId = appointment.id;

    // ...existing code...

        // Check if customer has LINE ID
        if (appointmentData.userId) {
            const notificationData = {
                id: appointmentId,
                ...appointmentData
            };

            if (mockMode) {
                // Mock mode: simulate success without calling LINE API
                notificationPromises.push(
                    Promise.resolve({
                        appointmentId,
                        success: true,
                        mockMode: true
                    })
                );
                // ...existing code...
            } else {
                // Real mode: call LINE API
                notificationPromises.push(
                    sendDailyAppointmentNotificationFlexMessage(appointmentData.userId, notificationData)
                        .then(result => {
                            if (result.success) {
                                // ...existing code...
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
            }
        } else {
            // ...existing code...
            skipCount++;
        }
    });

    // Wait for all notifications to be sent
    const results = await Promise.all(notificationPromises);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // ...existing code...

    const statusText = mockMode ? 'ทดสอบส่งแจ้งเตือน' : 'ส่งแจ้งเตือน';
    const message = `${statusText}สำเร็จ ${successCount}/${filteredAppointments.length} คน (จากการจองที่มีสถานะรอยืนยัน/ยืนยันแล้ว)`;

    return { 
        success: true, 
        message,
        data: {
            totalAppointments: appointmentsSnapshot.size,
            validStatusAppointments: filteredAppointments.length,
            sentCount: successCount,
            failureCount,
            skipCount,
            date: todayString
        }
    };

  } catch (error) {
    console.error("Manual daily notification error:", error);
    return { 
        success: false, 
        error: error.message 
    };
  }
}
