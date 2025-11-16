import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebaseAdmin';

export async function GET(request) {
    try {
        console.log('Testing: Checking appointments data...');

        // Get today's date in Thailand timezone
        const today = new Date();
        const thailandTime = new Date(today.getTime() + (7 * 60 * 60 * 1000));
        thailandTime.setHours(0, 0, 0, 0);
        const todayString = thailandTime.toISOString().split('T')[0]; // YYYY-MM-DD format

        console.log(`System time: ${today.toISOString()}`);
        console.log(`Thailand time: ${thailandTime.toISOString()}`);
        console.log(`Testing for appointments on ${todayString}`);

        // Query all appointments for today
        const appointmentsSnapshot = await db.collection('appointments')
            .where('date', '==', todayString)
            .get();

        console.log(`Found ${appointmentsSnapshot.size} appointments for ${todayString}`);

        const appointments = [];
        appointmentsSnapshot.forEach(doc => {
            const data = doc.data();
            appointments.push({
                id: doc.id,
                date: data.date,
                time: data.time,
                status: data.status,
                userId: data.userId,
                customerInfo: data.customerInfo,
                serviceInfo: data.serviceInfo
            });
        });

        // Also check all appointments (without date filter) to see what dates exist
        const allAppointmentsSnapshot = await db.collection('appointments').limit(20).get();
        console.log(`Total appointments in database: ${allAppointmentsSnapshot.size} (showing first 20)`);

        const allAppointments = [];
        const uniqueDates = new Set();
        allAppointmentsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.date) uniqueDates.add(data.date);
            allAppointments.push({
                id: doc.id,
                date: data.date,
                time: data.time,
                status: data.status,
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || 'N/A'
            });
        });

        // Try alternative date formats
        const alternativeFormats = [
            today.toISOString().split('T')[0], // System date
            new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD local
            new Date().toLocaleDateString('th-TH-u-ca-iso8601').split(' ')[0] // Thai locale
        ];

        const alternativeResults = {};
        for (const dateFormat of alternativeFormats) {
            try {
                const snapshot = await db.collection('appointments')
                    .where('date', '==', dateFormat)
                    .get();
                alternativeResults[dateFormat] = snapshot.size;
            } catch (error) {
                alternativeResults[dateFormat] = `Error: ${error.message}`;
            }
        }

        return NextResponse.json({ 
            success: true,
            systemTime: today.toISOString(),
            thailandTime: thailandTime.toISOString(),
            todayString,
            todayAppointments: appointments,
            todayCount: appointments.length,
            sampleAppointments: allAppointments,
            totalSample: allAppointments.length,
            uniqueDatesInDb: Array.from(uniqueDates).sort(),
            alternativeFormats: alternativeResults
        });

    } catch (error) {
        console.error("Test appointments error:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}

