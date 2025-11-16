"use server";

import { db } from '@/app/lib/firebaseAdmin'; 
import { revalidatePath } from 'next/cache';
import { fetchBookingSettings } from './settingsActions'; 

/**
 * Adds a new service to Firestore.
 * @param {object} serviceData - The data for the new service.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function addService(serviceData) {
  try {
    const serviceRef = await db.collection('services').add({
      ...serviceData,
      status: 'available',
      createdAt: db.FieldValue.serverTimestamp(),
    });
    
  // ...existing code...

    revalidatePath('/admin/services'); 

    return { success: true, message: `เพิ่มบริการสำเร็จ ID: ${serviceRef.id}` };

  } catch (error) {
    console.error("🔥 Error adding service to Firestore:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all services and their active appointment schedules.
 * @returns {Promise<{services: Array, appointments: Object}|{error: string, details: string}>}
 */
export async function fetchAllServicesWithSchedules() {
  try {
    const servicesRef = db.collection('services');
    const servicesQuery = servicesRef.where('status', 'in', ['available', 'unavailable']).orderBy('serviceName');
    const servicesSnapshot = await servicesQuery.get();
    const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const serviceIds = services.map(v => v.id);
    if (serviceIds.length === 0) {
      return { services: [], appointments: {} };
    }

    const appointmentsRef = db.collection('appointments');
    const appointmentsQuery = appointmentsRef
      .where('serviceId', 'in', serviceIds)
      .where('status', 'in', ['awaiting_confirmation', 'confirmed', 'in_progress']);
      
    const appointmentsSnapshot = await appointmentsQuery.get();

    const appointmentsMap = {};
    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      if (!appointmentsMap[appointment.serviceId]) {
        appointmentsMap[appointment.serviceId] = [];
      }
      
      const startTime = appointment.appointmentInfo.dateTime.toDate();
      const endTime = new Date(startTime.getTime() + (appointment.appointmentInfo.duration * 60000));

      appointmentsMap[appointment.serviceId].push({
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      });
    });

    return {
      services: JSON.parse(JSON.stringify(services)),
      appointments: appointmentsMap,
    };

  } catch (error) {
    console.error("Error fetching services with schedules:", error);
    return { error: "Failed to fetch service data.", details: error.message };
  }
}

