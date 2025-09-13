"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin';
import { sendAppointmentReminderFlexMessage } from './lineFlexActions';

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

/**
 * Fetches and returns the notification settings object.
 */
async function getNotificationSettings() {
  try {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    
    if (settingsDoc.exists) {
      return settingsDoc.data();
    }
    
    // Default settings if document doesn't exist (fail-safe: disabled)
    return {
      allNotifications: { enabled: false },
      adminNotifications: { enabled: false, newBooking: false, bookingCancelled: false, paymentReceived: false, customerConfirmed: false },
      customerNotifications: { enabled: false, appointmentConfirmed: false, appointmentCancelled: false, appointmentReminder: false, reviewRequest: false, paymentInvoice: false },
    };
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    // Return default disabled settings on error (fail-safe)
    return {
      allNotifications: { enabled: false },
      adminNotifications: { enabled: false, newBooking: false, bookingCancelled: false, paymentReceived: false, customerConfirmed: false },
      customerNotifications: { enabled: false, appointmentConfirmed: false, appointmentCancelled: false, appointmentReminder: false, reviewRequest: false, paymentInvoice: false },
    };
  }
}

/**
 * Sends a push message to a single LINE user, checking customer notification settings first.
 */
export async function sendLineMessage(to, messageText, notificationType) {
  if (!to || !messageText) {
    console.error("Missing 'to' or 'messageText'");
    return { success: false, error: "Missing recipient or message." };
  }
  
  const settings = await getNotificationSettings();
  if (!settings.allNotifications?.enabled || !settings.customerNotifications?.enabled || (notificationType && !settings.customerNotifications[notificationType])) {
  // ...existing code...
      return { success: true, message: "Customer notifications disabled for this type." };
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
 * Sends a multicast message to all registered admins, checking admin notification settings first.
 */
export async function sendLineMessageToAllAdmins(messageText) {
  const settings = await getNotificationSettings();
  if (!settings.allNotifications?.enabled || !settings.adminNotifications?.enabled) {
  // ...existing code...
      return { success: true, message: "Admin notifications disabled." };
  }

  try {
    const adminsQuery = db.collection('admins').where("lineUserId", "!=", null);
    const adminSnapshot = await adminsQuery.get();

    if (adminSnapshot.empty) {
      console.warn("No admins with lineUserId found to notify.");
      return { success: true, message: "No admins to notify." };
    }

    const adminLineIds = adminSnapshot.docs.map(doc => doc.data().lineUserId);

    if (adminLineIds.length > 0) {
      const messageObject = { type: 'text', text: messageText };
      await client.multicast(adminLineIds, [messageObject]);
  // ...existing code...
    }

    return { success: true };

  } catch (error) {
    console.error('Error sending multicast message to admins:', error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}

/**
 * Send booking notification to admins
 */
export async function sendBookingNotification(bookingData, notificationType) {
  const settings = await getNotificationSettings();
  if (!settings.allNotifications?.enabled || !settings.adminNotifications?.enabled || !settings.adminNotifications?.[notificationType]) {
  // ...existing code...
    return { success: true, message: "Notification type disabled for admins." };
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
      
    case 'customerConfirmed':
      message = `✅ ลูกค้ายืนยันนัดหมาย\n` +
               `👤 ลูกค้า: ${customerName}\n` +
               `💅 บริการ: ${serviceName}\n` +
               `📅 วันที่: ${appointmentDate}\n` +
               `⏰ เวลา: ${appointmentTime}`;
      break;
      
    case 'bookingCancelled':
      message = `❌ ยกเลิกการจอง\n` +
               `👤 ลูกค้า: ${customerName}\n` +
               `💅 บริการ: ${serviceName}\n` +
               `📅 วันที่: ${appointmentDate}\n` +
               `⏰ เวลา: ${appointmentTime}`;
      break;
      
    case 'paymentReceived':
      message = `💳 ได้รับการชำระเงิน\n` +
               `👤 ลูกค้า: ${customerName}\n` +
               `💅 บริการ: ${serviceName}\n` +
               `💰 จำนวน: ${totalPrice} บาท\n` +
               `📅 วันที่จอง: ${appointmentDate} ${appointmentTime}`;
      break;
      
    default:
      message = 'การแจ้งเตือนจากระบบจองคิว';
  }

  return await sendLineMessageToAllAdmins(message);
}

/**
 * Send reminder notification to customer
 */
export async function sendReminderNotification(customerLineId, bookingData) {
    return await sendAppointmentReminderFlexMessage(customerLineId, bookingData);
}