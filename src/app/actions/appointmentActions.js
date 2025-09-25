'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { sendBookingNotification } from '@/app/actions/lineActions';
import {
    sendPaymentFlexMessage,
    sendReviewFlexMessage,
    sendAppointmentConfirmedFlexMessage,
    sendServiceCompletedFlexMessage,
    sendAppointmentCancelledFlexMessage,
    sendNewBookingFlexMessage,
    sendPaymentConfirmationFlexMessage
} from '@/app/actions/lineFlexActions';
import { sendTelegramMessageToAdmin } from '@/app/actions/telegramActions';
import { awardPointsForPurchase, awardPointsForVisit } from '@/app/actions/pointActions';
import { findOrCreateCustomer } from '@/app/actions/customerActions';
import { createOrUpdateCalendarEvent, deleteCalendarEvent } from './calendarActions';
import * as settingsActions from '@/app/actions/settingsActions'; // Use the central settings function


/**
 * Creates a new appointment, checking for slot availability.
 */
export async function createAppointmentWithSlotCheck(appointmentData) {
    const { date, time, serviceId, beauticianId, userId } = appointmentData;
    if (!date || !time) return { success: false, error: 'กรุณาระบุวันและเวลา' };
    try {
        const settingsRef = db.collection('settings').doc('booking');
        const settingsSnap = await settingsRef.get();
        
        let maxSlot = 1;
        let useBeautician = false;
        
        if (settingsSnap.exists) {
            const data = settingsSnap.data();
            useBeautician = !!data.useBeautician;
            if (data.totalBeauticians) {
                maxSlot = Number(data.totalBeauticians);
            }
            if (Array.isArray(data.timeQueues) && data.timeQueues.length > 0) {
                const specificQueue = data.timeQueues.find(q => q.time === time);
                if (specificQueue && typeof specificQueue.count === 'number') {
                    maxSlot = specificQueue.count;
                }
            }
        }

        let queryConditions = [
            ['date', '==', date],
            ['time', '==', time],
            ['status', 'in', ['pending', 'confirmed', 'awaiting_confirmation']]
        ];
        
        if (useBeautician && beauticianId && beauticianId !== 'auto-assign') {
            queryConditions.push(['beauticianId', '==', beauticianId]);
            maxSlot = 1; 
        }
        
        let q = db.collection('appointments');
        queryConditions.forEach(condition => {
            q = q.where(...condition);
        });
        
        const snap = await q.get();
        if (snap.size >= maxSlot) {
            const errorMsg = useBeautician && beauticianId !== 'auto-assign' 
                ? 'ช่างท่านนี้ไม่ว่างในช่วงเวลาดังกล่าว'
                : 'ช่วงเวลานี้ถูกจองเต็มแล้ว';
            return { success: false, error: errorMsg };
        }

        const serviceRef = db.collection('services').doc(serviceId);
        const serviceSnap = await serviceRef.get();
        if (!serviceSnap.exists) {
            return { success: false, error: 'ไม่พบบริการที่เลือก' };
        }
        const authoritativeServiceData = serviceSnap.data();

        const finalAppointmentData = {
            ...appointmentData,
            serviceInfo: {
                id: serviceId,
                name: authoritativeServiceData.serviceName,
                price: authoritativeServiceData.price,
                duration: authoritativeServiceData.duration,
                imageUrl: authoritativeServiceData.imageUrl || '',
                addOns: appointmentData.serviceInfo?.addOns || []
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const newRef = db.collection('appointments').doc();
        await newRef.set(finalAppointmentData);

        await createOrUpdateCalendarEvent(newRef.id, finalAppointmentData);

        if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
            try {
                await findOrCreateCustomer(appointmentData.customerInfo, appointmentData.userId);
            } catch (customerError) {
                console.error(`Error creating customer for appointment ${newRef.id}:`, customerError);
            }
        }

        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && userId && notificationSettings.customerNotifications?.newBooking) {
            await sendNewBookingFlexMessage(userId, {
                serviceName: finalAppointmentData.serviceInfo.name,
                date: date,
                time: time,
                appointmentId: newRef.id,
                id: newRef.id
            });
        }

        try {
            const notificationData = {
                customerName: finalAppointmentData.customerInfo?.fullName || 'ลูกค้า',
                serviceName: finalAppointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: date,
                appointmentTime: time,
                totalPrice: finalAppointmentData.paymentInfo?.totalPrice ?? 0
            };
            await sendBookingNotification(notificationData, 'newBooking');
        } catch (notificationError) {
            console.error('Error sending admin notification:', notificationError);
        }

        return { success: true, id: newRef.id };
    } catch (error) {
        console.error('Error creating appointment:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates an existing appointment by an admin.
 */
export async function updateAppointmentByAdmin(appointmentId, updateData) {
    if (!appointmentId || typeof appointmentId !== 'string' || appointmentId.trim() === '' || !updateData) {
        return { success: false, error: 'Appointment ID (string) and update data are required.' };
    }

    const { date, time, beauticianId, serviceId, addOnNames, customerInfo } = updateData;
    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const q = db.collection('appointments')
            .where('date', '==', date)
            .where('time', '==', time)
            .where('beauticianId', '==', beauticianId)
            .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'in_progress']);
        
        const snapshot = await q.get();
        const conflictingAppointments = snapshot.docs.filter(doc => doc.id !== appointmentId);

        if (conflictingAppointments.length > 0) {
            return { success: false, error: 'ช่างเสริมสวยไม่ว่างในวันและเวลาที่เลือกใหม่' };
        }

        const serviceDoc = await db.collection('services').doc(serviceId).get();
        if (!serviceDoc.exists) throw new Error("Service not found.");
        const serviceData = serviceDoc.data();

        const selectedAddOns = (serviceData.addOnServices || []).filter(a => addOnNames.includes(a.name));
        const basePrice = serviceData.price || 0;
        const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + (a.price || 0), 0);
        const totalPrice = basePrice + addOnsTotal;
        const totalDuration = (serviceData.duration || 0) + selectedAddOns.reduce((sum, a) => sum + (a.duration || 0), 0);

        const beauticianDoc = await db.collection('beauticians').doc(beauticianId).get();
        const beauticianData = beauticianDoc.exists ? beauticianDoc.data() : { firstName: 'N/A', lastName: '' };
        
        const finalUpdateData = {
            customerInfo,
            serviceId,
            beauticianId,
            date,
            time,
            'serviceInfo.id': serviceId,
            'serviceInfo.name': serviceData.serviceName,
            'serviceInfo.imageUrl': serviceData.imageUrl || '',
            'appointmentInfo.beauticianId': beauticianId,
            'appointmentInfo.employeeId': beauticianId,
            'appointmentInfo.beauticianInfo': { firstName: beauticianData.firstName, lastName: beauticianData.lastName },
            'appointmentInfo.dateTime': Timestamp.fromDate(new Date(`${date}T${time}:00+07:00`)), // Fixed Timezone
            'appointmentInfo.addOns': selectedAddOns,
            'appointmentInfo.duration': totalDuration,
            'paymentInfo.basePrice': basePrice,
            'paymentInfo.addOnsTotal': addOnsTotal,
            'paymentInfo.originalPrice': totalPrice,
            'paymentInfo.totalPrice': totalPrice,
            'paymentInfo.discount': 0,
            'paymentInfo.couponId': null,
            'paymentInfo.couponName': null,
            updatedAt: FieldValue.serverTimestamp()
        };
        
        await appointmentRef.update(finalUpdateData);

        const updatedDoc = await appointmentRef.get();
        if (updatedDoc.exists) {
            await createOrUpdateCalendarEvent(appointmentId, updatedDoc.data());
        }

        return { success: true };

    } catch (error) {
        console.error("Error updating appointment by admin:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Confirms an appointment and its payment by an admin.
 */
export async function confirmAppointmentAndPaymentByAdmin(appointmentId, adminId, data) {
    if (!appointmentId || !adminId || !data) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");
        const appointmentData = appointmentDoc.data();
        
        const wasAwaitingConfirmation = appointmentData.status === 'awaiting_confirmation';

        await appointmentRef.update({
            status: wasAwaitingConfirmation ? 'confirmed' : appointmentData.status,
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            'paymentInfo.amountPaid': data.amount,
            'paymentInfo.paymentMethod': data.method,
            updatedAt: FieldValue.serverTimestamp(),
        });

        if (wasAwaitingConfirmation) {
            const updatedDoc = await appointmentRef.get();
            if(updatedDoc.exists){
                await createOrUpdateCalendarEvent(appointmentId, updatedDoc.data());
            }
        }
        
        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && appointmentData.userId && notificationSettings.customerNotifications?.appointmentConfirmed) {
          await sendPaymentConfirmationFlexMessage(appointmentData.userId, {
              id: appointmentId, 
              serviceInfo: appointmentData.serviceInfo, 
              customerInfo: appointmentData.customerInfo,
              paymentInfo: { amountPaid: data.amount, paymentMethod: data.method },
              date: appointmentData.date, 
              time: appointmentData.time, 
              appointmentId: appointmentId, 
              isConfirmed: wasAwaitingConfirmation
          });
        }

        try {
            const notificationData = {
                customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
                serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: appointmentData.date,
                appointmentTime: appointmentData.time,
                totalPrice: data.amount
            };
            await sendBookingNotification(notificationData, 'paymentReceived');
        } catch (notificationError) {
            console.error('Error sending payment notification:', notificationError);
        }
        return { success: true };
    } catch (error) {
        console.error("Error confirming appointment and payment:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancels an appointment by an admin and notifies the customer.
 */
export async function cancelAppointmentByAdmin(appointmentId, reason) {
    if (!appointmentId || !reason) {
        return { success: false, error: 'จำเป็นต้องมี Appointment ID และเหตุผล' };
    }
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย!");
        
        const appointmentData = appointmentDoc.data();
        
        await appointmentRef.update({
            status: 'cancelled',
            cancellationInfo: { cancelledBy: 'admin', reason, timestamp: FieldValue.serverTimestamp() },
            updatedAt: FieldValue.serverTimestamp()
        });
        
        if (appointmentData.googleCalendarEventId) {
            await deleteCalendarEvent(appointmentData.googleCalendarEventId);
        }

        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && appointmentData.userId && notificationSettings.customerNotifications?.appointmentCancelled) {
            await sendAppointmentCancelledFlexMessage(appointmentData.userId, {
                appointmentId: appointmentId,
                shortId: appointmentId.substring(0, 6).toUpperCase(),
                serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                date: appointmentData.date,
                time: appointmentData.time,
                reason: reason,
                cancelledBy: 'admin'
            });
        }
        return { success: true };
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates an appointment's status by an admin and notifies the customer.
 */
export async function updateAppointmentStatusByAdmin(appointmentId, newStatus, note) {
    if (!appointmentId || !newStatus) {
        return { success: false, error: 'Appointment ID and new status are required.' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            throw new Error("Appointment not found.");
        }
        const appointmentData = appointmentDoc.data();

        await appointmentRef.update({
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp()
        });

        if (newStatus === 'cancelled') {
            if (appointmentData.googleCalendarEventId) {
                await deleteCalendarEvent(appointmentData.googleCalendarEventId);
            }
        } else {
            const updatedDoc = await appointmentRef.get();
            if (updatedDoc.exists) {
                 await createOrUpdateCalendarEvent(appointmentId, updatedDoc.data());
            }
        }

        if (newStatus === 'completed') {
            const pointSettingsSnap = await db.collection('settings').doc('points').get();
            const pointSettings = pointSettingsSnap.exists ? pointSettingsSnap.data() : {};
            let totalPointsAwarded = 0;

            if (pointSettings.enablePurchasePoints && appointmentData.userId) {
                const totalPrice = appointmentData.paymentInfo?.totalPrice || appointmentData.paymentInfo?.amountPaid || 0;
                if (totalPrice > 0) {
                    const purchasePointsResult = await awardPointsForPurchase(appointmentData.userId, totalPrice);
                    if (purchasePointsResult.success) {
                        totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
                    }
                }
            }

            if (pointSettings.enableVisitPoints && appointmentData.userId && !appointmentData.visitPointsAwarded) {
                const visitPointsResult = await awardPointsForVisit(appointmentData.userId);
                if (visitPointsResult.success) {
                    totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
                    await appointmentRef.update({ visitPointsAwarded: true });
                }
            }
            appointmentData._totalPointsAwarded = totalPointsAwarded;
        }

        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && appointmentData.userId) {
            const serviceName = appointmentData.serviceInfo?.name || 'บริการของคุณ';
            const appointmentDate = appointmentData.date;
            const appointmentTime = appointmentData.time;

            switch (newStatus) {
                case 'confirmed':
                    if (notificationSettings.customerNotifications?.appointmentConfirmed) {
                        await sendAppointmentConfirmedFlexMessage(appointmentData.userId, {
                           serviceName, date: appointmentDate, time: appointmentTime,
                           appointmentId, id: appointmentId
                        });
                    }
                    break;
                case 'completed':
                    if (notificationSettings.customerNotifications?.serviceCompleted) {
                        await sendServiceCompletedFlexMessage(appointmentData.userId, {
                            serviceName, date: appointmentDate, time: appointmentTime,
                            appointmentId, id: appointmentId,
                            totalPointsAwarded: appointmentData._totalPointsAwarded || 0
                        });
                    }
                    if (notificationSettings.customerNotifications?.reviewRequest) {
                        await sendReviewRequestToCustomer(appointmentId);
                    }
                    break;
                case 'cancelled':
                    if (notificationSettings.customerNotifications?.appointmentCancelled) {
                        await sendAppointmentCancelledFlexMessage(appointmentData.userId, {
                           appointmentId,
                           shortId: appointmentId.substring(0, 6).toUpperCase(),
                           serviceName, date: appointmentDate, time: appointmentTime,
                           reason: note || 'ไม่ได้ระบุเหตุผล', cancelledBy: 'admin'
                        });
                    }
                    break;
            }
        }

        return { success: true };

    } catch (error) {
        console.error("Error updating appointment status by admin:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Sends a review request link to the customer after a service is completed.
 */
export async function sendReviewRequestToCustomer(appointmentId) {
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");

        const appointmentData = appointmentDoc.data();
        if (appointmentData.status !== 'completed') throw new Error("ไม่สามารถส่งรีวิวสำหรับงานที่ยังไม่เสร็จสิ้น");
        if (appointmentData.reviewInfo?.submitted) throw new Error("การนัดหมายนี้ได้รับการรีวิวแล้ว");
        if (!appointmentData.userId) throw new Error("ไม่พบ LINE User ID ของลูกค้า");
        
        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && notificationSettings.customerNotifications?.reviewRequest) {
            await sendReviewFlexMessage(appointmentData.userId, {
                id: appointmentId,
                ...appointmentData
            });
        }

        return { success: true };
    } catch (error) {
        console.error(`[Review Request] Error for appointment ID ${appointmentId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates an appointment's status by an employee.
 */
export async function updateAppointmentStatusByEmployee(appointmentId, employeeId, newStatus, note) {
    if (!appointmentId || !employeeId || !newStatus) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const employeeRef = db.collection('employees').doc(employeeId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลนัดหมาย!");
        const appointmentData = appointmentDoc.data();

        const updateData = {
            status: newStatus,
            statusHistory: FieldValue.arrayUnion({ status: newStatus, note: note || "", timestamp: Timestamp.now() }),
            updatedAt: FieldValue.serverTimestamp()
        };

        await appointmentRef.update(updateData);
        
        const updatedDoc = await appointmentRef.get();
        if (updatedDoc.exists) {
            await createOrUpdateCalendarEvent(appointmentId, updatedDoc.data());
        }

        if (newStatus === 'completed') {
            await employeeRef.update({ status: 'available' });
        }

        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && appointmentData.userId) {
            if (newStatus === 'completed' && notificationSettings.customerNotifications?.serviceCompleted) {
                await sendServiceCompletedFlexMessage(appointmentData.userId, {
                    serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                    date: appointmentData.date,
                    time: appointmentData.time,
                    appointmentId: appointmentId,
                    id: appointmentId,
                    pointsAwarded: 0
                });
                if (notificationSettings.customerNotifications?.reviewRequest) {
                    await sendReviewRequestToCustomer(appointmentId);
                }
            }
        }
        return { success: true };
    } catch (error) {
        console.error("Error updating appointment status:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancels an appointment by the customer who owns it.
 */
export async function cancelAppointmentByUser(appointmentId, userId) {
    if (!appointmentId || !userId) {
        return { success: false, error: 'ต้องการ Appointment ID และ User ID' };
    }
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const { customerName, serviceName, googleCalendarEventId, date, time } = await db.runTransaction(async (transaction) => {
            const appointmentDoc = await transaction.get(appointmentRef);
            if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");
            
            const appointmentData = appointmentDoc.data();
            if (appointmentData.userId !== userId) throw new Error("ไม่มีสิทธิ์ยกเลิกการนัดหมายนี้");
            if (['completed', 'cancelled', 'in_progress'].includes(appointmentData.status)) throw new Error("การนัดหมายนี้ไม่สามารถยกเลิกได้แล้ว");

            transaction.update(appointmentRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'customer', reason: 'Cancelled by customer.', timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });
            return { 
                customerName: appointmentData.customerInfo.fullName, 
                serviceName: appointmentData.serviceInfo.name,
                googleCalendarEventId: appointmentData.googleCalendarEventId || null,
                date: appointmentData.date,
                time: appointmentData.time
            };
        });

        if (googleCalendarEventId) {
            await deleteCalendarEvent(googleCalendarEventId);
        }
        
        // For user-initiated actions, we still send them a confirmation.
        // But we check settings before notifying admin.
        await sendAppointmentCancelledFlexMessage(userId, {
            appointmentId: appointmentId,
            shortId: appointmentId.substring(0, 6).toUpperCase(),
            serviceName: serviceName || 'บริการ',
            date: date,
            time: time,
            reason: 'ยกเลิกโดยลูกค้า',
            cancelledBy: 'customer'
        });
        
        const adminMessage = `🚫 การนัดหมายถูกยกเลิกโดยลูกค้า\n\n*ลูกค้า:* ${customerName}\n*บริการ:* ${serviceName}\n*ID:* ${appointmentId.substring(0, 6).toUpperCase()}`;
        await sendTelegramMessageToAdmin(adminMessage);
        
        return { success: true };
    } catch (error) {
        console.error("Error cancelling appointment by user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Sends an invoice link to the customer via LINE.
 */
export async function sendInvoiceToCustomer(appointmentId) {
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");
        const appointmentData = appointmentDoc.data();

        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'invoiced',
            updatedAt: FieldValue.serverTimestamp()
        });

        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if(settingsSuccess && notificationSettings.customerNotifications?.paymentInvoice){
            await sendPaymentFlexMessage(appointmentData.userId, {
                id: appointmentId,
                userId: appointmentData.userId,
                serviceInfo: appointmentData.serviceInfo,
                paymentInfo: appointmentData.paymentInfo,
                customerInfo: appointmentData.customerInfo,
                date: appointmentData.date,
                time: appointmentData.time
            });
        }
 
        return { success: true };
    } catch (error) {
        console.error("Error sending invoice:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Confirms that payment has been received for an appointment.
 */
export async function confirmPayment(appointmentId) {
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error confirming payment:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Finds appointments based on a customer's phone number.
 */
export async function findAppointmentsByPhone(phoneNumber) {
    if (!phoneNumber) {
        return { success: false, error: "กรุณาระบุเบอร์โทรศัพท์" };
    }
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        const q = db.collection('appointments')
            .where('customerInfo.phone', '==', phoneNumber)
            .where('date', '>=', todayStr) 
            .where('status', 'in', ['confirmed', 'awaiting_confirmation'])
            .orderBy('date', 'asc')
            .orderBy('time', 'asc');

        const snapshot = await q.get();
        if (snapshot.empty) {
            return { success: true, appointments: [] };
        }
        const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        return { success: true, appointments: JSON.parse(JSON.stringify(appointments)) };
    } catch (error) {
        console.error("Error finding appointments by phone:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Finds a single appointment by its ID.
 */
export async function findAppointmentById(appointmentId) {
    if (!appointmentId) {
        return { success: false, error: "กรุณาระบุ ID การนัดหมาย" };
    }
    try {
        const docRef = db.collection('appointments').doc(appointmentId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const appointment = { id: docSnap.id, ...docSnap.data() };
            return { success: true, appointment: JSON.parse(JSON.stringify(appointment)) };
        } else {
            return { success: false, error: "ไม่พบข้อมูลการนัดหมาย" };
        }
    } catch (error) {
        console.error("Error finding appointment by ID:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Confirms an appointment by the user who owns it.
 */
export async function confirmAppointmentByUser(appointmentId, userId) {
    if (!appointmentId || !userId) {
        return { success: false, error: 'Appointment ID and User ID are required.' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            throw new Error("Appointment not found.");
        }

        const appointmentData = appointmentDoc.data();

        if (appointmentData.userId !== userId) {
            throw new Error("You do not have permission to confirm this appointment.");
        }

        if (appointmentData.status !== 'awaiting_confirmation') {
            throw new Error("This appointment cannot be confirmed.");
        }

        await appointmentRef.update({
            status: 'confirmed',
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        const updatedDoc = await appointmentRef.get();
        if (updatedDoc.exists) {
            await createOrUpdateCalendarEvent(appointmentId, updatedDoc.data());
        }

        const notificationData = {
            customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
            serviceName: appointmentData.serviceInfo?.name || 'บริการ',
            appointmentDate: appointmentData.date,
            appointmentTime: appointmentData.time,
            totalPrice: appointmentData.paymentInfo?.totalPrice ?? 0
        };
        await sendBookingNotification(notificationData, 'customerConfirmed'); 

        return { success: true };

    } catch (error) {
        console.error("Error confirming appointment by user:", error);
        return { success: false, error: error.message };
    }
}