"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendLineMessage } from './lineActions';
import { Timestamp, FieldPath } from 'firebase-admin/firestore';
import { getShopProfile } from './settingsActions';

/**
 * Generates and sends a daily report to selected admins.
 */
export async function sendDailyReportNow() {
  try {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
      throw new Error("ยังไม่มีการตั้งค่าการส่ง Report");
    }
    const settingsData = settingsDoc.data();
    const recipientUids = settingsData.reportRecipients;

    if (!recipientUids || recipientUids.length === 0) {
      return { success: true, message: "ไม่มีผู้รับที่ถูกตั้งค่าไว้" };
    }

    const adminsRef = db.collection('admins');
    const adminsSnapshot = await adminsRef.where(FieldPath.documentId(), 'in', recipientUids).get();
    const recipientLineIds = adminsSnapshot.docs
        .map(doc => doc.data().lineUserId)
        .filter(Boolean);

    if (recipientLineIds.length === 0) {
        return { success: true, message: "ผู้รับที่เลือกไม่มี Line User ID" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointmentsSnapshot = await db.collection('appointments')
      .where('createdAt', '>=', Timestamp.fromDate(today))
      .where('createdAt', '<', Timestamp.fromDate(tomorrow))
      .get();
      
    const todaysAppointments = appointmentsSnapshot.docs.map(doc => doc.data());

    const totalAppointments = todaysAppointments.length;
    const completedAppointments = todaysAppointments.filter(b => b.status === 'completed').length;
    const cancelledAppointments = todaysAppointments.filter(b => b.status === 'cancelled').length;
    const totalRevenue = todaysAppointments
      .filter(b => b.paymentInfo.paymentStatus === 'paid')
      .reduce((sum, b) => sum + b.paymentInfo.totalPrice, 0);

    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';

    const reportMessage = `📊 Report สรุปประจำวันที่ ${today.toLocaleDateString('th-TH')}\n\n` +
      `- รายการนัดหมายใหม่: ${totalAppointments} รายการ\n` +
      `- งานที่สำเร็จ: ${completedAppointments} รายการ\n` +
      `- ยกเลิก: ${cancelledAppointments} รายการ\n` +
      `- รายได้รวม: ${totalRevenue.toLocaleString()} ${currencySymbol}\n\n` +
      `(ข้อความนี้ถูกสร้างโดยการกดส่งทันที)`;

    const sendPromises = recipientLineIds.map(lineId => sendLineMessage(lineId, reportMessage));
    await Promise.all(sendPromises);

    return { success: true, message: `ส่ง Report สำเร็จไปยังแอดมิน ${recipientLineIds.length} คน` };

  } catch (error) {
    console.error("Error sending daily report:", error);
    return { success: false, error: error.message };
  }
}
