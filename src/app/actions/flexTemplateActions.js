"use server";

import { getShopProfile } from './settingsActions';

export async function createPaymentFlexTemplate(appointmentData) {
    const { id, appointmentId, serviceInfo, paymentInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalAmount || paymentInfo?.totalPrice || serviceInfo?.price || 0;
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);
    const serviceName = serviceInfo?.name || 'บริการของคุณ';
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    return {
        type: "flex",
        altText: `💰 ชำระเงิน ${formattedAmount} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "💰 ชำระเงิน",
                        weight: "bold",
                        size: "lg",
                        color: "#A8999E",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: "#A8999E"
                    },
                    {
                        type: "text",
                        text: `เรียน ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "lg"
                    },
                    {
                        type: "text",
                        text: "กรุณาชำระเงินสำหรับการจองของคุณ",
                        size: "sm",
                        color: "#666666",
                        wrap: true,
                        margin: "sm"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "บริการ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: serviceName,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        wrap: true,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "วันที่",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: `${appointmentDate}`,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 2,
                                        align: "end"
                                    },
                                    {
                                        type: "text",
                                        text: time,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 1,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "รหัสการจอง",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: shortId,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            }
                        ],
                        spacing: "sm",
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "ยอดชำระ",
                                weight: "bold",
                                size: "lg",
                                color: "#333333",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `${formattedAmount} ${currencySymbol}`,
                                weight: "bold",
                                size: "lg",
                                color: "#A8999E",
                                align: "end"
                            }
                        ],
                        margin: "lg",
                        paddingAll: "16px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ชำระเงิน",
                            uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID}/${id}`
                        },
                        color: "#A8999E"
                    }
                ],
                spacing: "sm",
                paddingAll: "20px"
            }
        }
    };
}

export async function createReviewFlexTemplate(appointmentData) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = serviceInfo?.name || 'บริการของคุณ';
    const safeId = (id || appointmentId || '').toString();
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    
    return {
        type: "flex",
    altText: `⭐ ให้คะแนนรีวิว ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "⭐ ให้คะแนนรีวิว",
                        weight: "bold",
                        size: "lg",
                        color: "#A8999E",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: "#A8999E"
                    },
                    {
                        type: "text",
                        text: `เรียน ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "lg"
                    },
                    {
                        type: "text",
                        text: "ช่วยรีวิวบริการของเรา",
                        size: "md",
                        color: "#A8999E",
                        weight: "bold",
                        margin: "sm"
                    },
                    {
                        type: "text",
                        text: "เพื่อช่วยให้เราปรับปรุงบริการให้ดียิ่งขึ้น",
                        size: "sm",
                        color: "#666666",
                        wrap: true,
                        margin: "sm"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "บริการ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: serviceName,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        wrap: true,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "วันที่",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: `${appointmentDate}`,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 2,
                                        align: "end"
                                    },
                                    {
                                        type: "text",
                                        text: time,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 1,
                                        align: "end"
                                    }
                                ]
                            }
                        ],
                        spacing: "sm",
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "กดปุ่มด้านล่างเพื่อให้คะแนนและแสดงความคิดเห็น",
                                size: "sm",
                                color: "#A8999E",
                                wrap: true,
                                align: "center"
                            }
                        ],
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ให้คะแนน",
                            uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${safeId}`
                        },
                        color: "#A8999E"
                    }
                ],
                spacing: "sm",
                paddingAll: "20px"
            }
        }
    };
}

export async function createPaymentConfirmationFlexTemplate(appointmentData) {
    const { id, appointmentId, paymentInfo, serviceInfo, customerInfo } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalAmount || paymentInfo?.amountPaid || serviceInfo?.price || 0;
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);
    const serviceName = serviceInfo?.name || 'บริการของคุณ';
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    return {
        type: "flex",
    altText: `ชำระเงินสำเร็จ ${formattedAmount} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "ชำระเงินสำเร็จ",
                        weight: "bold",
                        size: "lg",
                        color: "#4CAF50",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: "#4CAF50"
                    },
                    {
                        type: "text",
                        text: `เรียน ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "lg"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "ยอดชำระ",
                                weight: "bold",
                                size: "lg",
                                color: "#333333",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `${formattedAmount} ${currencySymbol}`,
                                weight: "bold",
                                size: "lg",
                                color: "#4CAF50",
                                align: "end"
                            }
                        ],
                        margin: "md",
                        paddingAll: "16px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "บริการ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: serviceName,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        wrap: true,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "รหัสการจอง",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: shortId,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            }
                        ],
                        spacing: "sm",
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "ขอบคุณที่ชำระเงิน ใช้บริการของเราต่อไปนะคะ",
                                size: "sm",
                                color: "#4CAF50",
                                wrap: true,
                                align: "center"
                            }
                        ],
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#E8F5E8",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * Creates an appointment reminder Flex Message template
 */
