import {
    createPaymentFlexTemplate,
    createReviewFlexTemplate,
    createAppointmentConfirmedFlexTemplate,
    createServiceCompletedFlexTemplate,
    createAppointmentCancelledFlexTemplate,
    createNewBookingFlexTemplate,
    createPaymentConfirmationFlexTemplate,
    createReviewThankYouFlexTemplate,
    createAppointmentReminderFlexTemplate
} from './flexTemplateActions';

/**
 * ส่ง Payment Flex Message ไปยัง LINE OA
 * @param {string} userId LINE User ID ของลูกค้า
 * @param {Object} appointmentData ข้อมูลการนัดหมาย
 * @returns {Promise<Object>} ผลลัพธ์การส่งข้อความ
 */
export async function sendPaymentFlexMessage(userId, appointmentData) {
    try {
        console.log('🔄 Creating Payment Flex Template for user:', userId);
        const flexTemplate = await createPaymentFlexTemplate(appointmentData);
        console.log('✅ Payment Flex Template created:', JSON.stringify(flexTemplate, null, 2));
        
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not found in environment variables');
            return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
        }
        
        // ใช้ LINE Messaging API ส่งข้อความ
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ Payment Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'Payment flex message sent successfully' };

    } catch (error) {
        console.error('Error sending payment flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Review Flex Message ไปยัง LINE OA
 * @param {string} userId LINE User ID ของลูกค้า
 * @param {Object} appointmentData ข้อมูลการนัดหมาย
 * @returns {Promise<Object>} ผลลัพธ์การส่งข้อความ
 */
export async function sendReviewFlexMessage(userId, appointmentData) {
    try {
        console.log('🔄 Creating Review Flex Template for user:', userId);
        const flexTemplate = await createReviewFlexTemplate(appointmentData);
        console.log('✅ Review Flex Template created:', JSON.stringify(flexTemplate, null, 2));
        
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not found in environment variables');
            return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
        }
        
        // ใช้ LINE Messaging API ส่งข้อความ
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ Review Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'Review flex message sent successfully' };

    } catch (error) {
        console.error('Error sending review flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่งข้อความแจ้งเตือนการนัดหมายพร้อม Payment และ Review Links
 * @param {string} userId LINE User ID ของลูกค้า
 * @param {Object} appointmentData ข้อมูลการนัดหมาย
 * @returns {Promise<Object>} ผลลัพธ์การส่งข้อความ
 */
export async function sendAppointmentNotificationWithFlex(userId, appointmentData) {
    try {
        const paymentFlex = await createPaymentFlexTemplate(appointmentData);
        const reviewFlex = await createReviewFlexTemplate(appointmentData);
        
        // ส่งข้อความแจ้งเตือนพร้อมทั้ง payment และ review options
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                to: userId,
                messages: [
                    {
                        type: 'text',
                        text: `🎉 การนัดหมายของคุณเสร็จสิ้นแล้ว!\n\n📝 รหัส: ${appointmentData.id.substring(0, 8).toUpperCase()}\n🏷️ บริการ: ${appointmentData.serviceInfo?.name}\n📅 วันที่: ${new Date(appointmentData.date).toLocaleDateString('th-TH')}\n⏰ เวลา: ${appointmentData.time}\n\nกรุณาดำเนินการต่อไปนี้:`
                    },
                    paymentFlex,
                    reviewFlex
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`LINE API Error: ${response.status}`);
        }

        console.log('Appointment notification with Flex sent successfully to user:', userId);
        return { success: true, message: 'Appointment notification sent successfully' };

    } catch (error) {
        console.error('Error sending appointment notification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Appointment Confirmed Flex Message
 */
export async function sendAppointmentConfirmedFlexMessage(userId, appointmentData) {
    try {
        console.log('🔄 Creating Appointment Confirmed Flex Template for user:', userId);
        const flexTemplate = await createAppointmentConfirmedFlexTemplate(appointmentData);
        
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ Appointment confirmed Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'Appointment confirmed flex message sent successfully' };

    } catch (error) {
        console.error('Error sending appointment confirmed flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Service Completed Flex Message
 */
export async function sendServiceCompletedFlexMessage(userId, appointmentData) {
    try {
        console.log('🔄 Creating Service Completed Flex Template for user:', userId);
        const flexTemplate = await createServiceCompletedFlexTemplate(appointmentData);
        
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ Service completed Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'Service completed flex message sent successfully' };

    } catch (error) {
        console.error('Error sending service completed flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Appointment Cancelled Flex Message
 */
export async function sendAppointmentCancelledFlexMessage(userId, appointmentData, reason) {
    try {
        console.log('🔄 Creating Appointment Cancelled Flex Template for user:', userId);
        const flexTemplate = await createAppointmentCancelledFlexTemplate(appointmentData, reason);
        
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ Appointment cancelled Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'Appointment cancelled flex message sent successfully' };

    } catch (error) {
        console.error('Error sending appointment cancelled flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง New Booking Flex Message
 */
export async function sendNewBookingFlexMessage(userId, appointmentData) {
    try {
        console.log('🔄 Creating New Booking Flex Template for user:', userId);
        const flexTemplate = await createNewBookingFlexTemplate(appointmentData);
        
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ New booking Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'New booking flex message sent successfully' };

    } catch (error) {
        console.error('Error sending new booking flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Payment Confirmation Flex Message
 */
export async function sendPaymentConfirmationFlexMessage(userId, appointmentData) {
    try {
        console.log('🔄 Creating Payment Confirmation Flex Template for user:', userId);
        const flexTemplate = await createPaymentConfirmationFlexTemplate(appointmentData);
        
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
            console.error('❌ LINE API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

    console.log('✅ Payment confirmation Flex message sent successfully. Status:', response.status);
    return { success: true, message: 'Payment confirmation flex message sent successfully' };

    } catch (error) {
        console.error('Error sending payment confirmation flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Review Thank You Flex Message
 */
export async function sendReviewThankYouFlexMessage(userId, pointsAwarded = 0) {
    try {
        console.log('🔄 Sending review thank you Flex message to user:', userId, 'with points:', pointsAwarded);

        if (!userId) {
            throw new Error('User ID is required');
        }

        const flexMessage = await createReviewThankYouFlexTemplate(pointsAwarded);
        
        const body = {
            to: userId,
            messages: [flexMessage]
        };

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LINE API Error Response:', response.status, errorText);
            throw new Error(`LINE API error: ${response.status} - ${errorText}`);
        }

        const responseData = await response.json();
        console.log('✅ Review thank you Flex message sent successfully:', responseData);
        return { success: true, message: 'Review thank you flex message sent successfully' };

    } catch (error) {
        console.error('Error sending review thank you flex message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ส่ง Appointment Reminder Flex Message
 */
export async function sendAppointmentReminderFlexMessage(userId, bookingData) {
    try {
        console.log('🔄 Sending appointment reminder Flex message to user:', userId, 'for:', bookingData.serviceName);

        if (!userId) {
            throw new Error('User ID is required');
        }

        const flexMessage = await createAppointmentReminderFlexTemplate(bookingData);
        
        const body = {
            to: userId,
            messages: [flexMessage]
        };

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LINE API Error Response:', response.status, errorText);
            throw new Error(`LINE API error: ${response.status} - ${errorText}`);
        }

        const responseData = await response.json();
        console.log('✅ Appointment reminder Flex message sent successfully:', responseData);
        return { success: true, message: 'Appointment reminder flex message sent successfully' };

    } catch (error) {
        console.error('Error sending appointment reminder flex message:', error);
        return { success: false, error: error.message };
    }
}
