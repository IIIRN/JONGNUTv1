"use server";

import { db } from '@/app/lib/firebaseAdmin';

/**
 * Registers a LINE User ID to a technician profile based on their phone number.
 * @param {string} phoneNumber - The phone number entered by the technician.
 * @param {string} lineUserId - The LINE User ID from the LIFF context.
 * @returns {Promise<object>} - An object indicating success or failure.
 */
export async function registerLineIdToTechnician(phoneNumber, lineUserId) {
    if (!phoneNumber || !lineUserId) {
        return { success: false, error: 'Phone number and LINE User ID are required.' };
    }

    const techniciansRef = db.collection('technicians');
    
    // 1. Find the technician by phone number
    const query = techniciansRef.where('phoneNumber', '==', phoneNumber).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ กรุณาติดต่อแอดมิน' };
    }

    const technicianDoc = snapshot.docs[0];
    const technicianData = technicianDoc.data();

    // 2. Check if the technician is already linked to another LINE account
    if (technicianData.lineUserId && technicianData.lineUserId !== '') {
        return { success: false, error: 'เบอร์โทรศัพท์นี้ถูกผูกกับบัญชี LINE อื่นไปแล้ว' };
    }

    // 3. Update the technician document with the new LINE User ID
    try {
        await technicianDoc.ref.update({
            lineUserId: lineUserId
        });
        return { success: true, message: 'ยืนยันตัวตนสำเร็จ' };
    } catch (error) {
        console.error("Error updating technician document:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}

