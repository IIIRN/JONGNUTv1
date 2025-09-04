"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { mergePointsFromPhone, checkPhonePointsForMerge } from './pointMergeActions';
import { awardPointsForVisit } from './pointActions';

/**
 * Find or create customer with automatic points merging when LINE ID is connected
 * @param {object} customerData - Customer data including phone, fullName, email
 * @param {string} userId - LINE User ID (if available)
 * @returns {Promise<{success: boolean, customerId?: string, mergedPoints?: number, error?: string}>}
 */
export async function findOrCreateCustomer(customerData, userId) {
    if (!customerData?.phone && !userId) {
        return {
            success: false,
            error: 'Phone number or User ID is required.'
        };
    }

    const customersRef = db.collection('customers');
    let customerQuery;
    let customerDocRef; // Declare here to be accessible throughout the function

    // Prioritize finding customer by LINE User ID if available
    if (userId) {
        // Use the userId directly as the document ID
        customerDocRef = customersRef.doc(userId);
        const customerDoc = await customerDocRef.get();
        customerQuery = customerDoc.exists ? [customerDoc] : [];
    } else {
        // Fallback to querying by phone number if no userId
        const q = customersRef.where('phone', '==', customerData.phone).limit(1);
        const snapshot = await q.get();
        customerQuery = snapshot.docs;
        // Set customerDocRef for phone-based customers
        if (customerQuery.length > 0) {
            customerDocRef = customerQuery[0].ref;
        }
    }

    try {
        let customerId;
        let mergedPoints = 0;

        if (customerQuery.length > 0) {
            // --- Customer Found ---
            const customerDoc = customerQuery[0];
            customerId = customerDoc.id;

            // Award points for the visit
            const visitPointsResult = await awardPointsForVisit(customerId);

            // Prepare data for update (only update if new data is provided)
            const updateData = {
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (customerData.fullName) updateData.fullName = customerData.fullName;
            if (customerData.email) updateData.email = customerData.email;
            if (customerData.phone) updateData.phone = customerData.phone;

            // Check if this is a new LINE connection for existing phone-based customer
            if (userId && customerData.phone && !customerDoc.data().userId) {
                // Check if there are points to merge from phone-based system
                const phonePointsCheck = await checkPhonePointsForMerge(customerData.phone);
                
                if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                    // Merge points from phone-based record
                    const mergeResult = await mergePointsFromPhone(userId, customerData.phone);
                    
                    if (mergeResult.success) {
                        mergedPoints = mergeResult.mergedPoints;
                        updateData.mergedFromPhone = true;
                        updateData.mergedPoints = mergedPoints;
                        updateData.mergedAt = FieldValue.serverTimestamp();
                        
                        console.log(`Merged ${mergedPoints} points from phone ${customerData.phone} to LINE ID ${userId}`);
                    }
                }

                // Update customer record with LINE User ID
                updateData.userId = userId;
            }

            await customerDocRef.update(updateData);
            console.log(`Updated customer ${customerId} with ${Object.keys(updateData).length} fields.`);

        } else {
            // --- Customer Not Found - Create New ---

            // Check if customer has points from phone-based system before creating new record
            if (userId && customerData.phone) {
                const phonePointsCheck = await checkPhonePointsForMerge(customerData.phone);
                
                if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                    // There are points to merge, so we need to handle this carefully
                    const mergeResult = await mergePointsFromPhone(userId, customerData.phone);
                    
                    if (mergeResult.success) {
                        mergedPoints = mergeResult.mergedPoints;
                    }
                }
            }

            // If userId is available, use it as the document ID, otherwise let Firestore generate one.
            const newCustomerRef = userId ? customersRef.doc(userId) : customersRef.doc();
            const newCustomerData = {
                fullName: customerData.fullName,
                phone: customerData.phone,
                email: customerData.email || '',
                userId: userId || null,
                points: mergedPoints, // Start with merged points if any
                mergedFromPhone: mergedPoints > 0,
                mergedPoints: mergedPoints > 0 ? mergedPoints : null,
                mergedAt: mergedPoints > 0 ? FieldValue.serverTimestamp() : null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await newCustomerRef.set(newCustomerData);
            customerId = newCustomerRef.id;

            // Award points for the first visit (additional to merged points)
            await awardPointsForVisit(customerId);
            
            console.log(`Created new customer ${customerId} with ${mergedPoints} merged points and awarded visit points.`);
        }

        return {
            success: true,
            customerId: customerId,
            mergedPoints: mergedPoints
        };

    } catch (error) {
        console.error("Error in findOrCreateCustomer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Connect LINE ID to existing customer by phone number
 * @param {string} phoneNumber - Customer's phone number
 * @param {string} userId - LINE User ID
 * @param {object} additionalData - Additional customer data (optional)
 * @returns {Promise<{success: boolean, customerId?: string, mergedPoints?: number, message?: string, error?: string}>}
 */
export async function connectLineToCustomer(phoneNumber, userId, additionalData = {}) {
    if (!phoneNumber || !userId) {
        return {
            success: false,
            error: 'เบอร์โทรศัพท์และ LINE User ID จำเป็นต้องระบุ'
        };
    }

    try {
        // Check if LINE ID already exists
        const existingLineCustomer = await db.collection('customers').doc(userId).get();
        if (existingLineCustomer.exists) {  // Admin SDK uses .exists property
            return {
                success: false,
                error: 'LINE ID นี้ถูกใช้งานแล้ว'
            };
        }

        // Find customer by phone number in main customers collection
        const phoneQuery = db.collection('customers').where('phone', '==', phoneNumber).limit(1);
        const phoneSnapshot = await phoneQuery.get();

        let customerId;
        let mergedPoints = 0;

        if (!phoneSnapshot.empty) {
            // Customer exists in main collection - update with LINE ID
            const existingCustomer = phoneSnapshot.docs[0];
            const existingData = existingCustomer.data();
            
            if (existingData.userId) {
                return {
                    success: false,
                    error: 'ลูกค้ารายนี้มี LINE ID เชื่อมต่ออยู่แล้ว'
                };
            }

            // Create new customer record with LINE ID as document ID
            const newCustomerRef = db.collection('customers').doc(userId);
            const newCustomerData = {
                ...existingData,
                ...additionalData,
                userId: userId,
                phoneNumber: phoneNumber,
                connectedLineAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await newCustomerRef.set(newCustomerData);
            
            // Delete old record without LINE ID
            await existingCustomer.ref.delete();
            
            customerId = userId;
            console.log(`Moved customer from ${existingCustomer.id} to LINE ID ${userId}`);

        } else {
            // Customer not found in main collection - check phone-based collection and create new
            customerId = userId;
        }

        // Check for points in phone-based system
        const phonePointsCheck = await checkPhonePointsForMerge(phoneNumber);
        
        if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
            const mergeResult = await mergePointsFromPhone(userId, phoneNumber);
            
            if (mergeResult.success) {
                mergedPoints = mergeResult.mergedPoints;
                
                // Update customer record with merge info
                await db.collection('customers').doc(userId).update({
                    mergedFromPhone: true,
                    mergedPoints: mergedPoints,
                    mergedAt: FieldValue.serverTimestamp(),
                    points: FieldValue.increment(mergedPoints)
                });

                console.log(`Connected LINE ID ${userId} to phone ${phoneNumber} and merged ${mergedPoints} points`);
            }
        }

        // If no existing customer, create new one
        if (phoneSnapshot.empty) {
            const newCustomerData = {
                fullName: additionalData.fullName || '',
                phone: phoneNumber,
                email: additionalData.email || '',
                userId: userId,
                points: mergedPoints,
                mergedFromPhone: mergedPoints > 0,
                mergedPoints: mergedPoints > 0 ? mergedPoints : null,
                mergedAt: mergedPoints > 0 ? FieldValue.serverTimestamp() : null,
                connectedLineAt: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await db.collection('customers').doc(userId).set(newCustomerData);
            console.log(`Created new customer ${userId} with LINE connection and ${mergedPoints} merged points`);
        }

        return {
            success: true,
            customerId: userId,
            mergedPoints: mergedPoints,
            message: mergedPoints > 0 
                ? `เชื่อมต่อ LINE สำเร็จ และรวมคะแนน ${mergedPoints} คะแนนจากระบบเบอร์โทร`
                : 'เชื่อมต่อ LINE สำเร็จ'
        };

    } catch (error) {
        console.error("Error connecting LINE to customer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Adds a new customer to Firestore.
 * @param {object} customerData - The data for the new customer.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function addCustomer(customerData) {
  try {
    // ใช้ синтаксис ของ Admin SDK
    await db.collection('customers').add({
      ...customerData,
      points: Number(customerData.points) || 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/admin/customers');
    return { success: true, message: 'เพิ่มลูกค้าสำเร็จ!' };
  } catch (error) {
    console.error("Error adding customer:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a customer from Firestore.
 * @param {string} customerId - The ID of the customer to delete.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function deleteCustomer(customerId) {
  try {
    // ใช้ синтаксис ของ Admin SDK
    await db.collection('customers').doc(customerId).delete();
    revalidatePath('/admin/customers');
    return { success: true, message: 'ลบลูกค้าสำเร็จ!' };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return { success: false, error: error.message };
  }
}