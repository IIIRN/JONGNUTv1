"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin';

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

// ฟังก์ชันสร้าง Flex Message แบบสวยงามตามรูปแบบแอป
function createFlexMessage(type, data) {
  const primaryColor = "#A8999E";
  const primaryDark = "#7F7679";
  const successColor = "#4CAF50";
  const errorColor = "#F28A8A";
  
  switch (type) {
    case 'appointmentConfirmed':
      return {
        type: "flex",
        altText: "การนัดหมายได้รับการยืนยัน",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: data.pointsAwarded ? "✨ บริการเสร็จสิ้น" : "✅ ยืนยันการนัดหมาย",
                weight: "bold",
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: successColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: data.serviceName || "บริการ",
                weight: "bold",
                size: "xl",
                color: primaryDark,
                margin: "md"
              },
              {
                type: "separator",
                margin: "lg"
              },
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "📅 วันที่:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.date || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "⏰ เวลา:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.time || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  }
                ].concat(data.pointsAwarded && data.pointsAwarded > 0 ? [
                  {
                    type: "separator",
                    margin: "lg"
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "🎉 แต้มที่ได้รับ:",
                        color: successColor,
                        size: "sm",
                        flex: 2,
                        weight: "bold"
                      },
                      {
                        type: "text",
                        text: `${data.pointsAwarded} แต้ม`,
                        wrap: true,
                        color: successColor,
                        size: "lg",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  }
                ] : [])
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: data.pointsAwarded ? "ขอบคุณที่ใช้บริการค่ะ ✨" : "ขอบคุณที่ใช้บริการค่ะ ✨",
                color: primaryColor,
                size: "sm",
                align: "center"
              }
            ]
          }
        }
      };

    case 'appointmentCancelled':
      return {
        type: "flex",
        altText: "การนัดหมายถูกยกเลิก",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "❌ ยกเลิกการนัดหมาย",
                weight: "bold",
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: errorColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "ขออภัยค่ะ",
                weight: "bold",
                size: "lg",
                color: primaryDark
              },
              {
                type: "text",
                text: data.message || "การนัดหมายของคุณถูกยกเลิก",
                wrap: true,
                color: "#333333",
                margin: "md"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "หากต้องการข้อมูลเพิ่มเติม กรุณาติดต่อแอดมิน",
                color: primaryColor,
                size: "sm",
                wrap: true,
                align: "center"
              }
            ]
          }
        }
      };

    case 'paymentReceived':
    case 'paymentInvoice':
      return {
        type: "flex",
        altText: type === 'paymentReceived' ? "ได้รับการชำระเงิน" : "ใบแจ้งค่าบริการ",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: type === 'paymentReceived' ? "💳 ชำระเงินสำเร็จ" : "💰 ใบแจ้งค่าบริการ",
                weight: "bold",
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: type === 'paymentReceived' ? successColor : primaryColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: data.serviceName || "บริการ",
                weight: "bold",
                size: "xl",
                color: primaryDark
              },
              {
                type: "separator",
                margin: "lg"
              },
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "📅 วันที่:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.date || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "💰 ยอดเงิน:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: `${(data.amount || data.totalPrice || 0).toLocaleString()} บาท`,
                        wrap: true,
                        color: "#333333",
                        size: "lg",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: type === 'paymentInvoice' && data.paymentUrl ? [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "ชำระเงิน",
                  uri: data.paymentUrl
                },
                style: "primary",
                color: primaryColor
              }
            ] : [
              {
                type: "text",
                text: type === 'paymentReceived' ? "ขอบคุณที่ใช้บริการค่ะ ✨" : data.paymentUrl ? "กรุณาคลิกปุ่มเพื่อชำระเงิน" : "ขอบคุณค่ะ",
                color: primaryColor,
                size: "sm",
                wrap: true,
                align: "center"
              }
            ]
          }
        }
      };

    case 'reviewRequest':
      return {
        type: "flex",
        altText: "ขอรีวิวบริการ",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "⭐ รีวิวบริการ",
                weight: "bold",
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: primaryColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "รบกวนสละเวลารีวิวบริการ",
                weight: "bold",
                size: "lg",
                color: primaryDark
              },
              {
                type: "text",
                text: "เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น",
                wrap: true,
                color: "#333333",
                margin: "md"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: data.reviewUrl ? [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "รีวิวเลย",
                  uri: data.reviewUrl
                },
                style: "primary",
                color: primaryColor
              }
            ] : [
              {
                type: "text",
                text: "ขอบคุณค่ะ",
                color: primaryColor,
                size: "sm",
                align: "center"
              }
            ]
          }
        }
      };

    case 'appointmentReminder':
      return {
        type: "flex",
        altText: "แจ้งเตือนการนัดหมาย",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🔔 แจ้งเตือนการนัดหมาย",
                weight: "bold",
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: primaryColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "อีก 1 ชั่วโมงจะถึงเวลานัดหมาย",
                weight: "bold",
                size: "lg",
                color: primaryDark
              },
              {
                type: "separator",
                margin: "lg"
              },
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "💅 บริการ:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.serviceName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "📅 วันที่:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.appointmentDate || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "⏰ เวลา:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.appointmentTime || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "กรุณามาตรงเวลานะคะ ✨",
                color: primaryColor,
                size: "sm",
                align: "center"
              }
            ]
          }
        }
      };

    default:
      // Fallback เป็นข้อความธรรมดา
      return {
        type: "text",
        text: data.message || "ข้อความจากระบบ"
      };
  }
}

