"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { 
    sendBookingNotification
    // sendCancellationNotification has been removed
} from './lineActions';
import { 
    sendServiceCompletedFlexMessage, 
    sendReviewFlexMessage,
    sendPaymentConfirmationFlexMessage
} from './lineFlexActions';
import { awardPointsForPurchase, awardPointsForVisit, awardPointsByPhone } from './pointActions'; 
import { findOrCreateCustomer } from './customerActions'; 

// --- Helper to get notification settings ---
const getNotificationSettings = async () => {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    return settingsDoc.exists ? settingsDoc.data() : {};
};

// --- Registration and Status Updates ---

export async function registerLineIdToEmployee(phoneNumber, lineUserId) {
    if (!phoneNumber || !lineUserId) {
        return { success: false, error: 'Phone number and LINE User ID are required.' };
    }
    const employeesRef = db.collection('employees');
    const q = employeesRef.where('phoneNumber', '==', phoneNumber).limit(1);
    const snapshot = await q.get();

    if (snapshot.empty) {
        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ' };
    }
    const employeeDoc = snapshot.docs[0];
    if (employeeDoc.data().lineUserId) {
        return { success: false, error: 'เบอร์นี้ถูกผูกกับบัญชี LINE อื่นแล้ว' };
    }

    try {
        await employeeDoc.ref.update({ lineUserId: lineUserId });
        return { success: true, message: 'ยืนยันตัวตนสำเร็จ' };
    } catch (error) {
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}

export async function updateAppointmentStatus(appointmentId, newStatus, employeeId) {
    if (!appointmentId || !newStatus || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const [appointmentDoc, settings] = await Promise.all([
            appointmentRef.get(),
            getNotificationSettings()
        ]);

        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลนัดหมาย");
        
        const appointmentData = appointmentDoc.data();
        const notificationsEnabled = settings.allNotifications?.enabled;
        const customerNotificationsEnabled = notificationsEnabled && settings.customerNotifications?.enabled;

        const updateData = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (newStatus === 'in_progress') {
            updateData['timeline.startedAt'] = FieldValue.serverTimestamp();
            updateData['timeline.checkedInBy'] = employeeId;
        } else if (newStatus === 'completed') {
            updateData['timeline.completedAt'] = FieldValue.serverTimestamp();
        } else if (newStatus === 'cancelled') {
            updateData['timeline.cancelledAt'] = FieldValue.serverTimestamp();
            updateData['timeline.cancelledBy'] = `employee:${employeeId}`;
            updateData['timeline.cancellationReason'] = 'Cancelled by employee';
        }

        await appointmentRef.update(updateData);

        // --- Conditional Notifications ---
        if (appointmentData.userId) {
            const notificationPayload = {
                ...appointmentData,
                id: appointmentId,
                appointmentId: appointmentId,
            };

            // Notification for cancellation has been removed as per user request.

            if (newStatus === 'completed') {
                const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
                let totalPointsAwarded = 0;
                if (totalPrice > 0) {
                    const purchasePointsResult = await awardPointsForPurchase(appointmentData.userId, totalPrice);
                    if (purchasePointsResult.success) totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
                }
                const visitPointsResult = await awardPointsForVisit(appointmentData.userId);
                if (visitPointsResult.success) totalPointsAwarded += visitPointsResult.pointsAwarded || 0;

                notificationPayload.totalPointsAwarded = totalPointsAwarded;

                if (customerNotificationsEnabled && settings.customerNotifications?.serviceCompleted) {
                    await sendServiceCompletedFlexMessage(appointmentData.userId, notificationPayload);
                }

                if (customerNotificationsEnabled && settings.customerNotifications?.reviewRequest) {
                    await sendReviewFlexMessage(appointmentData.userId, notificationPayload);
                }
            }
        }

        if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
            await findOrCreateCustomer(appointmentData.customerInfo, appointmentData.userId);
        }

        return { success: true };
    } catch (error) {
        console.error("Error updating appointment status:", error);
        return { success: false, error: error.message };
    }
}

