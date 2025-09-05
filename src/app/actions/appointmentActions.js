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
import { awardPointsForPurchase, awardPointsForVisit, awardPointsByPhone } from '@/app/actions/pointActions';
import { findOrCreateCustomer } from '@/app/actions/customerActions';

/**
 * Creates a new appointment, checking for slot availability.
 */
export async function createAppointmentWithSlotCheck(appointmentData) {
    const { date, time, serviceId, beauticianId, userId } = appointmentData;
    if (!date || !time) return { success: false, error: 'กรุณาระบุวันและเวลา' };
    // Ensure userId is present before creating an appointment, as it's crucial for sending notifications.
    if (!userId) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้ (userId) กรุณาเข้าสู่ระบบใหม่อีกครั้ง' };
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

        // Create or update customer record when appointment is created
        if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
            try {
                const customerResult = await findOrCreateCustomer(
                    appointmentData.customerInfo, 
                    appointmentData.userId
                );
                if (customerResult.success) {
                    console.log(`Customer record created/updated for appointment ${newRef.id}: ${customerResult.customerId}`);
                    if (customerResult.mergedPoints > 0) {
                        console.log(`Merged ${customerResult.mergedPoints} points for customer ${customerResult.customerId}`);
                    }
                } else {
                    console.error(`Failed to create customer record for appointment ${newRef.id}:`, customerResult.error);
                }
            } catch (customerError) {
                console.error(`Error creating customer record for appointment ${newRef.id}:`, customerError);
            }
        }
        
        // Send new booking Flex Message to the customer.
        if (userId) {
            await sendNewBookingFlexMessage(userId, {
                ...appointmentData, // Pass full data to ensure template has all info
                appointmentId: newRef.id
            });
        }

        try {
            const notificationData = {
                customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
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
 * Updates an existing appointment by an admin.
 */
export async function updateAppointmentByAdmin(appointmentId, updateData) {
    if (!appointmentId || !updateData) {
        return { success: false, error: 'Appointment ID and update data are required.' };
    }

    const { date, time, beauticianId, serviceId, addOnNames, customerInfo } = updateData;
    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        // Re-check for slot availability, excluding the current appointment
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
            'appointmentInfo.dateTime': Timestamp.fromDate(new Date(`${date}T${time}`)),
            'appointmentInfo.addOns': selectedAddOns,
            'appointmentInfo.duration': totalDuration,
            'paymentInfo.basePrice': basePrice,
            'paymentInfo.addOnsTotal': addOnsTotal,
            'paymentInfo.originalPrice': totalPrice,
            'paymentInfo.totalPrice': totalPrice, // Assuming discount is reset on edit
            'paymentInfo.discount': 0,
            'paymentInfo.couponId': null,
            'paymentInfo.couponName': null,
            updatedAt: FieldValue.serverTimestamp()
        };
        
        await appointmentRef.update(finalUpdateData);

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

        // Allow payment for all statuses except cancelled
        if (appointmentData.status === 'cancelled') {
            throw new Error("ไม่สามารถชำระเงินสำหรับการนัดหมายที่ยกเลิกแล้ว");
        }
        
        const wasAwaitingConfirmation = appointmentData.status === 'awaiting_confirmation';
        const currentStatus = appointmentData.status;

        await appointmentRef.update({
            // Keep current status unless it's awaiting_confirmation
            status: wasAwaitingConfirmation ? 'confirmed' : currentStatus,
            'appointmentInfo.employeeId': adminId, 
            'appointmentInfo.timestamp': FieldValue.serverTimestamp(),
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            'paymentInfo.amountPaid': data.amount,
            'paymentInfo.paymentMethod': data.method,
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Create or update customer record when payment is confirmed
        if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
            try {
                const customerResult = await findOrCreateCustomer(
                    appointmentData.customerInfo, 
                    appointmentData.userId
                );
                if (customerResult.success) {
                    console.log(`Customer record created/updated for payment confirmation ${appointmentId}: ${customerResult.customerId}`);
                    if (customerResult.mergedPoints > 0) {
                        console.log(`Merged ${customerResult.mergedPoints} points for customer ${customerResult.customerId}`);
                    }
                } else {
                    console.error(`Failed to create customer record for payment confirmation ${appointmentId}:`, customerResult.error);
                }
            } catch (customerError) {
                console.error(`Error creating customer record for payment confirmation ${appointmentId}:`, customerError);
            }
        }

        if (appointmentData.userId) {
            const flexData = { ...appointmentData, id: appointmentId, paymentInfo: { ...appointmentData.paymentInfo, amountPaid: data.amount } };
            await sendPaymentConfirmationFlexMessage(appointmentData.userId, flexData);
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

        if (appointmentData.userId) {
            await sendAppointmentCancelledFlexMessage(appointmentData.userId, { ...appointmentData, id: appointmentId }, reason);
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

        // Create or update customer record when status changes
        if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
            try {
                const customerResult = await findOrCreateCustomer(
                    appointmentData.customerInfo, 
                    appointmentData.userId
                );
                if (customerResult.success) {
                    console.log(`Customer record created/updated for status change ${appointmentId}: ${customerResult.customerId}`);
                    if (customerResult.mergedPoints > 0) {
                        console.log(`Merged ${customerResult.mergedPoints} points for customer ${customerResult.customerId}`);
                    }
                } else {
                    console.error(`Failed to create customer record for status change ${appointmentId}:`, customerResult.error);
                }
            } catch (customerError) {
                console.error(`Error creating customer record for status change ${appointmentId}:`, customerError);
            }
        }

        // Award points when status changes to completed
        if (newStatus === 'completed') {
            const totalPrice = appointmentData.paymentInfo?.totalPrice || appointmentData.paymentInfo?.amountPaid || 0;
            let totalPointsAwarded = 0;

            if (appointmentData.userId) {
                if (totalPrice > 0) {
                    const purchasePointsResult = await awardPointsForPurchase(appointmentData.userId, totalPrice);
                    if (purchasePointsResult.success) {
                        totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
                    }
                }
                const visitPointsResult = await awardPointsForVisit(appointmentData.userId);
                if (visitPointsResult.success) {
                    totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
                }
            } else if (appointmentData.customerInfo?.phone) {
                 const phonePointsResult = await awardPointsByPhone(
                    appointmentData.customerInfo.phone, 
                    totalPrice, 
                    appointmentId
                );
                if (phonePointsResult.success) {
                    totalPointsAwarded = phonePointsResult.pointsAwarded || 0;
                }
            }
            appointmentData._totalPointsAwarded = totalPointsAwarded; // Store for notification
        }

        // Send LINE notification only if customer has userId (LINE ID)
        if (appointmentData.userId) {
            const dataForFlex = { ...appointmentData, id: appointmentId };
            
            switch (newStatus) {
                case 'confirmed':
                    await sendAppointmentConfirmedFlexMessage(appointmentData.userId, dataForFlex);
                    break;
                case 'completed':
                    await sendServiceCompletedFlexMessage(appointmentData.userId, { 
                        ...dataForFlex,
                        totalPointsAwarded: appointmentData._totalPointsAwarded || 0 
                    });
                    console.log('🔄 Status completed - sending review request for appointment:', appointmentId);
                    await sendReviewRequestToCustomer(appointmentId);
                    break;
                case 'cancelled':
                    await sendAppointmentCancelledFlexMessage(appointmentData.userId, dataForFlex, note || 'ไม่ได้ระบุเหตุผล');
                    break;
            }
        } else if (newStatus === 'completed') {
            console.log(`Appointment ${appointmentId} completed for customer without LINE ID. Manual notification may be required.`);
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

        console.log('🔄 Sending Review Flex Message for appointment:', appointmentId, 'to user:', appointmentData.userId);
        const reviewResult = await sendReviewFlexMessage(appointmentData.userId, {
            id: appointmentId,
            ...appointmentData
        });
        console.log('📤 Review Flex Message result:', reviewResult);

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
            if (newStatus === 'completed') {
                await sendServiceCompletedFlexMessage(appointmentData.userId, {
                    ...appointmentData,
                    id: appointmentId,
                    pointsAwarded: 0 // Points are awarded by admin/system
                });
                await sendReviewRequestToCustomer(appointmentId);
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
        const { customerName, serviceName, fullAppointmentData } = await db.runTransaction(async (transaction) => {
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
                fullAppointmentData: appointmentData
            };
        });
        
        await sendAppointmentCancelledFlexMessage(userId, { ...fullAppointmentData, id: appointmentId }, 'ยกเลิกโดยลูกค้า');
        
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
        console.log('🔄 Sending invoice for appointment:', appointmentId);
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลการนัดหมาย");
        const appointmentData = appointmentDoc.data();

        console.log('📋 Appointment data:', {
            id: appointmentId,
            userId: appointmentData.userId,
            serviceInfo: appointmentData.serviceInfo,
            paymentInfo: appointmentData.paymentInfo
        });

        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'invoiced',
            updatedAt: FieldValue.serverTimestamp()
        });

        console.log('🔄 Sending Payment Flex Message for appointment:', appointmentId, 'to user:', appointmentData.userId);
        const paymentResult = await sendPaymentFlexMessage(appointmentData.userId, {
            id: appointmentId,
            ...appointmentData
        });
        console.log('📤 Payment Flex Message result:', paymentResult);

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
            throw new Error("This appointment cannot be confirmed as it's not awaiting confirmation.");
        }

        await appointmentRef.update({
            status: 'confirmed',
            updatedAt: FieldValue.serverTimestamp(),
        });
        
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