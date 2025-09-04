"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Award points to customer based on purchase amount
 * @param {string} userId - Customer's LINE User ID
 * @param {number} purchaseAmount - Purchase amount in Thai Baht
 * @returns {Promise<{success: boolean, pointsAwarded?: number, error?: string}>}
 */
export async function awardPointsForPurchase(userId, purchaseAmount) {
  if (!userId || !purchaseAmount || purchaseAmount <= 0) {
    return { success: false, error: 'Invalid parameters' };
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
 * @param {string} userId - Customer's LINE User ID
 * @returns {Promise<{success: boolean, pointsAwarded?: number, error?: string}>}
 */
export async function awardPointsForVisit(userId) {
  if (!userId) {
    return { success: false, error: 'Invalid user ID' };
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
