"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendReminderNotification } from '@/app/actions/lineActions';

/**
 * Send reminder notifications to customers 1 hour before their appointment
 * This function should be called by a cron job
 */
export async function sendAppointmentReminders() {
  try {
  // ...existing code...
    
    // Get current time and calculate 1 hour from now
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Format date and time for comparison
    const targetDate = oneHourFromNow.toISOString().split('T')[0]; // YYYY-MM-DD
    const targetHour = oneHourFromNow.getHours();
    const targetTime = `${targetHour.toString().padStart(2, '0')}:00`; // HH:00
    
  // ...existing code...
    
    // Query appointments that are confirmed and scheduled for 1 hour from now
    const appointmentsQuery = db.collection('appointments')
      .where('status', '==', 'confirmed')
      .where('date', '==', targetDate)
      .where('time', '==', targetTime);
    
    const snapshot = await appointmentsQuery.get();
    
    if (snapshot.empty) {
  // ...existing code...
      return { success: true, message: 'No appointments to remind' };
    }
    
  // ...existing code...
    
    const reminderPromises = [];
    
    snapshot.forEach(doc => {
      const appointmentData = doc.data();
      
      // Check if customer has LINE ID
      if (appointmentData.userId) {
        const reminderData = {
          serviceName: appointmentData.serviceInfo?.name || 'บริการ',
          appointmentDate: appointmentData.date,
          appointmentTime: appointmentData.time,
          shopName: 'ร้านเสริมสวย' // You can make this configurable in settings
        };
        
        reminderPromises.push(
          sendReminderNotification(appointmentData.userId, reminderData)
            .then(result => {
              if (result.success) {
                // ...existing code...
                return { appointmentId: doc.id, success: true };
              } else {
                console.error(`Failed to send reminder to ${appointmentData.userId}:`, result.error);
                return { appointmentId: doc.id, success: false, error: result.error };
              }
            })
            .catch(error => {
              console.error(`Error sending reminder for appointment ${doc.id}:`, error);
              return { appointmentId: doc.id, success: false, error: error.message };
            })
        );
      } else {
  // ...existing code...
      }
    });
    
    // Wait for all reminders to be sent
    const results = await Promise.all(reminderPromises);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
  // ...existing code...
    
    return {
      success: true,
      totalAppointments: snapshot.size,
      successCount,
      failureCount,
      results
    };
    
  } catch (error) {
    console.error('Error in sendAppointmentReminders:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

