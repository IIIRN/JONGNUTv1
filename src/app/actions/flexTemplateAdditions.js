/**
 * Creates a review thank you Flex Message template
 */
export async function createReviewThankYouFlexTemplate(pointsAwarded = 0) {
    const message = {
        type: "flex",
        altText: `ขอบคุณสำหรับรีวิวค่ะ! ${pointsAwarded > 0 ? `คุณได้รับ ${pointsAwarded} พ้อยต์` : ''}`,
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
                        text: "ขอบคุณสำหรับรีวิว!",
                        weight: "bold",
                        size: "xl",
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
                        text: "ความคิดเห็นของคุณมีความสำคัญอย่างยิ่ง ในการพัฒนาบริการของเราให้ดียิ่งขึ้น",
                        wrap: true,
                        color: "#666666",
                        size: "sm",
                        align: "center",
                        margin: "md"
                    }
                ]
            }
        }
    };

    // Add points section if points awarded
    if (pointsAwarded > 0) {
        message.contents.body.contents.push(
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
                                text: "🎉",
                                size: "xl",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `คุณได้รับ ${pointsAwarded} พ้อยต์จากการรีวิว!`,
                                weight: "bold",
                                color: "#4CAF50",
                                flex: 1,
                                margin: "sm"
                            }
                        ]
                    }
                ]
            }
        );
    }

    return message;
}

/**
 * Creates an appointment reminder Flex Message template
 */
export async function createAppointmentReminderFlexTemplate(bookingData) {
    const { serviceName, appointmentDate, appointmentTime, shopName } = bookingData;

    const message = {
        type: "flex",
        altText: `🔔 แจ้งเตือนการนัดหมาย - ${serviceName} วันที่ ${appointmentDate} เวลา ${appointmentTime}`,
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
                        size: "xl",
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
                                        text: serviceName,
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
                                        text: appointmentDate,
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
                                        text: appointmentTime,
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
                                        text: shopName || "ร้านเสริมสวย",
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
