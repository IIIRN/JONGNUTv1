// src/app/actions/paymentActions.js
"use server"; // <-- Make sure this is at the top

import QRCode from 'qrcode';

// Function to generate PromptPay payload according to EMV QR Code standard
function generatePromptPayPayload(id, amount) {
  // Helper function to format tag-length-value
  function f(tag, value) {
    const len = ("0" + value.length).slice(-2);
    return tag + len + value;
  }
  
  // Format ID for PromptPay (convert Thai mobile to E.164 format)
  function formatId(id) {
    // ถ้าเป็นเบอร์โทรไทย 10 หลัก ให้แปลงเป็น E.164 (0066XXXXXXXXX)
    return /^\d{10}$/.test(id)
      ? "0066" + id.substring(1)
      : id;
  }

  let p = "";
  p += f("00", "01");               // Payload Format Indicator
  p += f("01", "11");               // Point of Initiation (Static QR)
  
  // Merchant Account Info (PromptPay)
  let mp = "";
  mp += f("00", "A000000677010111"); // PromptPay Application ID
  mp += f("01", formatId(id));       // PromptPay ID (formatted)
  p += f("29", mp);
  
  // Transaction info
  p += f("52", "0000");             // Merchant Category Code
  p += f("53", "764");              // Currency: THB
  if (amount && amount > 0) {
    p += f("54", amount.toFixed(2));  // Transaction Amount
  }
  p += f("58", "TH");               // Country Code
  p += f("59", "BEAUTY_SALON");     // Merchant Name
  p += f("60", "BANGKOK");          // Merchant City
  
  // CRC calculation
  const raw = p + "6304";
  const crc = calculateCRC16(raw).toString(16).toUpperCase();
  const paddedCrc = ("0000" + crc).slice(-4);
  p += "63" + "04" + paddedCrc;
  
  return p;
}

// CRC16-CCITT calculation for QR Code (improved version)
function calculateCRC16(input) {
  // Convert string to bytes
  const encoder = new TextEncoder();
  const buf = encoder.encode(input);
  let crc = 0xFFFF;
  
  buf.forEach(function(b) {
    crc ^= (b & 0xFF) << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021)
        : (crc << 1);
      crc &= 0xFFFF;
    }
  });
  
  return crc;
}

export async function generateQrCodePayload(promptPayId, amount) {
  try {
    console.log('=== PromptPay QR Code Generation ===');
    console.log('PromptPay ID:', promptPayId);
    console.log('Amount:', amount);
    
    // Generate proper PromptPay payload using improved function
    const promptPayPayload = generatePromptPayPayload(promptPayId, amount);
    console.log('Generated PromptPay Payload:', promptPayPayload);
    console.log('Payload Length:', promptPayPayload.length);
    
    // Validate payload format
    if (!promptPayPayload.startsWith('000201')) {
      throw new Error('Invalid PromptPay payload format');
    }
    
    // Generate QR Code from the PromptPay payload
    const qrCodeDataUrl = await QRCode.toDataURL(promptPayPayload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });

    console.log('QR Code generated successfully');
    return qrCodeDataUrl;

  } catch (error) {
    console.error('Error generating QR code payload:', error);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

// Test function to validate PromptPay payload (for debugging)
export async function testPromptPayPayload(promptPayId, amount) {
  try {
    const payload = generatePromptPayPayload(promptPayId, amount);
    console.log('Test Payload:', payload);
    
    // Basic validation
    const validations = {
      startsWithCorrectFormat: payload.startsWith('000201'),
      hasCorrectCurrency: payload.includes('5303764'),
      hasCountryCode: payload.includes('5802TH'),
      hasPromptPayIdentifier: payload.includes('A000000677010111'),
      hasMerchantInfo: payload.includes('5913BEAUTY_SALON') && payload.includes('6007BANGKOK'),
      endsWithCRC: payload.length >= 4 && /^[0-9A-F]{4}$/.test(payload.slice(-4))
    };
    
    console.log('Validation Results:', validations);
    return { payload, validations };
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

/**
 * --- NEW FUNCTION ---
 * Generates a QR code from any given text string.
 * @param {string} text - The text to encode into the QR code.
 * @returns {Promise<string>} - A Data URL string of the generated QR code image.
 */
export async function generateQrCodeFromText(text) {
    if (!text) {
        throw new Error("Text for QR code generation is required.");
    }
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.9,
            margin: 1,
        });
        return qrCodeDataUrl;
    } catch (error) {
        console.error('Error generating QR code from text:', error);
        throw new Error('Failed to generate QR code.');
    }
}

/**
 * Updates the payment status of an appointment
 * @param {string} appointmentId - The appointment ID
 * @param {string} status - The payment status ('paid', 'unpaid', 'pending', etc.)
 * @param {object} additionalData - Additional payment data
 * @returns {Promise<object>} - Result object with success status
 */
export async function updatePaymentStatus(appointmentId, status, additionalData = {}) {
    try {
        if (!appointmentId) {
            throw new Error('Appointment ID is required');
        }

        if (!status) {
            throw new Error('Payment status is required');
        }

        console.log('Updating payment status for appointment:', appointmentId);
        console.log('New status:', status);
        console.log('Additional data:', additionalData);

        // Import Firebase functions here to avoid issues with server actions
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('@/app/lib/firebase');

        // Create the update object
        const updateData = {
            'paymentInfo.status': status,
            'paymentInfo.updatedAt': new Date().toISOString(),
            ...additionalData
        };

        // Update the appointment document
        const appointmentRef = doc(db, 'appointments', appointmentId);
        await updateDoc(appointmentRef, updateData);

        console.log('Payment status updated successfully');

        return {
            success: true,
            message: 'Payment status updated successfully',
            data: {
                appointmentId,
                status,
                updatedAt: updateData['paymentInfo.updatedAt']
            }
        };

    } catch (error) {
        console.error('Error updating payment status:', error);
        return {
            success: false,
            error: error.message || 'Failed to update payment status',
            data: null
        };
    }
}