export async function createAppointmentReminderFlexTemplate(bookingData) {
    const { serviceName, appointmentDate, appointmentTime, shopName } = bookingData || {};
    
    // Safe handling for undefined values
    const safeServiceName = serviceName || 'บริการเสริมสวย';
    const safeAppointmentDate = appointmentDate || 'ไม่ระบุ';
    const safeAppointmentTime = appointmentTime || 'ไม่ระบุ';
    const safeShopName = shopName || 'ร้านเสริมสวย';

    const message = {
    type: "flex",
    altText: `🔔 แจ้งเตือนการนัดหมาย - ${safeServiceName} วันที่ ${safeAppointmentDate} เวลา ${safeAppointmentTime}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                paddingAll: "20px",
                contents: [
                    {
                        type: "text",
                        text: "🔔 แจ้งเตือนการนัดหมาย",
                        weight: "bold",
                        size: "lg",
                        color: "#A8999E",
                        align: "center"
                    },
                    {
                        type: "separator",
                        margin: "md",
                        color: "#A8999E"
                    },
                    {
                        type: "text",
                        text: "สวัสดีค่ะ! อีก 1 ชั่วโมงจะถึงเวลานัดหมายของคุณแล้ว",
                        wrap: true,
                        color: "#333333",
                        size: "md",
                        margin: "md"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "10px",
                        paddingAll: "15px",
                        margin: "lg",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "💅",
                                        size: "lg",
                                        flex: 0
                                    },
                                    {
                                        type: "text",
                                        text: "บริการ",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: safeServiceName,
                                        weight: "bold",
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "separator",
                                margin: "md"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                margin: "md",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📅",
                                        size: "lg",
                                        flex: 0
                                    },
                                    {
                                        type: "text",
                                        text: "วันที่",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: safeAppointmentDate,
                                        weight: "bold",
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                margin: "md",
                                contents: [
                                    {
                                        type: "text",
                                        text: "⏰",
                                        size: "lg",
                                        flex: 0
                                    },
                                    {
                                        type: "text",
                                        text: "เวลา",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: safeAppointmentTime,
                                        weight: "bold",
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                margin: "md",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🏪",
                                        size: "lg",
                                        flex: 0
                                    },
                                    {
                                        type: "text",
                                        text: "สถานที่",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: safeShopName,
                                        weight: "bold",
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: "text",
                        text: "กรุณามาตรงเวลานะคะ ขอบคุณค่ะ ✨",
                        wrap: true,
                        color: "#A8999E",
                        size: "sm",
                        weight: "bold",
                        align: "center",
                        margin: "lg"
                    }
                ]
            }
        }
    };

    return message;
}

/**
 * Creates a Flex Template for daily appointment notification to customers
 * This is sent to customers who have appointments today to remind them
 */
export async function createDailyAppointmentNotificationFlexTemplate(appointmentData) {
    const { id, serviceInfo, customerInfo, date, time, appointmentInfo, status } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = serviceInfo?.name || 'บริการของคุณ';
    const beauticianName = appointmentInfo?.beauticianInfo?.firstName || appointmentInfo?.beautician || 'จะแจ้งให้ทราบ';
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    
    const needsConfirmation = status === 'awaiting_confirmation';
    const safeId = (id || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    
    const flexMessage = {
        type: "flex",
        altText: `📅 แจ้งเตือน: คุณมีนัดวันนี้ ${time}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: needsConfirmation ? "⏰ แจ้งเตือนการนัดหมาย" : "📅 นัดหมายวันนี้",
                        weight: "bold",
                        size: "lg",
                        color: needsConfirmation ? "#FF9800" : "#A8999E",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: "#A8999E"
                    },
                    {
                        type: "text",
                        text: `สวัสดี ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "lg"
                    },
                    {
                        type: "text",
                        text: needsConfirmation ? 
                            "คุณมีนัดหมายวันนี้ที่ยังไม่ได้ยืนยัน กรุณายืนยันการนัดหมาย" :
                            "ขอเตือนว่าคุณมีนัดหมายวันนี้ เตรียมตัวมาให้พร้อมนะคะ",
                        size: "sm",
                        color: needsConfirmation ? "#FF5722" : "#666666",
                        wrap: true,
                        margin: "sm"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "บริการ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: serviceName,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        align: "end",
                                        weight: "bold"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "วันที่",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: `${appointmentDate}`,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 2,
                                        align: "end"
                                    },
                                    {
                                        type: "text",
                                        text: time,
                                        size: "sm",
                                        color: "#FF5722",
                                        flex: 1,
                                        align: "end",
                                        weight: "bold"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "ช่างผู้ให้บริการ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: beauticianName,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "สถานะ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: needsConfirmation ? "รอการยืนยัน" : "ยืนยันแล้ว",
                                        size: "sm",
                                        color: needsConfirmation ? "#FF9800" : "#4CAF50",
                                        flex: 3,
                                        align: "end",
                                        weight: "bold"
                                    }
                                ]
                            }
                        ],
                        spacing: "sm",
                        margin: "lg"
                    }
                ]
            }
        }
    };

    if (needsConfirmation) {
        const liffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID || '2008020372-mZXQ00w6';
        const liffUrl = `https://liff.line.me/${liffId}`;
        
        flexMessage.contents.footer = {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "uri",
                        label: "✅ ยืนยันการนัดหมาย",
                        uri: liffUrl
                    },
                    color: "#FF9800"
                },
                {
                    type: "text",
                    text: "กดปุ่มเพื่อเข้าสู่หน้าลูกค้าและยืนยันการนัดหมาย",
                    size: "xs",
                    color: "#888888",
                    align: "center",
                    wrap: true
                }
            ]
        };
    } else {
        flexMessage.contents.footer = {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
                {
                    type: "text",
                    text: "ขอบคุณที่ไว้วางใจในบริการของเรา",
                    size: "xs",
                    color: "#A8999E",
                    align: "center",
                    wrap: true,
                    weight: "bold"
                },
                {
                    type: "text",
                    text: "หากมีข้อสงสัย กรุณาติดต่อเรา",
                    size: "xs",
                    color: "#888888",
                    align: "center",
                    wrap: true
                }
            ]
        };
    }

    return flexMessage;
}
/**
 * สร้าง Flex Message สำหรับแจ้งบริการเสร็จสิ้น
 */
