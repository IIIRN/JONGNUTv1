"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { revalidatePath } from 'next/cache';

/**
 * Fetches all users (admins and employees) from Firestore.
 * @returns {Promise<{success: boolean, users?: Array, error?: string}>}
 */
export async function fetchAllUsers() {
  try {
    const adminsRef = db.collection('admins');
    const employeesRef = db.collection('employees');

    const [adminSnapshot, employeeSnapshot] = await Promise.all([
      adminsRef.get(),
      employeesRef.get(),
    ]);

    const admins = adminSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      role: 'Admin', // เพิ่ม property 'role'
    }));

    const employees = employeeSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      role: 'Employee', // เพิ่ม property 'role'
    }));

    // รวมข้อมูลและเรียงลำดับตามวันที่สร้างล่าสุด
    const allUsers = [...admins, ...employees].sort((a, b) => {
        const dateA = a.createdAt?.toDate() || 0;
        const dateB = b.createdAt?.toDate() || 0;
        return dateB - dateA;
    });

    return { success: true, users: JSON.parse(JSON.stringify(allUsers)) };
  } catch (error) {
    console.error("Error fetching all users:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a user from either the 'admins' or 'employees' collection.
 * @param {string} userId - The UID of the user to delete.
 * @param {string} role - The role of the user ('Admin' or 'Employee').
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteUser(userId, role) {
    if (!userId || !role) {
        return { success: false, error: 'User ID and role are required.' };
    }

    // กำหนด collection ที่จะลบข้อมูลตาม role
    const collectionName = role === 'Admin' ? 'admins' : 'employees';
    const docRef = db.collection(collectionName).doc(userId);

    try {
        // *** หมายเหตุ: การลบข้อมูลใน Firestore ไม่ได้ลบบัญชีใน Firebase Authentication ***
        // หากต้องการลบบัญชีออกจากระบบโดยสมบูรณ์ จะต้องเรียกใช้ admin.auth().deleteUser(userId) เพิ่มเติม
        await docRef.delete();
  // ...existing code...
        revalidatePath('/employees');
        return { success: true };
    } catch (error) {
        console.error(`Error deleting user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

