"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin';
import { sendAppointmentReminderFlexMessage } from './lineFlexActions';
import axios from 'axios';
import { sendTelegramMessageToAdmin } from './telegramActions';
import { getShopProfile } from './settingsActions';


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
    
    return {
      admin: {},
      customer: {}
    };
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return {
      admin: {},
      customer: {}
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
  if (!settings.customer?.[notificationType]) {
      console.log(`Customer notification for type '${notificationType}' is disabled.`);
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
export async function sendLineMessageToAllAdmins(messageText, notificationType) {
  const settings = await getNotificationSettings();
  if (!settings.admin?.line?.enabled || (notificationType && !settings.admin?.line?.[notificationType])) {
      console.log(`Admin LINE notification for type '${notificationType}' is disabled.`);
      return { success: true, message: "Admin notifications disabled for this type." };
  }

  try {
    const adminsQuery = db.collection('admins').where("lineUserId", "!=", null);
    const adminSnapshot = await adminsQuery.get();

    if (adminSnapshot.empty) {
      console.warn("No admins with lineUserId found to notify.");
      return { success: true, message: "No admins to notify." };
    }

    const adminLineIds = adminSnapshot.docs.map(doc => doc.data().lineUserId).filter(id => id);

    if (adminLineIds.length > 0) {
      const messageObject = { type: 'text', text: messageText };
      await client.multicast(adminLineIds, [messageObject]);
    }

    return { success: true };

  } catch (error) {
    console.error('Error sending multicast message to admins:', error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}

/**
 * Send booking notification to admins via LINE Notify and LINE Bot
 */
async function createMessage(details, type) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = details;
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';

    switch (type) {
        case 'newBooking':
            return `
✅ จองคิวใหม่
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.
ยอดรวม: ${totalPrice.toLocaleString()} ${currencySymbol}`;
        case 'paymentReceived':
            return `
💰 ได้รับชำระเงิน
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.
ยอดชำระ: ${totalPrice.toLocaleString()} ${currencySymbol}`;
        case 'customerConfirmed':
            return `
👍 ลูกค้ายืนยันนัดหมาย
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.`;
        default:
            return `
🔔 การแจ้งเตือนใหม่
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.`;
    }
}

export async function sendBookingNotification(details, type) {
    const settings = await getNotificationSettings();

    const isAdminLineEnabled = settings.admin?.line?.enabled;
    const isNotificationTypeEnabled = settings.admin?.line?.[type];

    if (!isAdminLineEnabled || !isNotificationTypeEnabled) {
        console.log(`Admin LINE notification for type '${type}' is disabled.`);
        if (settings.admin?.telegram?.enabled) {
            const telegramMessage = `[Fallback from LINE] ${await createMessage(details, type)}`;
            await sendTelegramMessageToAdmin(telegramMessage);
        }
        return { success: true, message: `Admin notification for ${type} disabled.` };
    }

    const message = await createMessage(details, type);
    
    if (settings.line?.notifyToken) {
        try {
            await axios.post('https://notify-api.line.me/api/notify', `message=${message}`, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${settings.line.notifyToken}`,
                },
            });
        } catch (error) {
            console.error('Error sending LINE Notify message:', error.response ? error.response.data : error.message);
            const fallbackMessage = `🚨 LINE Notify Error for ${type}: ${error.message}`;
            await sendTelegramMessageToAdmin(fallbackMessage);
        }
    }

    await sendLineMessageToAllAdmins(message, type);

    return { success: true };
}

export async function sendReminderNotification(customerLineId, bookingData) {
    return await sendAppointmentReminderFlexMessage(customerLineId, bookingData);
}
