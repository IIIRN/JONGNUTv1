'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ฟังก์ชันบันทึกการตั้งค่าการแจ้งเตือน (ที่คุณมีอยู่แล้ว)
export async function saveNotificationSettings(settingsData) {
    try {
        const settingsRef = db.collection('settings').doc('notifications');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ฟังก์ชันบันทึกการตั้งค่าการจอง (ที่คุณมีอยู่แล้ว)
export async function saveBookingSettings(settingsData) {
    try {
        const settingsRef = db.collection('settings').doc('booking');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ฟังก์ชันบันทึกการตั้งค่าคะแนน (ที่คุณมีอยู่แล้ว)
export async function savePointSettings(settingsData) {
    try {
        const settingsRef = db.collection('settings').doc('points');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// V V V V V V V V V V V V V V V V V V V V V
// เพิ่มฟังก์ชันสำหรับบันทึกการตั้งค่า Payment
// V V V V V V V V V V V V V V V V V V V V V
export async function savePaymentSettings(settingsData) {
    try {
        const settingsRef = db.collection('settings').doc('payment');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving payment settings:", error);
        return { success: false, error: error.message };
    }
}

export async function getPaymentSettings() {
    try {
        const docRef = db.collection('settings').doc('payment');
        const docSnap = await docRef.get();

        if (docSnap.exists()) {
            return { success: true, settings: docSnap.data() };
        } else {
            // คืนค่า default หรือ error ถ้ายังไม่มีการตั้งค่า
            return { success: false, error: "ยังไม่ได้ตั้งค่าการชำระเงิน" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}