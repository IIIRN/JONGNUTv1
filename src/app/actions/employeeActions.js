"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { sendBookingNotification } from './lineActions';
import { awardPointsForPurchase, awardPointsForVisit } from './pointActions'; 

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
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลนัดหมาย");
        
        const appointmentData = appointmentDoc.data();
        
        const updateData = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (newStatus === 'in_progress') {
            updateData['timeline.startedAt'] = FieldValue.serverTimestamp();
            updateData['timeline.checkedInBy'] = employeeId;
        } else if (newStatus === 'completed') {
            updateData['timeline.completedAt'] = FieldValue.serverTimestamp();
        }

        await appointmentRef.update(updateData);

        // Award points when status changes to completed
        if (newStatus === 'completed' && appointmentData.userId) {
            const totalPrice = appointmentData.paymentInfo?.totalPrice || appointmentData.paymentInfo?.amountPaid || 0;
            
            let totalPointsAwarded = 0;

            // Award points for purchase amount
            if (totalPrice > 0) {
                const purchasePointsResult = await awardPointsForPurchase(appointmentData.userId, totalPrice);
                if (purchasePointsResult.success) {
                    totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
                }
            }

            // Award points for visit
            const visitPointsResult = await awardPointsForVisit(appointmentData.userId);
            if (visitPointsResult.success) {
                totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
            }

            // Send completion message with points info to customer
            if (appointmentData.userId) {
                const serviceName = appointmentData.serviceInfo?.name || 'บริการ';
                let customerMessage = `✨ บริการ "${serviceName}" ของคุณเสร็จสมบูรณ์แล้ว ขอบคุณที่ใช้บริการค่ะ`;
                
                if (totalPointsAwarded > 0) {
                    customerMessage += `\n\n🎉 คุณได้รับ ${totalPointsAwarded} พ้อยต์จากการใช้บริการ!`;
                }
                
                await sendBookingNotification({
                    customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
                    serviceName: serviceName,
                    appointmentDate: appointmentData.date,
                    appointmentTime: appointmentData.time,
                    message: customerMessage
                }, 'appointmentCompleted');
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Error updating appointment status:", error);
        return { success: false, error: error.message };
    }
}


/**
 * NEW FUNCTION: Updates an appointment's payment status by an employee
 */
export async function updatePaymentStatusByEmployee(appointmentId, employeeId) {
    if (!appointmentId || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);
    
    try {
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            throw new Error("ไม่พบข้อมูลนัดหมาย!");
        }
        const appointmentData = appointmentDoc.data();

        // Update payment status in Firestore
        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            'paymentInfo.paymentReceivedBy': employeeId, // Track who received the payment
            updatedAt: FieldValue.serverTimestamp()
        });

        // Award points for purchase and visit
        const userId = appointmentData.userId;
        const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
        
        let totalPointsAwarded = 0;

        // Award points for purchase amount
        if (totalPrice > 0) {
            const purchasePointsResult = await awardPointsForPurchase(userId, totalPrice);
            if (purchasePointsResult.success) {
                totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
            }
        }

        // Award points for visit
        const visitPointsResult = await awardPointsForVisit(userId);
        if (visitPointsResult.success) {
            totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
        }

        // Send notification to admins
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
            console.error('Error sending payment notification from employee action:', notificationError);
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
            .where('status', 'in', ['confirmed', 'awaiting_confirmation'])
            .where('date', '>=', todayStr)
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

        if (docSnap.exists()) {
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

        console.log(`Successfully promoted employee ${employeeId} to admin.`);
        revalidatePath('/employees');
        revalidatePath(`/employees/${employeeId}`);

        return { success: true };
    } catch (error) {
        console.error("Error promoting employee:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches only employees from Firestore.
 * @returns {Promise<{success: boolean, employees?: Array, error?: string}>}
 */
export async function fetchEmployees() {
  try {
    const employeesRef = db.collection('employees');
    const employeeSnapshot = await employeesRef.get();

    const employees = employeeSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'employee', // เพิ่ม property 'type' เพื่อระบุประเภท
    }));

    // เรียงลำดับตามวันที่สร้างล่าสุด
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

/**
 * Deletes an employee from the 'employees' collection.
 * @param {string} employeeId - The UID of the employee to delete.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteEmployee(employeeId) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    try {
        const docRef = db.collection('employees').doc(employeeId);
        await docRef.delete();
        console.log(`Successfully deleted employee ${employeeId}.`);
        revalidatePath('/employees');
        return { success: true };
    } catch (error) {
        console.error(`Error deleting employee ${employeeId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates employee status
 * @param {string} employeeId - The UID of the employee to update.
 * @param {string} status - New status ('available', 'on_leave', 'suspended').
 * @returns {Promise<{success: boolean, error?: string}>}
 */
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
        console.log(`Successfully updated employee ${employeeId} status to ${status}.`);
        revalidatePath('/employees');
        return { success: true };
    } catch (error) {
        console.error(`Error updating employee ${employeeId} status:`, error);
        return { success: false, error: error.message };
    }
}