'use server';

import { google } from 'googleapis';
import { db } from '@/app/lib/firebaseAdmin';

// Function to get Google API authentication
const getGoogleAuth = () => {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey || !process.env.GOOGLE_CLIENT_EMAIL) {
        throw new Error("Missing Google authentication credentials in .env.local");
    }

    return new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });
};

// Function to create or update a calendar event
export async function createOrUpdateCalendarEvent(appointmentId, appointmentData) {
    try {
        const settingsRef = db.collection('settings').doc('calendar');
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.data();

        if (!settings?.enabled || !settings?.calendarId) {
            console.log("Calendar sync is disabled. Skipping event creation.");
            return { success: true, message: "Calendar sync disabled." };
        }
        
        // --- FIX: START ---
        // ใช้ dateTime ที่สร้างจาก client ซึ่งมี timezone ที่ถูกต้องแล้ว
        const startTime = new Date(appointmentData.appointmentInfo.dateTime);
        
        // ใช้ total duration ที่รวมบริการเสริมแล้วจาก appointmentInfo
        const duration = Number(appointmentData.appointmentInfo.duration);
        if (isNaN(duration)) {
             throw new Error(`Invalid duration value for service: ${appointmentData.serviceInfo.name}`);
        }
        const endTime = new Date(startTime.getTime() + duration * 60000);
        // --- FIX: END ---

        const event = {
            summary: `${appointmentData.serviceInfo.name} - ${appointmentData.customerInfo.fullName}`,
            description: `ลูกค้า: ${appointmentData.customerInfo.fullName}\nเบอร์โทร: ${appointmentData.customerInfo.phone}\nบริการ: ${appointmentData.serviceInfo.name}\nราคา: ${appointmentData.paymentInfo.totalPrice} บาท\nสถานะ: ${appointmentData.status}`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'Asia/Bangkok',
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'Asia/Bangkok',
            },
        };

        const auth = getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth });
        
        const appointmentRef = db.collection('appointments').doc(appointmentId);
        const appointmentSnap = await appointmentRef.get();
        const existingEventId = appointmentSnap.data()?.googleCalendarEventId;

        let newEvent;
        if (existingEventId) {
            newEvent = await calendar.events.update({
                calendarId: settings.calendarId,
                eventId: existingEventId,
                resource: event,
            });
            console.log(`Event updated: ${newEvent.data.htmlLink}`);
        } else {
            newEvent = await calendar.events.insert({
                calendarId: settings.calendarId,
                resource: event,
            });
            console.log(`Event created: ${newEvent.data.htmlLink}`);
        }
        
        await appointmentRef.update({
            googleCalendarEventId: newEvent.data.id
        });

        return { success: true, eventId: newEvent.data.id };

    } catch (error) {
        console.error("Error creating/updating calendar event:", error.message);
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
        // ถ้า Event ถูกลบไปแล้วใน Google Calendar ให้ถือว่าสำเร็จ
        if (error.code === 410 || error.message.includes('Not Found')) {
            console.log(`Event with ID: ${eventId} was already deleted or not found. Continuing.`);
            return { success: true, message: "Event already deleted." };
        }
        console.error("Error deleting calendar event:", error.message);
        return { success: false, error: error.message };
    }
}