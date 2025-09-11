'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function TestFlexPage() {
    const [userId, setUserId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const searchParams = useSearchParams();

    useEffect(() => {
        // Get URL parameters
        const userIdParam = searchParams.get('userId');
        const nameParam = searchParams.get('name');
        
        if (userIdParam) {
            setUserId(userIdParam);
        }
        if (nameParam) {
            setCustomerName(nameParam);
        }
    }, [searchParams]);

    const testMessages = [
        {
            id: 'new-booking',
            name: 'การจองใหม่',
            action: 'testNewBooking',
            data: {
                id: 'test-booking-001',
                serviceInfo: { name: 'ทำเล็บเจล' },
                customerInfo: { fullName: 'คุณทดสอบ' },
                date: new Date().toISOString(),
                time: '14:00'
            }
        },
        {
            id: 'appointment-confirmed',
            name: 'ยืนยันการจอง',
            action: 'testAppointmentConfirmed',
            data: {
                id: 'test-booking-001',
                serviceInfo: { name: 'ทำเล็บเจล' },
                customerInfo: { fullName: 'คุณทดสอบ' },
                date: new Date().toISOString(),
                time: '14:00',
                appointmentInfo: { beautician: 'คุณช่างทดสอบ' }
            }
        },
        {
            id: 'payment-request',
            name: 'แจ้งชำระเงิน',
            action: 'testPaymentRequest',
            data: {
                id: 'test-booking-001',
                serviceInfo: { name: 'ทำเล็บเจล', price: 800 },
                customerInfo: { fullName: 'คุณทดสอบ' },
                date: new Date().toISOString(),
                time: '14:00'
            }
        },
        {
            id: 'service-completed',
            name: 'บริการเสร็จสิ้น',
            action: 'testServiceCompleted',
            data: {
                id: 'test-booking-001',
                serviceInfo: { name: 'ทำเล็บเจล' },
                customerInfo: { fullName: 'คุณทดสอบ' },
                totalPointsAwarded: 50
            }
        },
        {
            id: 'review-request',
            name: 'ขอรีวิว',
            action: 'testReviewRequest',
            data: {
                id: 'test-booking-001',
                serviceInfo: { name: 'ทำเล็บเจล' },
                customerInfo: { fullName: 'คุณทดสอบ' },
                date: new Date().toISOString(),
                time: '14:00'
            }
        },
        {
            id: 'appointment-reminder',
            name: 'เตือนนัดหมาย',
            action: 'testAppointmentReminder',
            data: {
                id: 'test-booking-001',
                serviceInfo: { name: 'ทำเล็บเจล' },
                customerInfo: { fullName: 'คุณทดสอบ' },
                date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                time: '14:00'
            }
        }
    ];

    const sendTestMessage = async (messageType) => {
        if (!userId.trim()) {
            alert('กรุณาใส่ LINE User ID');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/test-flex', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: messageType.action,
                    userId: userId.trim(),
                    data: messageType.data
                }),
            });

            const result = await response.json();
            
            setResults(prev => [{
                id: Date.now(),
                type: messageType.name,
                success: result.success,
                message: result.message || result.error,
                timestamp: new Date().toLocaleTimeString('th-TH')
            }, ...prev]);

        } catch (error) {
            console.error('Error sending test message:', error);
            setResults(prev => [{
                id: Date.now(),
                type: messageType.name,
                success: false,
                message: error.message,
                timestamp: new Date().toLocaleTimeString('th-TH')
            }, ...prev]);
        } finally {
            setLoading(false);
        }
    };

    const clearResults = () => {
        setResults([]);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        🧪 ทดสอบ Flex Messages
                    </h1>
                    {customerName && (
                        <p className="text-lg text-blue-600 mb-6">
                            กำลังทดสอบสำหรับ: <span className="font-semibold">{customerName}</span>
                        </p>
                    )}

                    {/* User ID Input */}
                    <div className="mb-8">
                        <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                            LINE User ID สำหรับทดสอบ
                        </label>
                        <input
                            type="text"
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="ใส่ LINE User ID ที่ต้องการทดสอบ"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            * ต้องเป็น LINE User ID ที่เพิ่มเป็นเพื่อนกับ LINE Bot แล้ว
                        </p>
                    </div>

                    {/* Test Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {testMessages.map((messageType) => (
                            <button
                                key={messageType.id}
                                onClick={() => sendTestMessage(messageType)}
                                disabled={loading || !userId.trim()}
                                className="flex flex-col items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <span className="text-lg font-semibold text-blue-900 mb-1">
                                    {messageType.name}
                                </span>
                                <span className="text-sm text-blue-600">
                                    {messageType.id}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    📊 ผลการทดสอบ
                                </h2>
                                <button
                                    onClick={clearResults}
                                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                                >
                                    ล้างผลลัพธ์
                                </button>
                            </div>
                            <div className="space-y-3">
                                {results.map((result) => (
                                    <div
                                        key={result.id}
                                        className={`p-4 rounded-lg border-l-4 ${
                                            result.success 
                                                ? 'bg-green-50 border-green-400' 
                                                : 'bg-red-50 border-red-400'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className={`font-semibold ${
                                                    result.success ? 'text-green-900' : 'text-red-900'
                                                }`}>
                                                    {result.success ? '✅' : '❌'} {result.type}
                                                </p>
                                                <p className={`text-sm ${
                                                    result.success ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                    {result.message}
                                                </p>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {result.timestamp}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-blue-600">กำลังส่งข้อความ...</span>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-8">
                        <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                            📋 วิธีการใช้งาน
                        </h3>
                        <ul className="text-sm text-yellow-800 space-y-1 mb-4">
                            <li>1. ใส่ LINE User ID ของผู้ใช้ที่ต้องการทดสอบ</li>
                            <li>2. กดปุ่มทดสอบแต่ละประเภทข้อความ</li>
                            <li>3. ตรวจสอบผลการส่งในส่วน "ผลการทดสอบ"</li>
                            <li>4. ตรวจสอบข้อความที่ได้รับใน LINE ของผู้ใช้</li>
                        </ul>
                        <div className="flex space-x-2">
                            <a
                                href="/line-users"
                                className="inline-flex items-center px-3 py-1 border border-yellow-600 text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            >
                                👥 ดูรายชื่อลูกค้า LINE
                            </a>
                            <a
                                href="/customers"
                                className="inline-flex items-center px-3 py-1 border border-yellow-600 text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            >
                                📝 จัดการลูกค้า
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
