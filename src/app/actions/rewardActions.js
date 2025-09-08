"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// Action to add a new reward
export async function addReward(rewardData) {
    if (!rewardData.name || !rewardData.pointsRequired) {
        return { success: false, error: 'Missing required fields.' };
    }
    try {
        await db.collection('rewards').add({
            ...rewardData,
            createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Action to redeem a reward
export async function redeemReward(userId, rewardId) {
    if (!userId || !rewardId) {
        return { success: false, error: "User ID and Reward ID are required." };
    }

    const customerRef = db.collection('customers').doc(userId);
    const rewardRef = db.collection('rewards').doc(rewardId);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const [customerDoc, rewardDoc] = await Promise.all([
                transaction.get(customerRef),
                transaction.get(rewardRef)
            ]);

            if (!customerDoc.exists) throw new Error("Customer not found.");
            if (!rewardDoc.exists) throw new Error("Reward not found.");

            const customer = customerDoc.data();
            const reward = rewardDoc.data();
            const currentPoints = customer.points || 0;

            if (currentPoints < reward.pointsRequired) {
                throw new Error("Not enough points.");
            }

            const newPoints = currentPoints - reward.pointsRequired;
            
            // Update customer points
            transaction.update(customerRef, { points: newPoints });

            // Create a new coupon for the customer
            const couponRef = customerRef.collection('coupons').doc();
            transaction.set(couponRef, {
                rewardId: rewardId,
                name: reward.name,
                description: reward.description,
                discountType: reward.discountType || 'percentage', // 'percentage' หรือ 'fixed'
                discountValue: reward.discountValue || reward.value || 0, // จำนวนส่วนลด
                redeemedAt: FieldValue.serverTimestamp(),
                used: false,
                expiresAt: null, // Can add expiry logic later
            });

            return { couponId: couponRef.id };
        });

        return { success: true, ...result };

    } catch (error) {
        console.error("Redeem reward error:", error);
        return { success: false, error: error.message };
    }
}