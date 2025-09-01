"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin'; // 1. Import db จาก Admin SDK
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

/**
 * Check if notifications are enabled
 */
async function getNotificationSettings() {
  try {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return data.lineNotifications || {
        enabled: true,
        newBooking: true,
        bookingCancelled: true,
        bookingModified: true,
        paymentReceived: true,
        reminderNotifications: true
      };
    }
    
    // Default settings if document doesn't exist
    return {
      enabled: true,
      newBooking: true,
      bookingCancelled: true,
      bookingModified: true,
      paymentReceived: true,
      reminderNotifications: true
    };
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    // Return default settings on error
    return {
      enabled: true,
      newBooking: true,
      bookingCancelled: true,
      bookingModified: true,
      paymentReceived: true,
      reminderNotifications: true
    };
  }
}

/**
 * Sends a push message to a single LINE user.
 */
export async function sendLineMessage(to, messageText) {
  if (!to || !messageText) {
    console.error("Missing 'to' or 'messageText'");
    return { success: false, error: "Missing recipient or message." };
  }
  try {
    const messageObject = { type: 'text', text: messageText };
    await client.pushMessage(to, messageObject);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send message to ${to}:`, error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * (ใหม่) Sends a push message to all registered admins.
 * @param {string} messageText - The text message to send.
 * @returns {Promise<{success: boolean, error?: string}>} - The result of the operation.
 */
export async function sendLineMessageToAllAdmins(messageText) {
  try {
    // Check if notifications are enabled
    const notificationSettings = await getNotificationSettings();
    if (!notificationSettings.enabled) {
      console.log("LINE notifications are disabled");
      return { success: true, message: "Notifications disabled" };
    }

    // 2. ค้นหาแอดมินทั้งหมดใน Firestore
    const adminsQuery = query(db.collection('admins'), where("lineUserId", "!=", null));
    const adminSnapshot = await adminsQuery.get();

    if (adminSnapshot.empty) {
      console.warn("No admins with lineUserId found to notify.");
      return { success: true, message: "No admins to notify." };
    }

    // 3. สร้าง Promise สำหรับส่งข้อความหาแอดมินทุกคน
    const notificationPromises = adminSnapshot.docs.map(doc => {
      const admin = doc.data();
      return sendLineMessage(admin.lineUserId, messageText);
    });

    // 4. รอให้ส่งข้อความครบทุกคน
    await Promise.all(notificationPromises);

    console.log(`Successfully sent notifications to ${adminSnapshot.size} admins.`);
    return { success: true };

  } catch (error) {
    console.error('Error sending message to all admins:', error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}

/**
 * Send booking notification to admins
 */
export async function sendBookingNotification(bookingData, notificationType) {
  try {
    const notificationSettings = await getNotificationSettings();
    
    // Check if notifications are enabled and this specific type is enabled
    if (!notificationSettings.enabled || !notificationSettings[notificationType]) {
      console.log(`${notificationType} notifications are disabled`);
      return { success: true, message: "Notification type disabled" };
    }

    let message = '';
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = bookingData;
    
    switch (notificationType) {
      case 'newBooking':
        message = `🆕 การจองใหม่\n` +
                 `👤 ลูกค้า: ${customerName}\n` +
                 `💅 บริการ: ${serviceName}\n` +
                 `📅 วันที่: ${appointmentDate}\n` +
                 `⏰ เวลา: ${appointmentTime}\n` +
                 `💰 ราคา: ${totalPrice} บาท`;
        break;
        
      case 'bookingCancelled':
        message = `❌ ยกเลิกการจอง\n` +
                 `👤 ลูกค้า: ${customerName}\n` +
                 `💅 บริการ: ${serviceName}\n` +
                 `📅 วันที่: ${appointmentDate}\n` +
                 `⏰ เวลา: ${appointmentTime}`;
        break;
        
      case 'bookingModified':
        message = `✏️ แก้ไขการจอง\n` +
                 `👤 ลูกค้า: ${customerName}\n` +
                 `💅 บริการ: ${serviceName}\n` +
                 `📅 วันที่ใหม่: ${appointmentDate}\n` +
                 `⏰ เวลาใหม่: ${appointmentTime}`;
        break;
        
      case 'paymentReceived':
        message = `💳 ได้รับการชำระเงิน\n` +
                 `👤 ลูกค้า: ${customerName}\n` +
                 `💅 บริการ: ${serviceName}\n` +
                 `💰 จำนวน: ${totalPrice} บาท\n` +
                 `📅 วันที่จอง: ${appointmentDate} ${appointmentTime}`;
        break;
        
      default:
        message = messageText || 'การแจ้งเตือนจากระบบจองคิว';
    }

    return await sendLineMessageToAllAdmins(message);

  } catch (error) {
    console.error('Error sending booking notification:', error);
    return { success: false, error: 'Failed to send booking notification' };
  }
}

/**
 * Send reminder notification to customer
 */
export async function sendReminderNotification(customerLineId, bookingData) {
  try {
    const notificationSettings = await getNotificationSettings();
    
    if (!notificationSettings.enabled || !notificationSettings.reminderNotifications) {
      console.log("Reminder notifications are disabled");
      return { success: true, message: "Reminder notifications disabled" };
    }

    if (!customerLineId) {
      console.log("Customer LINE ID not provided");
      return { success: false, error: "No customer LINE ID" };
    }

    const { serviceName, appointmentDate, appointmentTime, shopName = 'ร้านเสริมสวย' } = bookingData;
    
    const message = `🔔 แจ้งเตือนการนัดหมาย\n\n` +
                   `สวัสดีค่ะ! อีก 1 ชั่วโมงจะถึงเวลานัดหมายของคุณแล้ว\n\n` +
                   `💅 บริการ: ${serviceName}\n` +
                   `📅 วันที่: ${appointmentDate}\n` +
                   `⏰ เวลา: ${appointmentTime}\n` +
                   `🏪 ${shopName}\n\n` +
                   `กรุณามาตรงเวลานะคะ ขอบคุณค่ะ ✨`;

    return await sendLineMessage(customerLineId, message);

  } catch (error) {
    console.error('Error sending reminder notification:', error);
    return { success: false, error: 'Failed to send reminder notification' };
  }
}
