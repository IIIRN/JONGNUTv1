"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Award points to customer based on purchase amount
 * @param {string} userId - Customer's LINE User ID (if available)
 * @param {number} purchaseAmount - Purchase amount in Thai Baht
 * @returns {Promise<{success: boolean, pointsAwarded?: number, error?: string}>}
 */
export async function awardPointsForPurchase(userId, purchaseAmount) {
  if (!userId) {
    console.log('No userId provided for points award - customer may not have LINE ID');
    return { success: false, error: 'No userId provided - customer may not have LINE ID' };
  }
  
  if (!purchaseAmount || purchaseAmount <= 0) {
    return { success: false, error: 'Invalid purchase amount' };
  }

  try {
    // Get point settings
    const pointSettingsRef = db.collection('settings').doc('points');
    const pointSettingsDoc = await pointSettingsRef.get();
    
    let pointsToAward = 0;
    if (pointSettingsDoc.exists()) {
      const pointSettings = pointSettingsDoc.data();
      if (pointSettings.enablePurchasePoints) {
        const pointsPerCurrency = pointSettings.pointsPerCurrency || 100;
        pointsToAward = Math.floor(purchaseAmount / pointsPerCurrency);
      }
    }

    if (pointsToAward <= 0) {
      return { success: true, pointsAwarded: 0 };
    }

    // Award points
    const customerRef = db.collection('customers').doc(userId);
    await db.runTransaction(async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      
      if (customerDoc.exists()) {
        const currentPoints = customerDoc.data().points || 0;
        transaction.update(customerRef, {
          points: currentPoints + pointsToAward,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(customerRef, {
          points: pointsToAward,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true, pointsAwarded: pointsToAward };
  } catch (error) {
    console.error("Error awarding points for purchase:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Award points to customer for visit
 * @param {string} userId - Customer's LINE User ID (if available)
 * @returns {Promise<{success: boolean, pointsAwarded?: number, error?: string}>}
 */
export async function awardPointsForVisit(userId) {
  if (!userId) {
    console.log('No userId provided for visit points - customer may not have LINE ID');
    return { success: false, error: 'No userId provided - customer may not have LINE ID' };
  }

  try {
    // Get point settings
    const pointSettingsRef = db.collection('settings').doc('points');
    const pointSettingsDoc = await pointSettingsRef.get();
    
    let pointsToAward = 0;
    if (pointSettingsDoc.exists()) {
      const pointSettings = pointSettingsDoc.data();
      if (pointSettings.enableVisitPoints) {
        pointsToAward = pointSettings.pointsPerVisit || 1;
      }
    }

    if (pointsToAward <= 0) {
      return { success: true, pointsAwarded: 0 };
    }

    // Award points
    const customerRef = db.collection('customers').doc(userId);
    await db.runTransaction(async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      
      if (customerDoc.exists()) {
        const currentPoints = customerDoc.data().points || 0;
        transaction.update(customerRef, {
          points: currentPoints + pointsToAward,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(customerRef, {
          points: pointsToAward,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true, pointsAwarded: pointsToAward };
  } catch (error) {
    console.error("Error awarding points for visit:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current point settings
 * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
 */
export async function getPointSettings() {
  try {
    const pointSettingsRef = db.collection('settings').doc('points');
    const pointSettingsDoc = await pointSettingsRef.get();
    
    if (pointSettingsDoc.exists()) {
      return { success: true, settings: pointSettingsDoc.data() };
    }
    
    // Return default settings
    return { 
      success: true, 
      settings: { 
        reviewPoints: 5, 
        pointsPerCurrency: 100, 
        pointsPerVisit: 1,
        enableReviewPoints: true,
        enablePurchasePoints: false,
        enableVisitPoints: false
      } 
    };
  } catch (error) {
    console.error("Error getting point settings:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Award points to customer by phone number (for customers without LINE ID)
 * @param {string} phoneNumber - Customer's phone number
 * @param {number} purchaseAmount - Purchase amount in Thai Baht
 * @param {string} appointmentId - Appointment ID for tracking
 * @returns {Promise<{success: boolean, pointsAwarded?: number, error?: string}>}
 */
export async function awardPointsByPhone(phoneNumber, purchaseAmount, appointmentId) {
  if (!phoneNumber) {
    return { success: false, error: 'Phone number is required' };
  }
  
  if (!purchaseAmount || purchaseAmount <= 0) {
    return { success: false, error: 'Invalid purchase amount' };
  }

  try {
    // Get point settings
    const pointSettingsRef = db.collection('settings').doc('points');
    const pointSettingsDoc = await pointSettingsRef.get();
    
    let pointsToAward = 0;
    if (pointSettingsDoc.exists()) {
      const pointSettings = pointSettingsDoc.data();
      if (pointSettings.enablePurchasePoints) {
        const pointsPerCurrency = pointSettings.pointsPerCurrency || 100;
        pointsToAward = Math.floor(purchaseAmount / pointsPerCurrency);
      }
      
      // Add visit points if enabled
      if (pointSettings.enableVisitPoints) {
        pointsToAward += pointSettings.pointsPerVisit || 1;
      }
    }

    if (pointsToAward <= 0) {
      return { success: true, pointsAwarded: 0 };
    }

    // Use phone number as document ID for customers without LINE ID
    const customerRef = db.collection('customers_by_phone').doc(phoneNumber);
    
    await db.runTransaction(async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      
      if (customerDoc.exists()) {
        const currentPoints = customerDoc.data().points || 0;
        transaction.update(customerRef, {
          points: currentPoints + pointsToAward,
          lastAppointmentId: appointmentId,
          lastPointsAwarded: pointsToAward,
          lastPointsDate: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(customerRef, {
          phoneNumber: phoneNumber,
          points: pointsToAward,
          lastAppointmentId: appointmentId,
          lastPointsAwarded: pointsToAward,
          lastPointsDate: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          hasLineId: false,
          notificationNote: 'Customer without LINE ID - consider manual contact for point notifications'
        });
      }
    });

    // Log for admin tracking
    console.log(`Points awarded to customer with phone ${phoneNumber}: ${pointsToAward} points (No LINE ID)`);
    
    return { 
      success: true, 
      pointsAwarded: pointsToAward,
      message: 'Points awarded to phone-based customer record'
    };
  } catch (error) {
    console.error("Error awarding points by phone:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get points for customer by phone number (for customers without LINE ID)
 * @param {string} phoneNumber - Customer's phone number
 * @returns {Promise<{success: boolean, points?: number, customerInfo?: object, error?: string}>}
 */
export async function getPointsByPhone(phoneNumber) {
  if (!phoneNumber) {
    return { success: false, error: 'Phone number is required' };
  }

  try {
    const customerRef = db.collection('customers_by_phone').doc(phoneNumber);
    const customerDoc = await customerRef.get();
    
    if (customerDoc.exists()) {
      const customerData = customerDoc.data();
      return { 
        success: true, 
        points: customerData.points || 0,
        customerInfo: {
          phoneNumber: customerData.phoneNumber,
          lastAppointmentId: customerData.lastAppointmentId,
          lastPointsAwarded: customerData.lastPointsAwarded,
          lastPointsDate: customerData.lastPointsDate,
          hasLineId: false,
          createdAt: customerData.createdAt,
          updatedAt: customerData.updatedAt
        }
      };
    }
    
    return { 
      success: true, 
      points: 0,
      customerInfo: null,
      message: 'No points record found for this phone number'
    };
  } catch (error) {
    console.error("Error getting points by phone:", error);
    return { success: false, error: error.message };
  }
}
