import {
    createPaymentFlexTemplate,
    createReviewFlexTemplate,
    createAppointmentConfirmedFlexTemplate,
    createServiceCompletedFlexTemplate,
    createAppointmentCancelledFlexTemplate,
    createNewBookingFlexTemplate,
    createPaymentConfirmationFlexTemplate,
    createReviewThankYouFlexTemplate,
    createAppointmentReminderFlexTemplate,
    createDailyAppointmentNotificationFlexTemplate
} from './flexTemplateActions';

/**
 * Helper function to send Flex Messages via LINE Messaging API.
 * This centralized function improves code reusability and error handling.
 * @param {string} userId - The recipient's LINE User ID.
 * @param {Object} flexTemplate - The Flex Message object to be sent.
 * @param {string} actionName - A descriptive name for the action for logging purposes.
 * @returns {Promise<Object>} - An object indicating the success or failure of the operation.
 */
async function sendFlexMessage(userId, flexTemplate, actionName) {
    try {
    // ...existing code...
        
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not found in environment variables');
            return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
        }
        
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                to: userId,
                messages: [flexTemplate]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ LINE API Error Response for ${actionName}:`, {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    // ...existing code...
        return { success: true, message: `${actionName} flex message sent successfully` };

    } catch (error) {
        console.error(`Error sending ${actionName} flex message:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Sends a Payment Flex Message to the LINE OA.
 * @param {string} userId - The customer's LINE User ID.
 * @param {Object} appointmentData - The appointment data.
 * @returns {Promise<Object>} The result of the message sending operation.
 */
export async function sendPaymentFlexMessage(userId, appointmentData) {
    const flexTemplate = await createPaymentFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Payment');
}

/**
 * Sends a Review Flex Message to the LINE OA.
 * @param {string} userId - The customer's LINE User ID.
 * @param {Object} appointmentData - The appointment data.
 * @returns {Promise<Object>} The result of the message sending operation.
 */
export async function sendReviewFlexMessage(userId, appointmentData) {
    const flexTemplate = await createReviewFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Review');
}

/**
 * Sends an Appointment Confirmed Flex Message.
 */
export async function sendAppointmentConfirmedFlexMessage(userId, appointmentData) {
    const flexTemplate = await createAppointmentConfirmedFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Appointment Confirmed');
}

/**
 * Sends a Service Completed Flex Message.
 */
export async function sendServiceCompletedFlexMessage(userId, appointmentData) {
    const flexTemplate = await createServiceCompletedFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Service Completed');
}

/**
 * Sends an Appointment Cancelled Flex Message.
 */
export async function sendAppointmentCancelledFlexMessage(userId, appointmentData, reason) {
    const flexTemplate = await createAppointmentCancelledFlexTemplate(appointmentData, reason);
    return sendFlexMessage(userId, flexTemplate, 'Appointment Cancelled');
}

/**
 * Sends a New Booking Flex Message.
 */
export async function sendNewBookingFlexMessage(userId, appointmentData) {
    const flexTemplate = await createNewBookingFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'New Booking');
}

/**
 * Sends a Payment Confirmation Flex Message.
 */
export async function sendPaymentConfirmationFlexMessage(userId, appointmentData) {
    const flexTemplate = await createPaymentConfirmationFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Payment Confirmation');
}

/**
 * Sends a Review Thank You Flex Message.
 */
export async function sendReviewThankYouFlexMessage(userId, pointsAwarded = 0) {
    const flexTemplate = await createReviewThankYouFlexTemplate({ pointsAwarded });
    return sendFlexMessage(userId, flexTemplate, 'Review Thank You');
}

/**
 * Sends an Appointment Reminder Flex Message.
 */
export async function sendAppointmentReminderFlexMessage(userId, bookingData) {
    const flexTemplate = await createAppointmentReminderFlexTemplate(bookingData);
    return sendFlexMessage(userId, flexTemplate, 'Appointment Reminder');
}

/**
 * Sends a Daily Appointment Notification Flex Message to customers who have appointments today.
 */
export async function sendDailyAppointmentNotificationFlexMessage(userId, appointmentData) {
    const flexTemplate = await createDailyAppointmentNotificationFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Daily Appointment Notification');
}

