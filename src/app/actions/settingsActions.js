"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore'; // [!code focus]

/**
 * Saves notification settings to Firestore.
 * @param {object} settingsData - The settings object from the form.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveNotificationSettings(settingsData) {
  try {
    const settingsRef = db.collection('settings').doc('notifications');
    
    await settingsRef.set({
      ...settingsData,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }); 

    console.log("Successfully saved notification settings.");
    return { success: true };

  } catch (error) {
    console.error("Error saving notification settings:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Saves booking settings to Firestore.
 */
export async function saveBookingSettings(settingsData) {
  try {
    const settingsRef = db.collection('settings').doc('booking');
    // [!code focus start]
    // --- UPDATED: บันทึกเฉพาะ bufferHours ---
    const dataToSave = {
        bufferHours: settingsData.bufferHours || 0,
        updatedAt: FieldValue.serverTimestamp()
    };
    await settingsRef.set(dataToSave, { merge: true });
    // [!code focus end]
    console.log("Successfully saved booking settings.");
    return { success: true };
  } catch (error) {
    console.error("Error saving booking settings:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches booking settings from Firestore.
 */
export async function fetchBookingSettings() {
    try {
        const settingsRef = db.collection('settings').doc('booking');
        const docSnap = await settingsRef.get();
        if (docSnap.exists()) {
            return { success: true, settings: JSON.parse(JSON.stringify(docSnap.data())) };
        }
        // [!code focus start]
        // --- UPDATED: คืนค่าเริ่มต้นที่ไม่มี nonOperationalDays ---
        return { success: true, settings: { bufferHours: 0 } };
        // [!code focus end]
    } catch (error) {
        console.error("Error fetching booking settings:", error);
        return { success: false, error: error.message };
    }
}