export async function updatePaymentStatusByEmployee(appointmentId, employeeId) {
    if (!appointmentId || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);
    
    try {
        const [appointmentDoc, settings] = await Promise.all([
            appointmentRef.get(),
            getNotificationSettings()
        ]);

        if (!appointmentDoc.exists) {
            throw new Error("ไม่พบข้อมูลนัดหมาย!");
        }
        const appointmentData = appointmentDoc.data();

        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            'paymentInfo.paymentReceivedBy': employeeId,
            updatedAt: FieldValue.serverTimestamp()
        });

        const userId = appointmentData.userId;
        const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
        let totalPointsAwarded = 0;

        if (userId) {
            if (totalPrice > 0) {
                const purchasePointsResult = await awardPointsForPurchase(userId, totalPrice);
                if (purchasePointsResult.success) totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
            }
            const visitPointsResult = await awardPointsForVisit(userId);
            if (visitPointsResult.success) totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
        }

        // --- Conditional Admin Notification ---
        const adminNotificationsEnabled = settings.allNotifications?.enabled && settings.adminNotifications?.enabled;
        if (adminNotificationsEnabled && settings.adminNotifications?.paymentReceived) {
            try {
                const notificationData = {
                    customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
                    serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                    appointmentDate: appointmentData.date,
                    appointmentTime: appointmentData.time,
                    totalPrice: appointmentData.paymentInfo.totalPrice
                };
                await sendBookingNotification(notificationData, 'paymentReceived');
            } catch (notificationError) {
                console.error('Error sending payment notification to admin:', notificationError);
            }
        }

        // --- Conditional Customer Notification for Payment ---
        const customerNotificationsEnabled = settings.allNotifications?.enabled && settings.customerNotifications?.enabled;
        if (customerNotificationsEnabled && settings.customerNotifications?.paymentInvoice && userId) {
            try {
                const payload = { ...appointmentData, id: appointmentId, appointmentId: appointmentId };
                await sendPaymentConfirmationFlexMessage(userId, payload);
            } catch (notificationError) {
                console.error('Error sending payment invoice to customer:', notificationError);
            }
        }

        return { 
            success: true, 
            pointsAwarded: totalPointsAwarded 
        };

    } catch (error) {
        console.error("Error updating payment status by employee:", error);
        return { success: false, error: error.message };
    }
}


// --- Appointment Lookups ---

export async function findAppointmentsByPhone(phoneNumber) {
    if (!phoneNumber) return { success: false, error: "Phone number is required." };
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        const q = db.collection('appointments')
            .where('customerInfo.phone', '==', phoneNumber)
            .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'pending'])
            .orderBy('date', 'asc')
            .orderBy('time', 'asc');

        const snapshot = await q.get();
        const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        return { success: true, appointments: JSON.parse(JSON.stringify(appointments)) };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function findAppointmentById(appointmentId) {
    if (!appointmentId) return { success: false, error: "Appointment ID is required." };
    try {
        const docRef = db.collection('appointments').doc(appointmentId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const appointment = { id: docSnap.id, ...docSnap.data() };
            return { success: true, appointment: JSON.parse(JSON.stringify(appointment)) };
        } else {
            return { success: false, error: "Appointment not found." };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Admin-related actions ---
export async function promoteEmployeeToAdmin(employeeId) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const adminRef = db.collection('admins').doc(employeeId);

    try {
        await db.runTransaction(async (transaction) => {
            const employeeDoc = await transaction.get(employeeRef);
            if (!employeeDoc.exists) {
                throw new Error("ไม่พบข้อมูลพนักงานคนดังกล่าว");
            }
            const employeeData = employeeDoc.data();
            const adminData = {
                ...employeeData,
                role: 'admin',
                promotedAt: FieldValue.serverTimestamp(),
            };
            transaction.set(adminRef, adminData);
            transaction.delete(employeeRef);
        });

        revalidatePath('/employees');
        revalidatePath(`/employees/${employeeId}`);

        return { success: true };
    } catch (error) {
        console.error("Error promoting employee:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchEmployees() {
  try {
    const employeesRef = db.collection('employees');
    const employeeSnapshot = await employeesRef.get();

    const employees = employeeSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'employee', // เพิ่ม property 'type' เพื่อระบุประเภท
    }));

    const sortedEmployees = employees.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || 0;
        const dateB = b.createdAt?.toDate() || 0;
        return dateB - dateA;
    });

    return { success: true, employees: JSON.parse(JSON.stringify(sortedEmployees)) };
  } catch (error) {
    console.error("Error fetching employees:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteEmployee(employeeId) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    try {
        const docRef = db.collection('employees').doc(employeeId);
        await docRef.delete();
        revalidatePath('/employees');
        return { success: true };
    } catch (error) {
        console.error(`Error deleting employee ${employeeId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function updateEmployeeStatus(employeeId, status) {
    if (!employeeId || !status) {
        return { success: false, error: 'Employee ID and status are required.' };
    }

    try {
        const docRef = db.collection('employees').doc(employeeId);
        await docRef.update({ 
            status: status,
            updatedAt: new Date()
        });
        revalidatePath('/employees');
        return { success: true };
    } catch (error) {
        console.error(`Error updating employee ${employeeId} status:`, error);
        return { success: false, error: error.message };
    }
}