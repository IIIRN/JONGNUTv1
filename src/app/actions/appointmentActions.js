
'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { sendLineMessage, sendBookingNotification } from '@/app/actions/lineActions';
import { sendTelegramMessageToAdmin } from '@/app/actions/telegramActions';

/**
 * สร้างนัดหมายใหม่ (appointment) โดยป้องกัน overbooking slot
 * @param {object} appointmentData - ต้องมี date, time, serviceId, beauticianId, userId, ...
 * @returns {Promise<object>} - { success, id?, error? }
 */
export async function createAppointmentWithSlotCheck(appointmentData) {
    const { date, time, serviceId, beauticianId } = appointmentData;
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
            
            // ตรวจสอบว่าวันที่จองเปิดทำการหรือไม่
            const appointmentDate = new Date(date);
            const dayOfWeek = appointmentDate.getDay();
            const daySchedule = weeklySchedule[dayOfWeek];
            
            if (daySchedule && !daySchedule.isOpen) {
                return { success: false, error: 'วันที่เลือกปิดทำการ กรุณาเลือกวันอื่น' };
            }
            
            // ตรวจสอบว่าเวลาที่จองอยู่ในช่วงเวลาทำการหรือไม่
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
            }
            if (!maxSlot && data.totalBeauticians) maxSlot = Number(data.totalBeauticians);
        }

        // เช็คจำนวนจองใน slot นี้
        let queryConditions = [
            ['date', '==', date],
            ['time', '==', time],
            ['status', 'in', ['pending', 'confirmed', 'awaiting_confirmation']]
        ];
        
        // ถ้าเป็นโหมดเลือกช่างและมีการระบุช่าง ให้เช็คเฉพาะช่างนั้น
        if (useBeautician && beauticianId && beauticianId !== 'auto-assign') {
            queryConditions.push(['beauticianId', '==', beauticianId]);
            maxSlot = 1; // แต่ละช่างรับได้ 1 คิวต่อช่วงเวลา
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

        // สร้าง appointment ใหม่
        const newRef = db.collection('appointments').doc();
        await newRef.set({
            ...appointmentData,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // ส่งการแจ้งเตือนการจองใหม่ไปยังแอดมิน
        try {
            const bookingNotificationData = {
                customerName: appointmentData.customerInfo?.firstName 
                    ? `${appointmentData.customerInfo.firstName} ${appointmentData.customerInfo.lastName || ''}`
                    : appointmentData.customerInfo?.displayName || 'ลูกค้า',
                serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: appointmentData.date,
                appointmentTime: appointmentData.time,
                totalPrice: appointmentData.totalPrice || appointmentData.serviceInfo?.price || 0
            };
            
            await sendBookingNotification(bookingNotificationData, 'newBooking');
        } catch (notificationError) {
            console.error('Error sending booking notification:', notificationError);
            // ไม่ให้ notification error หยุดการทำงานของการจอง
        }

        return { success: true, id: newRef.id };
    } catch (error) {
        console.error('Error creating appointment with slot check:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ยืนยันการเสร็จสิ้นบริการโดยแอดมิน
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

        const serviceRef = db.collection('services').doc(appointmentData.serviceId);

        await db.runTransaction(async (transaction) => {
            transaction.update(appointmentRef, {
                status: 'completed',
                'completionInfo.employeeId': adminId,
                'completionInfo.timestamp': FieldValue.serverTimestamp(),
                'completionInfo.notes': completionData.notes || '',
                updatedAt: FieldValue.serverTimestamp()
            });

            transaction.update(serviceRef, { 
                status: 'available',
            });
        });
        
        let notificationMessage = `บริการ ${appointmentData.serviceInfo.name} ของคุณเสร็จสมบูรณ์แล้ว`;
        notificationMessage += `\nขอบคุณที่ใช้บริการค่ะ`;

        await sendLineMessage(appointmentData.userId, notificationMessage);
        await sendReviewRequestToCustomer(appointmentId);

        return { success: true };

    } catch (error) {
        console.error("Error completing appointment by admin:", error);
        return { success: false, error: error.message };
    }
}

/**
 * ยืนยันการนัดหมายและบันทึกการชำระเงินโดยแอดมิน
 */
export async function confirmAppointmentAndPaymentByAdmin(appointmentId, adminId, data) {
    if (!appointmentId || !adminId || !data) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            throw new Error("ไม่พบข้อมูลการนัดหมาย");
        }
        const appointmentData = appointmentDoc.data();

        if (appointmentData.status !== 'awaiting_confirmation') {
            throw new Error("สถานะการนัดหมายไม่ถูกต้อง ไม่สามารถดำเนินการได้");
        }
        
        const serviceId = appointmentData.serviceId;
        const serviceRef = db.collection('services').doc(serviceId);

        await db.runTransaction(async (transaction) => {
            transaction.update(appointmentRef, {
                status: 'confirmed',
                'appointmentInfo.employeeId': adminId, 
                'appointmentInfo.timestamp': FieldValue.serverTimestamp(),
                'paymentInfo.paymentStatus': 'paid',
                'paymentInfo.paidAt': FieldValue.serverTimestamp(),
                'paymentInfo.amountPaid': data.amount,
                'paymentInfo.paymentMethod': data.method,
                updatedAt: FieldValue.serverTimestamp(),
            });

            transaction.update(serviceRef, {
                status: 'unavailable'
            });
        });

        // Send notification to customer
        const customerMessage = `การนัดหมายบริการ ${appointmentData.serviceInfo.name} ของคุณได้รับการยืนยันแล้วค่ะ`;
        await sendLineMessage(appointmentData.userId, customerMessage);

        // ส่งการแจ้งเตือนการชำระเงินไปยังแอดมิน
        try {
            const bookingNotificationData = {
                customerName: appointmentData.customerInfo?.firstName 
                    ? `${appointmentData.customerInfo.firstName} ${appointmentData.customerInfo.lastName || ''}`
                    : appointmentData.customerInfo?.displayName || 'ลูกค้า',
                serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: appointmentData.date,
                appointmentTime: appointmentData.time,
                totalPrice: data.amount
            };
            
            await sendBookingNotification(bookingNotificationData, 'paymentReceived');
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
 * (MODIFIED FOR SELF-DRIVE RENTAL)
 * Creates a new booking, checking for vehicle availability within the requested date range.
 * @param {object} bookingData - The complete data required for the new booking.
 * @returns {Promise<object>} - The result of the booking creation process.
 */
export async function createBookingWithCheck(bookingData) {
    const { vehicleId, pickupInfo, returnInfo, customerInfo, userInfo, paymentInfo, vehicleInfo } = bookingData;
    
    const requestedStartTime = new Date(pickupInfo.dateTime);
    const requestedEndTime = new Date(returnInfo.dateTime);
    const bookingsRef = db.collection('bookings');

    try {
        const transactionResult = await db.runTransaction(async (transaction) => {
            const conflictQuery = bookingsRef
                .where('vehicleId', '==', vehicleId)
                .where('status', 'in', ['pending', 'confirmed', 'rented', 'awaiting_pickup']);
            const conflictSnapshot = await transaction.get(conflictQuery);
            let isOverlapping = false;
            conflictSnapshot.forEach(doc => {
                const existingBooking = doc.data();
                const bookingStartTime = existingBooking.pickupInfo.dateTime.toDate();
                const bookingEndTime = existingBooking.returnInfo.dateTime.toDate();
                if (requestedStartTime < bookingEndTime && requestedEndTime > bookingStartTime) {
                    isOverlapping = true;
                }
            });
            if (isOverlapping) {
                throw new Error('ขออภัย รถคันนี้ถูกจองในช่วงเวลาที่คุณเลือกไปแล้ว กรุณาเลือกวัน-เวลาใหม่อีกครั้ง');
            }

            const newBookingRef = bookingsRef.doc();
            transaction.set(newBookingRef, {
                ...bookingData, 
                pickupInfo: {
                    ...bookingData.pickupInfo,
                    dateTime: Timestamp.fromDate(new Date(bookingData.pickupInfo.dateTime)),
                },
                returnInfo: {
                    ...bookingData.returnInfo,
                    dateTime: Timestamp.fromDate(new Date(bookingData.returnInfo.dateTime)),
                },
                status: 'awaiting_pickup',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            const customerRef = db.collection("customers").doc(bookingData.userId);
            transaction.set(customerRef, {
                lineUserId: bookingData.userId,
                displayName: userInfo.displayName,
                name: customerInfo.name,
                pictureUrl: userInfo.pictureUrl || '',
                email: customerInfo.email,
                phone: customerInfo.phone,
                lastActivity: FieldValue.serverTimestamp()
             }, { merge: true });

            return { bookingId: newBookingRef.id };
        });

        const customerMessage = `การจองรถ ${vehicleInfo.brand} ของคุณสำเร็จแล้วค่ะ\n\nรหัสการจอง: ${transactionResult.bookingId.substring(0, 6).toUpperCase()}\nรับรถ: ${requestedStartTime.toLocaleString('th-TH')}\nยอดชำระรวม: ${paymentInfo.totalPrice.toLocaleString()} บาท\n\n${paymentInfo.hasInsurance ? `คุณได้เลือก: ${paymentInfo.insuranceInfo.name}` : 'การจองนี้ไม่มีประกัน'}\n\nกรุณาแสดง QR Code ในหน้า My Bookings ให้พนักงานในวันรับรถค่ะ`;
        await sendLineMessage(bookingData.userId, customerMessage);
        
        const adminMessage = `🔔 มีรายการจองใหม่!\n\n*ลูกค้า:* ${customerInfo.name}\n*รถ:* ${vehicleInfo.brand}\n*รับที่:* ${pickupInfo.name}\n*รวม:* ${paymentInfo.totalPrice.toLocaleString()} บาท ${paymentInfo.hasInsurance ? `(ประกัน: ${paymentInfo.insuranceInfo.name})` : ''}`;
        await sendTelegramMessageToAdmin(adminMessage);

        return { success: true, message: 'Booking created successfully!', id: transactionResult.bookingId };
    } catch (error) {
        console.error('Transaction failure:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ยกเลิกการจองโดยแอดมิน, อัปเดตสถานะ, และแจ้งเตือนลูกค้ากับคนขับ
 */
export async function cancelBookingByAdmin(bookingId, reason) {
    if (!bookingId || !reason) {
        return { success: false, error: 'จำเป็นต้องมี Booking ID และเหตุผล' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const resultForNotification = await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("ไม่พบข้อมูลการจอง!");
            
            const bookingData = bookingDoc.data();
            const driverId = bookingData.driverId;
            let driverDoc = null;
            let driverRef = null;

            if (driverId) {
                driverRef = db.collection('drivers').doc(driverId);
                driverDoc = await transaction.get(driverRef);
            }

            // อัปเดตสถานะการจองเป็น 'cancelled'
            transaction.update(bookingRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'admin', reason, timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });
            
            if (bookingData.status === 'rented') {
                const vehicleRef = db.collection('vehicles').doc(bookingData.vehicleId);
                transaction.update(vehicleRef, { status: 'available' });
            }
            
            // ถ้ามีคนขับที่รับงานนี้อยู่ ให้เปลี่ยนสถานะคนขับกลับเป็น 'available' (พร้อมขับ)
            if (driverRef && driverDoc && driverDoc.exists) {
                transaction.update(driverRef, { status: 'available' });
            }
            
            return { customerUserId: bookingData.userId, driverToNotify: driverDoc ? driverDoc.data() : null };
        });

        // ส่งข้อความแจ้งลูกค้า
        if (resultForNotification.customerUserId) {
            const customerMessage = `ขออภัยค่ะ การจองของคุณ (ID: ${bookingId.substring(0, 6).toUpperCase()}) ถูกยกเลิกเนื่องจาก: "${reason}"\n\nกรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม`;
            await sendLineMessage(resultForNotification.customerUserId, customerMessage);
        }
        
        // ส่งข้อความแจ้งคนขับ (ถ้ามี)
        const { driverToNotify } = resultForNotification;
        if (driverToNotify && driverToNotify.lineUserId) {
            const driverMessage = `งาน #${bookingId.substring(0, 6).toUpperCase()} ถูกยกเลิกโดยแอดมิน\nเหตุผล: "${reason}"\n\nสถานะของคุณถูกเปลี่ยนเป็น "พร้อมขับ" แล้ว`;
            await sendLineMessage(driverToNotify.lineUserId, driverMessage);
        }
        return { success: true };
    } catch (error) {
        console.error("Error cancelling booking:", error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่งลิงก์สำหรับทำรีวิวให้ลูกค้าเมื่องานเสร็จสิ้น
 */
export async function sendReviewRequestToCustomer(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            throw new Error("ไม่พบข้อมูลการจอง");
        }
        const bookingData = bookingDoc.data();

        if (bookingData.status !== 'completed') {
            throw new Error("ไม่สามารถส่งรีวิวสำหรับงานที่ยังไม่เสร็จสิ้น");
        }

        if (bookingData.reviewInfo?.submitted) {
            throw new Error("การจองนี้ได้รับการรีวิวแล้ว");
        }

        if (!bookingData.userId) {
            throw new Error("ไม่พบ LINE User ID ของลูกค้า");
        }

        // สร้าง LIFF URL สำหรับหน้ารีวิวโดยเฉพาะ
        const reviewLiffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${bookingId}`;
        const reviewMessage = `รบกวนสละเวลารีวิวการเดินทางของคุณ เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น\n${reviewLiffUrl}`;

        await sendLineMessage(bookingData.userId, reviewMessage);

        return { success: true };
    } catch (error) {
        console.error(`[Review Request] Error sending review request for booking ID ${bookingId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * อัปเดตสถานะการจอง (โดยปกติจะถูกเรียกใช้โดยคนขับ)
 */
export async function updateBookingStatusByDriver(bookingId, driverId, newStatus, note) {
    if (!bookingId || !driverId || !newStatus) {
        return { success: false, error: 'ต้องการ Booking ID, Driver ID, และสถานะใหม่' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    const driverRef = db.collection('drivers').doc(driverId);

    let bookingDataForNotification = null;

    try {
        await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("ไม่พบข้อมูลการจอง!");

            bookingDataForNotification = bookingDoc.data();

            // อัปเดตสถานะและเพิ่มประวัติ
            transaction.update(bookingRef, {
                status: newStatus,
                statusHistory: FieldValue.arrayUnion({ status: newStatus, note: note || "", timestamp: Timestamp.now() }),
                updatedAt: FieldValue.serverTimestamp()
            });
            // เมื่องานเสร็จสิ้น (completed) หรือลูกค้าไม่มา (noshow) ให้เปลี่ยนสถานะคนขับเป็น 'available'
            if (newStatus === 'completed' || newStatus === 'noshow') {
                transaction.update(driverRef, { status: 'available' });
            }
        });
        
        // ส่วนของการส่งข้อความแจ้งเตือนลูกค้าตามสถานะต่างๆ
        if (bookingDataForNotification && bookingDataForNotification.userId) {
            let customerMessage = '';
            switch (newStatus) {
                case 'stb':
                    customerMessage = `คนขับรถถึงจุดนัดรับแล้วค่ะ กรุณาเตรียมพร้อมสำหรับการเดินทาง`;
                    break;
                case 'pickup':
                    customerMessage = `คนขับได้รับคุณขึ้นรถแล้ว ขอให้เดินทางโดยสวัสดิภาพค่ะ`;
                    break;
                case 'completed':
                    // เมื่องานเสร็จ จะส่ง 2 ข้อความ: ขอบคุณ และ ขอรีวิว
                    const thankYouMessage = `เดินทางถึงที่หมายเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ CARFORTHIP ค่ะ`;
                    await sendLineMessage(bookingDataForNotification.userId, thankYouMessage);

                    const reviewLiffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${bookingId}`;
                    const reviewMessage = `รบกวนสละเวลารีวิวการเดินทางของคุณ เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น\n${reviewLiffUrl}`;
                    await sendLineMessage(bookingDataForNotification.userId, reviewMessage);

                    customerMessage = ''; // ไม่ต้องส่งข้อความซ้ำ
                    break;
                case 'noshow':
                    customerMessage = `คนขับไม่พบคุณที่จุดนัดรับตามเวลาที่กำหนด หากมีข้อสงสัยกรุณาติดต่อแอดมินค่ะ`;
                    break;
            }

            if (customerMessage) {
                await sendLineMessage(bookingDataForNotification.userId, customerMessage);
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Error updating booking status:", error);
        return { success: false, error: error.message };
    }
}

/**
 * (This function might need changes later for employee scanning)
 * ยกเลิกการจองโดยลูกค้า (เจ้าของการจอง)
*/
export async function cancelBookingByUser(bookingId, userId) {
    if (!bookingId || !userId) {
        return { success: false, error: 'ต้องการ Booking ID และ User ID' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("ไม่พบข้อมูลการจอง");
            
            const bookingData = bookingDoc.data();
            // ตรวจสอบว่าเป็นเจ้าของการจองจริง
            if (bookingData.userId !== userId) throw new Error("ไม่มีสิทธิ์ยกเลิกการจองนี้");
            // Allow cancellation only before pickup
            if (bookingData.status !== 'awaiting_pickup') throw new Error("การจองนี้ไม่สามารถยกเลิกได้แล้ว");

            transaction.update(bookingRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'customer', reason: 'Cancelled by customer.', timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });
            return { customerName: bookingData.customerInfo.name };
        });
        
        // แจ้งเตือนลูกค้าว่ายกเลิกสำเร็จ
        const customerMessage = `การจองของคุณ (ID: ${bookingId.substring(0, 6).toUpperCase()}) ได้ถูกยกเลิกเรียบร้อยแล้วค่ะ`;
        await sendLineMessage(userId, customerMessage);
        
        // แจ้งเตือนแอดมินเมื่อลูกค้าทำการยกเลิก
        const adminMessage = `🚫 การจองถูกยกเลิกโดยลูกค้า\n\n*ลูกค้า:* ${result.customerName}\n*Booking ID:* ${bookingId.substring(0, 6).toUpperCase()}`;
        await sendTelegramMessageToAdmin(adminMessage);
        
        return { success: true };
    } catch (error) {
        console.error("Error cancelling booking by user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * ยกเลิกการนัดหมายโดยลูกค้า (สำหรับคอลเลกชัน appointments)
 */
export async function cancelAppointmentByUser(appointmentId, userId) {
    if (!appointmentId || !userId) {
        return { success: false, error: 'ต้องการ Appointment ID และ User ID' };
    }
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const appointmentDoc = await transaction.get(appointmentRef);
            if (!appointmentDoc.exists) throw new Error('ไม่พบข้อมูลการนัดหมาย');

            const appointmentData = appointmentDoc.data();
            // ตรวจสอบว่าเป็นเจ้าของการนัดหมายจริง
            if (appointmentData.userId !== userId) throw new Error('ไม่มีสิทธิ์ยกเลิกการนัดหมายนี้');

            // ไม่อนุญาตให้ยกเลิกหากงานเสร็จหรือถูกยกเลิกแล้ว
            if (['completed', 'cancelled'].includes(appointmentData.status)) throw new Error('ไม่สามารถยกเลิกการนัดหมายนี้ได้');

            transaction.update(appointmentRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'customer', reason: 'Cancelled by customer.', timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });

            return { serviceName: appointmentData.serviceInfo?.name || appointmentData.serviceInfo?.id || 'N/A' };
        });

        // แจ้งลูกค้าว่ายกเลิกสำเร็จ
        const customerMessage = `การนัดหมายของคุณ (ID: ${appointmentId.substring(0,6).toUpperCase()}) ได้ถูกยกเลิกเรียบร้อยแล้วค่ะ`;
        await sendLineMessage(userId, customerMessage);

        // ส่งการแจ้งเตือนการยกเลิกไปยังแอดมิน
        try {
            const bookingNotificationData = {
                customerName: appointmentData.customerInfo?.firstName 
                    ? `${appointmentData.customerInfo.firstName} ${appointmentData.customerInfo.lastName || ''}`
                    : appointmentData.customerInfo?.displayName || 'ลูกค้า',
                serviceName: result.serviceName,
                appointmentDate: appointmentData.date,
                appointmentTime: appointmentData.time
            };
            
            await sendBookingNotification(bookingNotificationData, 'bookingCancelled');
        } catch (notificationError) {
            console.error('Error sending cancellation notification:', notificationError);
        }

        // แจ้งเตือนแอดมิน
        const adminMessage = `🚫 นัดหมายถูกยกเลิกโดยลูกค้า\n\n*บริการ:* ${result.serviceName}\n*Appointment ID:* ${appointmentId.substring(0,6).toUpperCase()}`;
        await sendTelegramMessageToAdmin(adminMessage);

        return { success: true };
    } catch (error) {
        console.error('Error cancelling appointment by user:', error);
        return { success: false, error: error.message };
    }
}

/**
 * (แก้ไข) ส่งลิงก์ใบแจ้งหนี้ให้ลูกค้าผ่าน LINE โดยใช้ LIFF สำหรับการชำระเงินโดยเฉพาะ
 */
export async function sendInvoiceToCustomer(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            throw new Error("ไม่พบข้อมูลการจอง");
        }
        const bookingData = bookingDoc.data();

        // **สำคัญ** สร้าง LIFF URL โดยมี bookingId ต่อท้าย
        const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID}/${bookingId}`;

        await bookingRef.update({
            'paymentInfo.paymentStatus': 'invoiced', // เปลี่ยนสถานะเป็น 'ส่งใบแจ้งหนี้แล้ว'
            updatedAt: FieldValue.serverTimestamp()
        });

        const customerMessage = `เรียนคุณ ${bookingData.customerInfo.name},\n\nนี่คือใบแจ้งค่าบริการสำหรับการเดินทางของคุณ\nยอดชำระ: ${bookingData.paymentInfo.totalPrice.toLocaleString()} บาท\n\nกรุณาคลิกที่ลิงก์เพื่อชำระเงิน:\n${liffUrl}`;

        await sendLineMessage(bookingData.userId, customerMessage);

        return { success: true };
    } catch (error) {
        console.error("Error sending invoice:", error);
        return { success: false, error: error.message };
    }
}
/**
 * (เพิ่มใหม่) ยืนยันว่าได้รับการชำระเงินสำหรับการจองแล้ว
 */
export async function confirmPayment(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        await bookingRef.update({
            'paymentInfo.paymentStatus': 'paid', // เปลี่ยนสถานะการจ่ายเงินเป็น 'paid'
            'paymentInfo.paidAt': FieldValue.serverTimestamp(), // บันทึกเวลาที่จ่ายเงิน
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error confirming payment:", error);
        return { success: false, error: error.message };
    }
}