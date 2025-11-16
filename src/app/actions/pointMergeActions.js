"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Merge points from phone-based record to LINE-based record when customer connects LINE
 * @param {string} userId - Customer's LINE User ID
 * @param {string} phoneNumber - Customer's phone number
 * @returns {Promise<{success: boolean, mergedPoints?: number, message?: string, error?: string}>}
 */
export async function mergePointsFromPhone(userId, phoneNumber) {
  if (!userId || !phoneNumber) {
    return { success: false, error: 'LINE User ID และเบอร์โทรศัพท์จำเป็นต้องระบุ' };
  }

  try {
    // ดึงข้อมูลคะแนนจากระบบเบอร์โทร
    const phoneCustomerRef = db.collection('customers_by_phone').doc(phoneNumber);
    const phoneCustomerDoc = await phoneCustomerRef.get();

    if (!phoneCustomerDoc.exists) {
      return { 
        success: true, 
        mergedPoints: 0,
        message: 'ไม่พบคะแนนสะสมในระบบเบอร์โทร'
      };
    }

    const phoneCustomerData = phoneCustomerDoc.data();
    const pointsToMerge = phoneCustomerData.points || 0;

    if (pointsToMerge === 0) {
      return { 
        success: true, 
        mergedPoints: 0,
        message: 'ไม่มีคะแนนในระบบเบอร์โทรที่ต้องรวม'
      };
    }

    // รวมคะแนนในระบบ LINE
    await db.runTransaction(async (transaction) => {
      const lineCustomerRef = db.collection('customers').doc(userId);
      const lineCustomerDoc = await transaction.get(lineCustomerRef);

      let currentPoints = 0;
      if (lineCustomerDoc.exists) {
        currentPoints = lineCustomerDoc.data().points || 0;
        
        transaction.update(lineCustomerRef, {
          points: currentPoints + pointsToMerge,
          phoneNumber: phoneNumber,
          mergedFromPhone: true,
          mergedPoints: pointsToMerge,
          mergedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(lineCustomerRef, {
          points: pointsToMerge,
          phoneNumber: phoneNumber,
          mergedFromPhone: true,
          mergedPoints: pointsToMerge,
          mergedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // อัพเดทข้อมูลในระบบเบอร์โทรว่าได้รวมแล้ว
      transaction.update(phoneCustomerRef, {
        mergedToLineId: userId,
        mergedAt: FieldValue.serverTimestamp(),
        pointsAfterMerge: 0, // เซ็ต 0 หลังรวม
        originalPoints: pointsToMerge, // เก็บคะแนนเดิมไว้เป็นประวัติ
        status: 'merged'
      });

      // สร้างประวัติการรวมคะแนน
      const mergeHistoryRef = db.collection('pointMergeHistory').doc();
      transaction.set(mergeHistoryRef, {
        userId: userId,
        phoneNumber: phoneNumber,
        mergedPoints: pointsToMerge,
        originalLinePoints: currentPoints,
        newTotalPoints: currentPoints + pointsToMerge,
        mergedAt: FieldValue.serverTimestamp(),
        mergeType: 'phone_to_line'
      });
    });

    console.log(`Successfully merged ${pointsToMerge} points from phone ${phoneNumber} to LINE ID ${userId}`);

    return { 
      success: true, 
      mergedPoints: pointsToMerge,
      message: `รวมคะแนน ${pointsToMerge} คะแนนจากระบบเบอร์โทรเรียบร้อยแล้ว`
    };

  } catch (error) {
    console.error("Error merging points from phone:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if phone number has points that can be merged
 * @param {string} phoneNumber - Customer's phone number
 * @returns {Promise<{success: boolean, hasPoints?: boolean, points?: number, error?: string}>}
 */
export async function checkPhonePointsForMerge(phoneNumber) {
  if (!phoneNumber) {
    return { success: false, error: 'เบอร์โทรศัพท์จำเป็นต้องระบุ' };
  }

  try {
    const phoneCustomerRef = db.collection('customers_by_phone').doc(phoneNumber);
    const phoneCustomerDoc = await phoneCustomerRef.get();

    if (!phoneCustomerDoc.exists) {
      return { 
        success: true, 
        hasPoints: false, 
        points: 0 
      };
    }

    const phoneCustomerData = phoneCustomerDoc.data();
    
    // ตรวจสอบว่าถูกรวมไปแล้วหรือยัง
    if (phoneCustomerData.status === 'merged') {
      return { 
        success: true, 
        hasPoints: false, 
        points: 0,
        message: 'คะแนนถูกรวมไปแล้ว'
      };
    }

    const points = phoneCustomerData.points || 0;

    return { 
      success: true, 
      hasPoints: points > 0, 
      points: points 
    };

  } catch (error) {
    console.error("Error checking phone points:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get merge history for admin dashboard
 * @param {number} limit - Number of records to fetch (default: 50)
 * @returns {Promise<{success: boolean, history?: Array, error?: string}>}
 */
export async function getMergeHistory(limit = 50) {
  try {
    const mergeHistoryRef = db.collection('pointMergeHistory')
      .orderBy('mergedAt', 'desc')
      .limit(limit);
    
    const snapshot = await mergeHistoryRef.get();
    
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { 
      success: true, 
      history: history 
    };

  } catch (error) {
    console.error("Error getting merge history:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get merge statistics
 * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
 */
export async function getMergeStatistics() {
  try {
    const mergeHistoryRef = db.collection('pointMergeHistory');
    const snapshot = await mergeHistoryRef.get();
    
    const totalMerges = snapshot.size;
    let totalPointsMerged = 0;
    let thisMonth = 0;
    let thisWeek = 0;
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const mergedPoints = data.mergedPoints || 0;
      totalPointsMerged += mergedPoints;

      if (data.mergedAt) {
        const mergedDate = data.mergedAt.toDate();
        
        if (mergedDate >= firstDayOfMonth) {
          thisMonth++;
        }
        
        if (mergedDate >= firstDayOfWeek) {
          thisWeek++;
        }
      }
    });

    return {
      success: true,
      stats: {
        totalMerges,
        totalPointsMerged,
        averagePointsPerMerge: totalMerges > 0 ? Math.round(totalPointsMerged / totalMerges) : 0,
        thisMonth,
        thisWeek
      }
    };

  } catch (error) {
    console.error("Error getting merge statistics:", error);
    return { success: false, error: error.message };
  }
}

