'use server';

import { google } from 'googleapis';
import { db } from '@/app/lib/firebaseAdmin';
import { getShopProfile } from './settingsActions';

// Function to get Google API authentication
const getGoogleAuth = () => {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    console.log('[DEBUG] GOOGLE_PRIVATE_KEY exists:', !!privateKey);
    console.log('[DEBUG] GOOGLE_CLIENT_EMAIL:', clientEmail);
    if (!privateKey || !clientEmail) {
        throw new Error("Missing Google authentication credentials in .env.local");
    }

    return new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });
};

// Function to create or update a calendar event
export async function createOrUpdateCalendarEvent(appointmentId, appointmentData) {
    try {
        console.log('[DEBUG] createOrUpdateCalendarEvent called with appointmentId:', appointmentId);
        console.log('[DEBUG] appointmentData:', JSON.stringify(appointmentData, null, 2));
        const settingsRef = db.collection('settings').doc('calendar');
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.data();
        console.log('[DEBUG] Calendar settings:', settings);

        if (!settings?.enabled || !settings?.calendarId) {
            console.log("[DEBUG] Calendar sync is disabled. Skipping event creation.");
            return { success: true, message: "Calendar sync disabled." };
        }

        const startTime = new Date(appointmentData.appointmentInfo.dateTime);
        const duration = Number(appointmentData.appointmentInfo.duration);
        console.log('[DEBUG] startTime:', startTime.toISOString());
        console.log('[DEBUG] duration (minutes):', duration);
        if (isNaN(duration)) {
            console.error('[DEBUG] Invalid duration value:', appointmentData.appointmentInfo.duration);
            throw new Error(`Invalid duration value for service: ${appointmentData.serviceInfo.name}`);
        }
        const endTime = new Date(startTime.getTime() + duration * 60000);
        console.log('[DEBUG] endTime:', endTime.toISOString());

        const { profile } = await getShopProfile();
        console.log('[DEBUG] Shop profile:', profile);
        const currencySymbol = profile.currencySymbol || 'บาท';

        const event = {
            summary: `${appointmentData.serviceInfo.name} - ${appointmentData.customerInfo.fullName}`,
            description: `ลูกค้า: ${appointmentData.customerInfo.fullName}\nเบอร์โทร: ${appointmentData.customerInfo.phone}\nบริการ: ${appointmentData.serviceInfo.name}\nราคา: ${appointmentData.paymentInfo.totalPrice} ${currencySymbol}\nสถานะ: ${appointmentData.status}`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'Asia/Bangkok',
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'Asia/Bangkok',
            },
        };
        console.log('[DEBUG] Google Calendar event object:', event);

        const auth = getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth });

        const appointmentRef = db.collection('appointments').doc(appointmentId);
        const appointmentSnap = await appointmentRef.get();
        const existingEventId = appointmentSnap.data()?.googleCalendarEventId;
        console.log('[DEBUG] existingEventId:', existingEventId);

        let newEvent;
        if (existingEventId) {
            console.log('[DEBUG] Updating existing calendar event...');
            newEvent = await calendar.events.update({
                calendarId: settings.calendarId,
                eventId: existingEventId,
                resource: event,
            });
            console.log(`[DEBUG] Event updated: ${newEvent.data.htmlLink}`);
        } else {
            console.log('[DEBUG] Creating new calendar event...');
            newEvent = await calendar.events.insert({
                calendarId: settings.calendarId,
                resource: event,
            });
            console.log(`[DEBUG] Event created: ${newEvent.data.htmlLink}`);
        }

        await appointmentRef.update({
            googleCalendarEventId: newEvent.data.id
        });
        console.log('[DEBUG] googleCalendarEventId updated in Firestore:', newEvent.data.id);

        return { success: true, eventId: newEvent.data.id };

    } catch (error) {
        console.error("[DEBUG] Error creating/updating calendar event:", error);
        return { success: false, error: error.message };
    }
}

// Function to delete a calendar event
export async function deleteCalendarEvent(eventId) {
    try {
        const settingsRef = db.collection('settings').doc('calendar');
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.data();

        if (!settings?.enabled || !settings?.calendarId || !eventId) {
            console.log("Cannot delete calendar event. Sync disabled, missing calendarId, or missing eventId.");
            return { success: true, message: "Deletion skipped." };
        }

        const auth = getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
            calendarId: settings.calendarId,
            eventId: eventId,
        });

        console.log(`Event with ID: ${eventId} deleted successfully.`);
        return { success: true };
    } catch (error) {
        if (error.code === 410 || error.message.includes('Not Found')) {
            console.log(`Event with ID: ${eventId} was already deleted or not found. Continuing.`);
            return { success: true, message: "Event already deleted." };
        }
        console.error("Error deleting calendar event:", error.message);
        return { success: false, error: error.message };
    }
}