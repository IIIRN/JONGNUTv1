// src/app/actions/paymentActions.js
"use server"; // <-- Make sure this is at the top

import QRCode from 'qrcode';

export async function generateQrCodePayload(promptPayId, amount) {
  try {
    console.log('PromptPay ID:', promptPayId);
    console.log('Booking amount:', amount);
    // Generate the QR code data URL using the qrcode library
    const qrCodeDataUrl = await QRCode.toDataURL(promptPayId, { amount: amount });

    return qrCodeDataUrl;

  } catch (error) {
    console.error('Error generating QR code payload:', error);
    throw new Error('Failed to generate QR code payload.');
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