// ฟังก์ชันสร้าง Admin Flex Message 
function createAdminFlexMessage(type, data) {
  const primaryColor = "#A8999E";
  const primaryDark = "#7F7679"; 
  const successColor = "#4CAF50";
  const warningColor = "#FBC02D";
  const errorColor = "#F28A8A";
  
  switch (type) {
    case 'newBooking':
      return {
        type: "flex",
        altText: "การจองใหม่",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🆕 การจองใหม่",
                weight: "bold", 
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: successColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "👤 ลูกค้า:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.customerName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm", 
                    contents: [
                      {
                        type: "text",
                        text: "💅 บริการ:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.serviceName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "📅 วันที่:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.appointmentDate || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "⏰ เวลา:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.appointmentTime || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "💰 ราคา:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: `${(data.totalPrice || 0).toLocaleString()} บาท`,
                        wrap: true,
                        color: successColor,
                        size: "lg",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

    case 'paymentReceived':
      return {
        type: "flex",
        altText: "ได้รับการชำระเงิน",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "💳 ได้รับการชำระเงิน",
                weight: "bold",
                color: "#FFFFFF", 
                size: "lg"
              }
            ],
            backgroundColor: successColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "👤 ลูกค้า:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.customerName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "💅 บริการ:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.serviceName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "💰 จำนวน:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: `${(data.totalPrice || 0).toLocaleString()} บาท`,
                        wrap: true,
                        color: successColor,
                        size: "lg",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "📅 วันที่จอง:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: `${data.appointmentDate} ${data.appointmentTime}` || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

    case 'bookingCancelled':
    case 'customerConfirmed':
      const isConfirmed = type === 'customerConfirmed';
      return {
        type: "flex",
        altText: isConfirmed ? "ลูกค้ายืนยันนัดหมาย" : "ยกเลิกการจอง",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: isConfirmed ? "✅ ลูกค้ายืนยันนัดหมาย" : "❌ ยกเลิกการจอง",
                weight: "bold",
                color: "#FFFFFF",
                size: "lg"
              }
            ],
            backgroundColor: isConfirmed ? successColor : errorColor,
            paddingAll: "20px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "👤 ลูกค้า:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.customerName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        weight: "bold",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "💅 บริการ:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.serviceName || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "📅 วันที่:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.appointmentDate || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "⏰ เวลา:",
                        color: primaryColor,
                        size: "sm",
                        flex: 2
                      },
                      {
                        type: "text",
                        text: data.appointmentTime || "-",
                        wrap: true,
                        color: "#333333",
                        size: "sm",
                        flex: 5
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

    default:
      // Fallback เป็นข้อความธรรมดา
      return {
        type: "text",
        text: data.message || "การแจ้งเตือนจากระบบ"
      };
  }
}

/**
 * Fetches and returns the notification settings object.
 */
async function getNotificationSettings() {
  try {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    
    if (settingsDoc.exists) {
      return settingsDoc.data();
    }
    
    // Default settings if document doesn't exist
    return {
      allNotifications: { enabled: true },
      adminNotifications: { enabled: true, newBooking: true, bookingCancelled: true, paymentReceived: true, customerConfirmed: true },
      customerNotifications: { enabled: true, appointmentConfirmed: true, appointmentCancelled: true, appointmentReminder: true, reviewRequest: true, paymentInvoice: true },
    };
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    // Return default enabled settings on error to avoid blocking critical notifications
    return {
      allNotifications: { enabled: true },
      adminNotifications: { enabled: true },
      customerNotifications: { enabled: true },
    };
  }
}

/**
 * Sends a push message to a single LINE user, checking customer notification settings first.
 * Supports both text and flex messages.
 */
export async function sendLineMessage(to, messageText, notificationType, flexData = null) {
  if (!to || (!messageText && !flexData)) {
    console.error("Missing 'to' or message content");
    return { success: false, error: "Missing recipient or message." };
  }
  
  const settings = await getNotificationSettings();
  if (!settings.allNotifications?.enabled || !settings.customerNotifications?.enabled || (notificationType && !settings.customerNotifications[notificationType])) {
      console.log(`Customer LINE notifications are disabled for type: ${notificationType || 'general'}. Skipping message.`);
      return { success: true, message: "Customer notifications disabled for this type." };
  }

  try {
    let messageObject;
    
    // ถ้ามี flexData ให้สร้าง Flex Message
    if (flexData && notificationType) {
      messageObject = createFlexMessage(notificationType, flexData);
    } else {
      // ใช้ข้อความธรรมดา
      messageObject = { type: 'text', text: messageText };
    }
    
    await client.pushMessage(to, messageObject);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send message to ${to}:`, error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Sends a multicast message to all registered admins, checking admin notification settings first.
 * Supports both text and flex messages.
 */
export async function sendLineMessageToAllAdmins(messageText, notificationType = null, flexData = null) {
  const settings = await getNotificationSettings();
  if (!settings.allNotifications?.enabled || !settings.adminNotifications?.enabled) {
      console.log("Admin LINE notifications are disabled. Skipping message.");
      return { success: true, message: "Admin notifications disabled." };
  }

  try {
    const adminsQuery = db.collection('admins').where("lineUserId", "!=", null);
    const adminSnapshot = await adminsQuery.get();

    if (adminSnapshot.empty) {
      console.warn("No admins with lineUserId found to notify.");
      return { success: true, message: "No admins to notify." };
    }

    const adminLineIds = adminSnapshot.docs.map(doc => doc.data().lineUserId);

    if (adminLineIds.length > 0) {
      let messageObject;
      
      // ถ้ามี flexData ให้สร้าง Admin Flex Message
      if (flexData && notificationType) {
        messageObject = createAdminFlexMessage(notificationType, flexData);
      } else {
        messageObject = { type: 'text', text: messageText };
      }
      
      await client.multicast(adminLineIds, [messageObject]);
      console.log(`Successfully sent multicast notification to ${adminLineIds.length} admins.`);
    }

    return { success: true };

  } catch (error) {
    console.error('Error sending multicast message to admins:', error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}

/**
 * Send booking notification to admins
 */
export async function sendBookingNotification(bookingData, notificationType) {
  const settings = await getNotificationSettings();
  if (!settings.allNotifications?.enabled || !settings.adminNotifications?.enabled || !settings.adminNotifications?.[notificationType]) {
    console.log(`Admin notification type "${notificationType}" is disabled.`);
    return { success: true, message: "Notification type disabled for admins." };
  }

  const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = bookingData;
  
  // ใช้ Flex Message สำหรับ Admin
  const flexData = {
    customerName,
    serviceName,
    appointmentDate,
    appointmentTime,
    totalPrice
  };

  return await sendLineMessageToAllAdmins(null, notificationType, flexData);
}

/**
 * Send reminder notification to customer
 */
export async function sendReminderNotification(customerLineId, bookingData) {
    const flexData = {
        serviceName: bookingData.serviceName,
        appointmentDate: bookingData.appointmentDate,
        appointmentTime: bookingData.appointmentTime,
        shopName: bookingData.shopName || 'ร้านเสริมสวย'
    };
    
    return await sendLineMessage(customerLineId, null, 'appointmentReminder', flexData);
}