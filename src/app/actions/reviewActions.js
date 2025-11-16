// src/app/actions/reviewActions.js

'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendReviewThankYouFlexMessage } from './lineFlexActions'; 

/**
 * Submits a review for a completed appointment.
 * @param {object} reviewData - The review data from the form.
 * @param {string} reviewData.appointmentId - The ID of the appointment being reviewed.
 * @param {string} reviewData.userId - The LINE User ID of the customer.
 * @param {string} reviewData.technicianId - The ID of the technician.
 * @param {number} reviewData.rating - The star rating (1-5).
 * @param {string} reviewData.comment - The customer's comment.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitReview(reviewData) {
  const { appointmentId, userId, technicianId, rating, comment } = reviewData;

  if (!appointmentId || !userId || !rating) {
    return { success: false, error: 'ข้อมูลที่จำเป็นไม่ครบถ้วน' };
  }

  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const reviewRef = db.collection('reviews').doc(appointmentId); // Use appointmentId as reviewId for simplicity

  try {
    // Get point settings first
    const pointSettingsRef = db.collection('settings').doc('points');
    const pointSettingsDoc = await pointSettingsRef.get();
    
    let pointsToAward = 0;
    if (pointSettingsDoc.exists) {
      const pointSettings = pointSettingsDoc.data();
      if (pointSettings.enableReviewPoints) {
        pointsToAward = pointSettings.reviewPoints || 5;
      }
    } else {
      // Default: give 5 points for review if no settings found
      pointsToAward = 5;
    }

    await db.runTransaction(async (transaction) => {
      // Read all docs first
      const appointmentDoc = await transaction.get(appointmentRef);
      if (!appointmentDoc.exists) {
        throw new Error('ไม่พบข้อมูลการนัดหมายนี้');
      }
      const appointmentData = appointmentDoc.data();
      if (!appointmentData.userId) {
        throw new Error('ข้อมูลการนัดหมายนี้ไม่มี LINE User ID กรุณาติดต่อแอดมิน');
      }
      if (appointmentData.userId !== userId) {
        throw new Error('คุณไม่มีสิทธิ์รีวิวการนัดหมายนี้ กรุณา login ด้วย LINE ที่ใช้จอง');
      }
      if (appointmentData.reviewInfo?.submitted) {
        throw new Error('คุณได้รีวิวการนัดหมายนี้ไปแล้ว');
      }
      if (!appointmentData.customerInfo) {
        throw new Error('ข้อมูลลูกค้าในนัดหมายไม่สมบูรณ์ กรุณาติดต่อแอดมิน');
      }

      let customerDoc = null;
      let currentPoints = 0;
      const customerRef = db.collection('customers').doc(userId);
      if (pointsToAward > 0) {
        customerDoc = await transaction.get(customerRef);
        if (customerDoc.exists) {
          currentPoints = customerDoc.data().points || 0;
        }
      }

      // All reads done, now do writes
      transaction.set(reviewRef, {
        appointmentId,
        userId,
        technicianId: technicianId || null,
        customerName: appointmentData.customerInfo.fullName || appointmentData.customerInfo.name,
        rating: Number(rating),
        comment: comment || '',
        pointsAwarded: pointsToAward,
        createdAt: FieldValue.serverTimestamp(),
      });

      transaction.update(appointmentRef, {
        'reviewInfo.submitted': true,
        'reviewInfo.rating': Number(rating),
        'reviewInfo.pointsAwarded': pointsToAward,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (pointsToAward > 0) {
        if (customerDoc && customerDoc.exists) {
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
      }
    });

    // Send thank you message with points info
    await sendReviewThankYouFlexMessage(userId, pointsToAward);

    return { success: true };
  } catch (error) {
    console.error("Error submitting review:", error);
    return { success: false, error: error.message };
  }
}

