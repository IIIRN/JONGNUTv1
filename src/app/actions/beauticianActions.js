"use server";

import { db } from '@/app/lib/firebaseAdmin';

/**
 * Registers a LINE User ID to a beautician profile based on their phone number.
 * @param {string} phoneNumber - The phone number entered by the beautician.
 * @param {string} lineUserId - The LINE User ID from the LIFF context.
 * @returns {Promise<object>} - An object indicating success or failure.
 */
export async function registerLineIdToBeautician(phoneNumber, lineUserId) {
    if (!phoneNumber || !lineUserId) {
        return { success: false, error: 'Phone number and LINE User ID are required.' };
    }

    const beauticiansRef = db.collection('beauticians');
    
    // 1. Find the beautician by phone number
    const query = beauticiansRef.where('phoneNumber', '==', phoneNumber).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ กรุณาติดต่อแอดมิน' };
    }

    const beauticianDoc = snapshot.docs[0];
    const beauticianData = beauticianDoc.data();

    // 2. Check if the beautician is already linked to another LINE account
    if (beauticianData.lineUserId && beauticianData.lineUserId !== '') {
        return { success: false, error: 'เบอร์โทรศัพท์นี้ถูกผูกกับบัญชี LINE อื่นไปแล้ว' };
    }

    // 3. Update the beautician document with the new LINE User ID
    try {
        await beauticianDoc.ref.update({
            lineUserId: lineUserId
        });
        return { success: true, message: 'ยืนยันตัวตนสำเร็จ' };
    } catch (error) {
        console.error("Error updating beautician document:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}