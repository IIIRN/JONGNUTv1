'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { sendLineMessage, sendBookingNotification } from '@/app/actions/lineActions';
import { sendTelegramMessageToAdmin } from '@/app/actions/telegramActions';

/**
 * Creates a new appointment, checking for slot availability.
 * @param {object} appointmentData - The complete data for the new appointment.
 * @returns {Promise<object>} - The result of the appointment creation process.
 */
export async function createAppointmentWithSlotCheck(appointmentData) {
    const { date, time, serviceId, beauticianId, userId } = appointmentData;
    if (!date || !time) return { success: false, error: 'กรุณาระบุวันและเวลา' };
    try {
        const settingsRef = db.collection('settings').doc('booking');
        const settingsSnap = await settingsRef.get();
        let maxSlot = 1;
        let useBeautician = false;
        let weeklySchedule = {};
        
        if (settingsSnap.exists) {
            const data = settingsSnap.data();
            useBeautician = !!data.useBeautician;
            weeklySchedule = data.weeklySchedule || {};
            
            const appointmentDate = new Date(date);
            const dayOfWeek = appointmentDate.getDay();
            const daySchedule = weeklySchedule[dayOfWeek];
            
            if (daySchedule && !daySchedule.isOpen) {
                return { success: false, error: 'วันที่เลือกปิดทำการ กรุณาเลือกวันอื่น' };
            }
            
            if (daySchedule && daySchedule.isOpen) {
                const timeSlot = time.replace(':', '');
                const openTime = daySchedule.openTime.replace(':', '');
                const closeTime = daySchedule.closeTime.replace(':', '');
                
                if (timeSlot < openTime || timeSlot > closeTime) {
                    return { success: false, error: `เวลาที่เลือกอยู่นอกเวลาทำการ (${daySchedule.openTime} - ${daySchedule.closeTime})` };
                }
            }
            
            if (Array.isArray(data.timeQueues)) {
                const q = data.timeQueues.find(q => q.time === time);
                if (q && q.count) maxSlot = q.count;
            } else if (data.totalBeauticians) {
                maxSlot = Number(data.totalBeauticians);
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
                ? 'ช่างท่านนี้ไม่ว่างในช่วงเวลาดังกล่าว กรุณาเลือกช่างอื่นหรือเวลาอื่น'
                : 'ช่วงเวลานี้ถูกจองเต็มแล้ว กรุณาเลือกเวลาอื่น';
            return { success: false, error: errorMsg };
        }

        const newRef = db.collection('appointments').doc();
        await newRef.set({
            ...appointmentData,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        if (userId) {
            const customerMessage = `การนัดหมายบริการ ${appointmentData.serviceInfo.name} ของคุณในวันที่ ${date} เวลา ${time} ได้รับการบันทึกแล้วค่ะ ขณะนี้กำลังรอการยืนยันจากทางร้านนะคะ`;
            await sendLineMessage(userId, customerMessage);
        }

        try {
            const notificationData = {
                customerName: appointmentData.customerInfo?.name || 'ลูกค้า',
                serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: date,
                appointmentTime: time,
                totalPrice: appointmentData.paymentInfo?.totalPrice ?? 0
            };
            await sendBookingNotification(notificationData, 'newBooking');
        } catch (notificationError) {
            console.error('Error sending booking notification to admin:', notificationError);
        }

        return { success: true, id: newRef.id };
    } catch (error) {
        console.error('Error creating appointment with slot check:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Marks an appointment as completed by an admin.
 */
export async function completeAppointmentByAdmin(appointmentId, adminId, completionData) {
    if (!appointmentId || !adminId || !completionData) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");
        const appointmentData = appointmentDoc.data();

        if (appointmentData.status !== 'confirmed') {
            throw new Error("สถานะการนัดหมายไม่ถูกต้อง ไม่สามารถดำเนินการได้");
        }
        
        await appointmentRef.update({
            status: 'completed',
            'completionInfo.employeeId': adminId,
            'completionInfo.timestamp': FieldValue.serverTimestamp(),
            'completionInfo.notes': completionData.notes || '',
            updatedAt: FieldValue.serverTimestamp()
        });
        
        let notificationMessage = `บริการ ${appointmentData.serviceInfo.name} ของคุณเสร็จสมบูรณ์แล้ว\nขอบคุณที่ใช้บริการค่ะ`;
        await sendLineMessage(appointmentData.userId, notificationMessage);
        await sendReviewRequestToCustomer(appointmentId);

        return { success: true };
    } catch (error) {
        console.error("Error completing appointment by admin:", error);
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

        if (appointmentData.status !== 'awaiting_confirmation') {
            throw new Error("สถานะการนัดหมายไม่ถูกต้อง ไม่สามารถดำเนินการได้");
        }
        
        await appointmentRef.update({
            status: 'confirmed',
            'appointmentInfo.employeeId': adminId, 
            'appointmentInfo.timestamp': FieldValue.serverTimestamp(),
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            'paymentInfo.amountPaid': data.amount,
            'paymentInfo.paymentMethod': data.method,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const customerMessage = `การนัดหมายบริการ ${appointmentData.serviceInfo.name} ของคุณได้รับการยืนยันแล้วค่ะ`;
        await sendLineMessage(appointmentData.userId, customerMessage);

        try {
            const notificationData = {
                customerName: appointmentData.customerInfo?.name || 'ลูกค้า',
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

        if (appointmentData.userId) {
            const customerMessage = `ขออภัยค่ะ การนัดหมายของคุณ (ID: ${appointmentId.substring(0, 6).toUpperCase()}) ถูกยกเลิกเนื่องจาก: "${reason}"\n\nกรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม`;
            await sendLineMessage(appointmentData.userId, customerMessage);
        }
        return { success: true };
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        return { success: false, error: error.message };
    }
}

/**
 * (ฟังก์ชันใหม่) Updates an appointment's status by an admin and notifies the customer.
 */
export async function updateAppointmentStatusByAdmin(appointmentId, newStatus) {
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

        // Send notification to customer
        if (appointmentData.userId) {
            let customerMessage = '';
            const serviceName = appointmentData.serviceInfo?.name || 'บริการของคุณ';
            const appointmentDate = appointmentData.date;
            const appointmentTime = appointmentData.time;

            switch (newStatus) {
                case 'confirmed':
                    customerMessage = `✅ การนัดหมายบริการ "${serviceName}" ในวันที่ ${appointmentDate} เวลา ${appointmentTime} ของคุณได้รับการยืนยันแล้วค่ะ`;
                    break;
                case 'completed':
                    customerMessage = `✨ บริการ "${serviceName}" ของคุณเสร็จสมบูรณ์แล้ว ขอบคุณที่ใช้บริการค่ะ`;
                    // Also send a review request when completed
                    await sendReviewRequestToCustomer(appointmentId);
                    break;
                case 'cancelled':
                    customerMessage = `❌ ขออภัยค่ะ การนัดหมายบริการ "${serviceName}" ของคุณถูกยกเลิกโดยผู้ดูแลระบบ กรุณาติดต่อสอบถามข้อมูลเพิ่มเติม`;
                    break;
            }

            if (customerMessage) {
                await sendLineMessage(appointmentData.userId, customerMessage);
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

        const reviewLiffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${appointmentId}`;
        const reviewMessage = `รบกวนสละเวลารีวิวบริการของคุณ เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น\n${reviewLiffUrl}`;
        await sendLineMessage(appointmentData.userId, reviewMessage);

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
        
        if (newStatus === 'completed') {
            await employeeRef.update({ status: 'available' });
        }

        if (appointmentData.userId) {
            let customerMessage = '';
            if (newStatus === 'completed') {
                const thankYouMessage = `บริการของคุณเสร็จสิ้นแล้ว ขอบคุณที่ใช้บริการค่ะ`;
                await sendLineMessage(appointmentData.userId, thankYouMessage);
                await sendReviewRequestToCustomer(appointmentId);
            }
            if (customerMessage) {
                await sendLineMessage(appointmentData.userId, customerMessage);
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
        const { customerName, serviceName } = await db.runTransaction(async (transaction) => {
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
            return { customerName: appointmentData.customerInfo.name, serviceName: appointmentData.serviceInfo.name };
        });
        
        const customerMessage = `การนัดหมายของคุณ (ID: ${appointmentId.substring(0, 6).toUpperCase()}) ได้ถูกยกเลิกเรียบร้อยแล้วค่ะ`;
        await sendLineMessage(userId, customerMessage);
        
        const adminMessage = `🚫 การนัดหมายถูกยกเลิกโดยลูกค้า\n\n*ลูกค้า:* ${customerName}\n*บริการ:* ${serviceName}\n*Appointment ID:* ${appointmentId.substring(0, 6).toUpperCase()}`;
        await sendTelegramMessageToAdmin(adminMessage);
        
        return { success: true };
    } catch (error) {
        console.error("Error cancelling appointment by user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Sends an invoice link to the customer via LINE using a dedicated payment LIFF.
 */
export async function sendInvoiceToCustomer(appointmentId) {
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");
        const appointmentData = appointmentDoc.data();

        const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID}/${appointmentId}`;

        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'invoiced',
            updatedAt: FieldValue.serverTimestamp()
        });

        const customerMessage = `เรียนคุณ ${appointmentData.customerInfo.name},\n\nนี่คือใบแจ้งค่าบริการสำหรับบริการของคุณ\nยอดชำระ: ${appointmentData.paymentInfo.totalPrice.toLocaleString()} บาท\n\nกรุณาคลิกที่ลิงก์เพื่อชำระเงิน:\n${liffUrl}`;
        await sendLineMessage(appointmentData.userId, customerMessage);

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


// Appended to src/app/actions/appointmentActions.js
// src/app/actions/appointmentActions.js

/**
 * Finds appointments based on a customer's phone number.
 * This version removes the date filter to find all upcoming appointments.
 */
export async function findAppointmentsByPhone(phoneNumber) {
    if (!phoneNumber) {
        return { success: false, error: "กรุณาระบุเบอร์โทรศัพท์" };
    }
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        const q = db.collection('appointments')
            .where('customerInfo.phone', '==', phoneNumber)
            // No longer filtering by today's date, but ensuring we don't pull very old appointments.
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

        if (docSnap.exists()) {
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