// src/app/actions/vehicleActions.js
"use server";

import { db } from '@/app/lib/firebaseAdmin'; 
import { revalidatePath } from 'next/cache';
import { fetchBookingSettings } from './settingsActions'; 

/**
 * (ฟังก์ชันเดิม - ไม่มีการเปลี่ยนแปลง)
 */
export async function addVehicle(formData) {
  try {
    const vehicleData = {
      plateNumber: formData.get('plateNumber'),
      brand: formData.get('brand'),
      model: formData.get('model'),
      type: formData.get('type'),
      color: formData.get('color'),
      status: 'available',
      createdAt: db.FieldValue.serverTimestamp(),
    };
    
    const vehicleRef = await db.collection('vehicles').add(vehicleData);
    
    console.log('✅ Vehicle added to Firestore with ID: ', vehicleRef.id);

    revalidatePath('/admin/vehicles'); 

    return { success: true, message: `เพิ่มรถสำเร็จ ID: ${vehicleRef.id}` };

  } catch (error) {
    console.error("🔥 Error adding vehicle to Firestore:", error);
    return { success: false, error: error.message };
  }
}

/**
 * (ฟังก์ชันที่แก้ไขชื่อให้ถูกต้อง)
 * Fetches all vehicles and their active booking schedules, now including the buffer time.
 * @returns {Promise<{vehicles: Array, bookings: Object}|{error: string, details: string}>}
 */
export async function fetchAllVehiclesWithSchedules() { // [!code focus]
  try {
    const settingsResult = await fetchBookingSettings();
    if (!settingsResult.success) {
        console.warn("Could not fetch booking settings, using default buffer.");
    }
    const bufferHours = settingsResult.settings?.bufferHours || 0;

    const vehiclesRef = db.collection('vehicles');
    const vehiclesQuery = vehiclesRef.where('status', 'in', ['available', 'in_use']).orderBy('brand').orderBy('model');
    const vehiclesSnapshot = await vehiclesQuery.get();
    const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const vehicleIds = vehicles.map(v => v.id);
    if (vehicleIds.length === 0) {
      return { vehicles: [], bookings: {} };
    }

    const bookingsRef = db.collection('bookings');
    const bookingsQuery = bookingsRef
      .where('vehicleId', 'in', vehicleIds)
      .where('status', 'in', ['awaiting_pickup', 'rented']);
      
    const bookingsSnapshot = await bookingsQuery.get();

    const bookingsMap = {};
    bookingsSnapshot.forEach(doc => {
      const booking = doc.data();
      if (!bookingsMap[booking.vehicleId]) {
        bookingsMap[booking.vehicleId] = [];
      }
      
      const startTime = booking.pickupInfo.dateTime.toDate();
      const endTime = booking.returnInfo.dateTime.toDate();

      if (bufferHours > 0) {
          endTime.setHours(endTime.getHours() + bufferHours);
      }

      bookingsMap[booking.vehicleId].push({
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      });
    });

    return {
      vehicles: JSON.parse(JSON.stringify(vehicles)),
      bookings: bookingsMap,
    };

  } catch (error) {
    console.error("Error fetching vehicles with schedules:", error);
    return { error: "Failed to fetch vehicle data.", details: error.message };
  }
}