export async function createServiceCompletedFlexTemplate(appointmentData) {
    const { id, serviceInfo, customerInfo, totalPointsAwarded } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = serviceInfo?.name || 'บริการของคุณ';
    
    return {
        type: "flex",
    altText: `🎉 บริการเสร็จสมบูรณ์`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "🎉 บริการเสร็จสมบูรณ์",
                        weight: "bold",
                        size: "lg",
                        color: "#A8999E",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: "#A8999E"
                    },
                    {
                        type: "text",
                        text: `เรียน ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "lg"
                    },
                    {
                        type: "text",
                        text: `บริการ "${serviceName}" เสร็จสิ้นเรียบร้อยแล้ว`,
                        size: "md",
                        color: "#A8999E",
                        weight: "bold",
                        margin: "sm"
                    },
                    {
                        type: "text",
                        text: "หวังว่าคุณจะพึงพอใจกับบริการของเรา",
                        size: "sm",
                        color: "#666666",
                        wrap: true,
                        margin: "sm"
                    },
                    ...(totalPointsAwarded && totalPointsAwarded > 0 ? [
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                {
                                    type: "text",
                                    text: "พ้อยที่ได้รับ",
                                    size: "md",
                                    color: "#666666",
                                    flex: 0
                                },
                                {
                                    type: "text",
                                    text: `${totalPointsAwarded} พ้อย`,
                                    weight: "bold",
                                    size: "lg",
                                    color: "#A8999E",
                                    align: "end"
                                }
                            ],
                            margin: "lg",
                            paddingAll: "12px",
                            backgroundColor: "#F5F2ED",
                            cornerRadius: "8px"
                        }
                    ] : []),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "ขอบคุณที่ใช้บริการ หากมีข้อเสนอแนะยินดีรับฟังเสมอ",
                                size: "sm",
                                color: "#A8999E",
                                wrap: true,
                                align: "center"
                            }
                        ],
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}