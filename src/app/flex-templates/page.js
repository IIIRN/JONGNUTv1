"use client";

import { useState } from 'react';
import { createPaymentFlexTemplate, createReviewFlexTemplate, createPaymentConfirmationFlexTemplate, createReviewThankYouFlexTemplate } from '@/app/actions/flexTemplateActions';

// ข้อมูลตัวอย่างสำหรับทดสอบ
const mockAppointmentData = {
    id: "mock-appointment-123456",
    serviceInfo: {
        name: "ตัดผมเท่ + สไตลิ่ง"
    },
    paymentInfo: {
        totalPrice: 850
    },
    date: "2025-09-08",
    time: "14:30",
    appointmentInfo: {
        beauticianInfo: {
            firstName: "สุดา",
            lastName: "เสริมสวย"
        }
    }
};

const mockReviewData = {
    rating: 5,
    comment: "บริการดีมาก ช่างใส่ใจ และทำได้สวยงาม แนะนำให้เพื่อนๆ มาใช้บริการ",
    appointmentId: "mock-appointment-123456"
};

export default function FlexTemplatePage() {
    const [selectedTemplate, setSelectedTemplate] = useState('payment');
    const [flexMessage, setFlexMessage] = useState(null);

    const generateFlexTemplate = (templateType) => {
        let template;
        
        switch (templateType) {
            case 'payment':
                template = createPaymentFlexTemplate(mockAppointmentData);
                break;
            case 'review':
                template = createReviewFlexTemplate(mockAppointmentData);
                break;
            case 'paymentConfirmation':
                template = createPaymentConfirmationFlexTemplate(mockAppointmentData);
                break;
            case 'reviewThankYou':
                template = createReviewThankYouFlexTemplate(mockReviewData);
                break;
            default:
                template = null;
        }
        
        setFlexMessage(template);
        setSelectedTemplate(templateType);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">🎨 Flex Template Showcase</h1>
                
                {/* Template Selection */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4">เลือก Template ที่ต้องการดู:</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button
                            onClick={() => generateFlexTemplate('payment')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                selectedTemplate === 'payment' 
                                    ? 'border-pink-500 bg-pink-50 text-pink-700' 
                                    : 'border-gray-200 hover:border-pink-300'
                            }`}
                        >
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-semibold">Payment</div>
                            <div className="text-sm text-gray-500">หน้าชำระเงิน</div>
                        </button>
                        
                        <button
                            onClick={() => generateFlexTemplate('review')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                selectedTemplate === 'review' 
                                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                                    : 'border-gray-200 hover:border-purple-300'
                            }`}
                        >
                            <div className="text-2xl mb-2">⭐</div>
                            <div className="font-semibold">Review</div>
                            <div className="text-sm text-gray-500">หน้ารีวิว</div>
                        </button>
                        
                        <button
                            onClick={() => generateFlexTemplate('paymentConfirmation')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                selectedTemplate === 'paymentConfirmation' 
                                    ? 'border-green-500 bg-green-50 text-green-700' 
                                    : 'border-gray-200 hover:border-green-300'
                            }`}
                        >
                            <div className="text-2xl mb-2">✅</div>
                            <div className="font-semibold">Payment Success</div>
                            <div className="text-sm text-gray-500">ชำระเงินสำเร็จ</div>
                        </button>
                        
                        <button
                            onClick={() => generateFlexTemplate('reviewThankYou')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                selectedTemplate === 'reviewThankYou' 
                                    ? 'border-orange-500 bg-orange-50 text-orange-700' 
                                    : 'border-gray-200 hover:border-orange-300'
                            }`}
                        >
                            <div className="text-2xl mb-2">🎉</div>
                            <div className="font-semibold">Review Thanks</div>
                            <div className="text-sm text-gray-500">ขอบคุณรีวิว</div>
                        </button>
                    </div>
                </div>

                {/* Preview Section */}
                {flexMessage && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Visual Preview */}
                        <div className="bg-gray-100 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-700 mb-4">📱 ตัวอย่างในมือถือ</h3>
                            <div className="bg-white rounded-lg shadow-md p-4 max-w-sm mx-auto">
                                {/* Mock LINE Chat Interface */}
                                <div className="text-center text-gray-500 text-sm mb-4">LINE Chat Preview</div>
                                
                                {/* Flex Message Visual Representation */}
                                <div className="border rounded-lg overflow-hidden">
                                    {/* Header */}
                                    {flexMessage.contents.header && (
                                        <div 
                                            className="p-4 text-white"
                                            style={{ backgroundColor: flexMessage.contents.header.backgroundColor }}
                                        >
                                            <div className="font-bold text-lg">
                                                {flexMessage.contents.header.contents[0].contents[0].text}
                                            </div>
                                            <div className="text-sm opacity-90">
                                                {flexMessage.contents.header.contents[0].contents[1].text}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Body */}
                                    <div className="p-4 bg-white">
                                        <div className="text-sm text-gray-600">
                                            📋 {flexMessage.altText}
                                        </div>
                                    </div>
                                    
                                    {/* Footer */}
                                    {flexMessage.contents.footer && (
                                        <div className="p-4 bg-gray-50 border-t">
                                    {flexMessage.contents.footer.contents.map((content, index) => (
                                                content.type === 'button' && (
                                                    <div key={index} className="mb-2">
                                                        <div 
                                                            className="bg-blue-500 text-white text-center py-2 px-4 rounded-md text-sm font-semibold"
                                                        >
                                                            {content.action.label}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1 break-all">
                                                            🔗 {content.action.uri}
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* JSON Code */}
                        <div className="bg-gray-900 rounded-lg p-4 text-white">
                            <h3 className="text-lg font-semibold text-gray-200 mb-4">🔧 JSON Code</h3>
                            <div className="bg-black rounded p-3 overflow-auto max-h-96">
                                <pre className="text-xs text-green-400">
                                    {JSON.stringify(flexMessage, null, 2)}
                                </pre>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(flexMessage, null, 2))}
                                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                            >
                                📋 Copy JSON
                            </button>
                        </div>
                    </div>
                )}

                {/* LIFF URLs Info */}
                <div className="mt-8 bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">🔗 LIFF URLs ที่ใช้ใน Flex Templates</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-green-700">Payment LIFF:</h4>
                            <div className="bg-white p-2 rounded mt-1 font-mono text-xs break-all">
                                https://liff.line.me/{process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID || 'PAYMENT_LIFF_ID'}/[appointmentId]
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-green-700">Review LIFF:</h4>
                            <div className="bg-white p-2 rounded mt-1 font-mono text-xs break-all">
                                https://liff.line.me/{process.env.NEXT_PUBLIC_REVIEW_LIFF_ID || 'REVIEW_LIFF_ID'}/[appointmentId]
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-green-600">
                        💡 Flex Templates ใช้ LIFF URLs โดยตรง ไม่ผ่าน domain ของเว็บไซต์
                    </div>
                </div>

                {/* Mock Data Section */}
                <div className="mt-8 bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">📊 ข้อมูลตัวอย่างที่ใช้ทดสอบ</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-blue-700">Appointment Data:</h4>
                            <pre className="bg-white p-2 rounded mt-1 text-xs">
                                {JSON.stringify(mockAppointmentData, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-700">Review Data:</h4>
                            <pre className="bg-white p-2 rounded mt-1 text-xs">
                                {JSON.stringify(mockReviewData, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Features */}
                <div className="mt-8 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">🌟 Flex Template Features</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-semibold text-pink-700 mb-2">💰 Payment Template</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• แสดงข้อมูลการนัดหมายครบถ้วน</li>
                                <li>• ยอดเงินที่ต้องชำระเด่นชัด</li>
                                <li>• ปุ่มลิงก์ไปหน้าชำระเงิน</li>
                                <li>• ธีมสีชมพูสำหรับการชำระเงิน</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-purple-700 mb-2">⭐ Review Template</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• การแสดงดาวสำหรับการให้คะแนน</li>
                                <li>• ข้อมูลบริการที่ใช้</li>
                                <li>• ปุ่มลิงก์ไปหน้ารีวิว</li>
                                <li>• ธีมสีม่วงสำหรับการรีวิว</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
