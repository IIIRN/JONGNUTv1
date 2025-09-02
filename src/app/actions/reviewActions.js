'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendLineMessage } from './lineActions'; 

/**
 * Submits a review for a completed appointment.
 * @param {object} reviewData - The review data from the form.
 * @param {string} reviewData.appointmentId - The ID of the appointment being reviewed.
 * @param {string} reviewData.userId - The LINE User ID of the customer.
 * @param {string} reviewData.beauticianId - The ID of the beautician.
 * @param {number} reviewData.rating - The star rating (1-5).
 * @param {string} reviewData.comment - The customer's comment.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitReview(reviewData) {
  const { appointmentId, userId, beauticianId, rating, comment } = reviewData;

  if (!appointmentId || !userId || !rating) {
    return { success: false, error: 'ข้อมูลที่จำเป็นไม่ครบถ้วน' };
  }

  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const reviewRef = db.collection('reviews').doc(appointmentId); // Use appointmentId as reviewId for simplicity

  try {
    await db.runTransaction(async (transaction) => {
      const appointmentDoc = await transaction.get(appointmentRef);
      if (!appointmentDoc.exists) {
        throw new Error('ไม่พบข้อมูลการนัดหมายนี้');
      }
      
      const appointmentData = appointmentDoc.data();
      if (appointmentData.userId !== userId) {
          throw new Error('คุณไม่มีสิทธิ์รีวิวการนัดหมายนี้');
      }
      if (appointmentData.reviewInfo?.submitted) {
          throw new Error('คุณได้รีวิวการนัดหมายนี้ไปแล้ว');
      }

      // Save the new review
      transaction.set(reviewRef, {
        appointmentId,
        userId,
        beauticianId: beauticianId || null,
        customerName: appointmentData.customerInfo.name,
        rating: Number(rating),
        comment: comment || '',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Mark the appointment as reviewed
      transaction.update(appointmentRef, {
        'reviewInfo.submitted': true,
        'reviewInfo.rating': Number(rating),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const thankYouMessage = 'ขอบคุณสำหรับรีวิวค่ะ! ความคิดเห็นของคุณมีความสำคัญอย่างยิ่งในการพัฒนาบริการของเราให้ดียิ่งขึ้นไปค่ะ';
    await sendLineMessage(userId, thankYouMessage);

    return { success: true };
  } catch (error) {
    console.error("Error submitting review:", error);
    return { success: false, error: error.message };
  }
}