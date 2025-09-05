"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateQrCodePayload, testPromptPayPayload } from '@/app/actions/paymentActions';
import Image from 'next/image';

function PaymentContent() {
    const [appointment, setAppointment] = useState(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [debugInfo, setDebugInfo] = useState(null);
    const params = useParams();
    const appointmentId = params.appointmentId;

    useEffect(() => {
        if (!appointmentId) {
            setError('ไม่พบ Appointment ID');
            setLoading(false);
            return;
        }

        const fetchAppointmentAndGenerateQR = async () => {
            setLoading(true);
            try {
                const appointmentRef = doc(db, 'appointments', appointmentId);
                const appointmentSnap = await getDoc(appointmentRef);

                if (!appointmentSnap.exists()) {
                    throw new Error('ไม่พบข้อมูลการนัดหมาย');
                }
                
                const appointmentData = { id: appointmentSnap.id, ...appointmentSnap.data() };
                setAppointment(appointmentData);

                console.log('Appointment Data:', appointmentData);
                console.log('Customer Info:', appointmentData.customerInfo);

                // Get PromptPay ID from server-side action
                const response = await fetch('/api/get-promptpay-id');
                const { promptPayId } = await response.json();
                
                if (!promptPayId) {
                    throw new Error('ไม่พบข้อมูลพร้อมเพย์ กรุณาติดต่อผู้ดูแลระบบ');
                }

                const amount = appointmentData.paymentInfo.totalPrice;
                const dataUrl = await generateQrCodePayload(promptPayId, amount);
                
                setQrCodeDataUrl(dataUrl);

                // Test payload for debugging
                const testResult = await testPromptPayPayload(promptPayId, amount);
                setDebugInfo(testResult);

            } catch (err) {
                setError(err.message);
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointmentAndGenerateQR();
    }, [appointmentId]);

    if (loading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p>กำลังสร้าง QR Code...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-10 text-red-500">
                <p className="text-lg font-semibold">เกิดข้อผิดพลาด</p>
                <p>{error}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg"
                >
                    ลองใหม่
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">ใบแจ้งค่าบริการ</h1>
                <p className="text-sm text-gray-500 mb-4">
                    Appointment ID: {appointment?.id.substring(0, 6).toUpperCase()}
                </p>
                
                <div className="my-6">
                    <p className="text-gray-600">ยอดชำระทั้งหมด</p>
                    <p className="text-5xl font-bold text-slate-800">
                        {appointment?.paymentInfo.totalPrice.toLocaleString()}
                        <span className="text-2xl font-medium ml-1">บาท</span>
                    </p>
                </div>
                
                {qrCodeDataUrl && (
                    <div className="flex justify-center my-6">
                         <Image 
                            src={qrCodeDataUrl} 
                            alt="PromptPay QR Code" 
                            width={250} 
                            height={250} 
                            className="border-2 border-gray-200 rounded-lg"
                         />
                    </div>
                )}
                
                <p className="text-gray-600 mb-4">
                    สแกน QR Code นี้เพื่อชำระเงินผ่านแอปพลิเคชันของธนาคาร
                </p>

                {appointment && (
                    <div className="mt-6 text-left bg-gray-50 p-4 rounded-lg text-sm">
                        <h3 className="font-semibold mb-2">สรุปรายการ</h3>
                        <p><strong>ลูกค้า:</strong> {appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ไม่ระบุ'}</p>
                        <p><strong>บริการ:</strong> {appointment.serviceInfo?.name || 'ไม่ระบุ'}</p>
                        <p><strong>วันที่:</strong> {appointment.appointmentInfo?.dateTime?.toDate()?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}</p>
                        <p><strong>เวลา:</strong> {appointment.appointmentInfo?.dateTime?.toDate()?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) || 'ไม่ระบุ'}</p>
                    </div>
                )}

                {/* Debug Information */}
                {debugInfo && (
                    <div className="mt-4 text-left bg-yellow-50 p-3 rounded-lg text-xs">
                        <h4 className="font-semibold mb-1">Debug Info:</h4>
                        <p><strong>Payload:</strong> {debugInfo.payload.substring(0, 50)}...</p>
                        <div className="mt-1">
                            <strong>Validations:</strong>
                            {Object.entries(debugInfo.validations).map(([key, value]) => (
                                <div key={key} className={`text-xs ${value ? 'text-green-600' : 'text-red-600'}`}>
                                    {key}: {value ? '✓' : '✗'}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Main component that wraps PaymentContent with Suspense
export default function PaymentPage() {
    return (
        <Suspense fallback={
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p>กำลังโหลด...</p>
            </div>
        }>
            <PaymentContent />
        </Suspense>
    );
}