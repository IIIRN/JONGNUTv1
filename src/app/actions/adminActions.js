"use server";

import { db } from '@/app/lib/firebaseAdmin';

/**
 * Fetches all admin users from the 'admins' collection.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAllAdmins() {
  try {
    const adminsRef = db.collection('admins');
    const snapshot = await adminsRef.orderBy('firstName').get();

    if (snapshot.empty) {
      return { success: true, admins: [] };
    }

    const admins = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id, // ใช้ uid ที่เป็น document id
            firstName: data.firstName,
            lastName: data.lastName
        };
    });

    return { success: true, admins: JSON.parse(JSON.stringify(admins)) };
  } catch (error) {
    console.error("Error fetching all admins:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches admins with full details from Firestore.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAdmins() {
  try {
    const adminsRef = db.collection('admins');
    const adminSnapshot = await adminsRef.get();

    const admins = adminSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'admin', // เพิ่ม property 'type' เพื่อระบุประเภท
    }));

    // เรียงลำดับตามวันที่สร้างล่าสุด
    const sortedAdmins = admins.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || 0;
        const dateB = b.createdAt?.toDate() || 0;
        return dateB - dateA;
    });

    return { success: true, admins: JSON.parse(JSON.stringify(sortedAdmins)) };
  } catch (error) {
    console.error("Error fetching admins:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes an admin from the 'admins' collection.
 * @param {string} adminId - The UID of the admin to delete.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteAdmin(adminId) {
    if (!adminId) {
        return { success: false, error: 'Admin ID is required.' };
    }

    try {
        const docRef = db.collection('admins').doc(adminId);
        await docRef.delete();
        console.log(`Successfully deleted admin ${adminId}.`);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting admin ${adminId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates admin information
 * @param {string} adminId - The UID of the admin to update.
 * @param {object} updateData - Data to update.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAdmin(adminId, updateData) {
    if (!adminId || !updateData) {
        return { success: false, error: 'Admin ID and update data are required.' };
    }

    try {
        const docRef = db.collection('admins').doc(adminId);
        await docRef.update({ 
            ...updateData,
            updatedAt: new Date()
        });
        console.log(`Successfully updated admin ${adminId}.`);
        return { success: true };
    } catch (error) {
        console.error(`Error updating admin ${adminId}:`, error);
        return { success: false, error: error.message };
    }
}