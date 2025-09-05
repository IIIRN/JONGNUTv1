// src/app/payment/[appointmentId]/page.js
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { generateQrCodePayload } from '@/app/actions/paymentActions';
import { updatePaymentStatus } from '@/app/actions/paymentActions';
import Image from 'next/image';

function PaymentContent() {
    const { liff, profile, loading: liffLoading } = useLiffContext();
    const [appointment, setAppointment] = useState(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('unpaid');
    const [isProcessing, setIsProcessing] = useState(false);
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
                setPaymentStatus(appointmentData.paymentInfo?.paymentStatus || 'unpaid');

                // ถ้าชำระเงินแล้วก็ไม่ต้องสร้าง QR Code
                if (appointmentData.paymentInfo?.paymentStatus === 'paid') {
                    setLoading(false);
                    return;
                }

                const PROMPTPAY_ID = process.env.NEXT_PUBLIC_PROMPTPAY_ID; 
                if (!PROMPTPAY_ID) {
                    throw new Error('ไม่พบข้อมูลพร้อมเพย์ กรุณาติดต่อผู้ดูแลระบบ');
                }

                const amount = appointmentData.paymentInfo.totalPrice;
                const dataUrl = await generateQrCodePayload(PROMPTPAY_ID, amount);
                setQrCodeDataUrl(dataUrl);

            } catch (err) {
                setError(err.message);
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointmentAndGenerateQR();
    }, [appointmentId]);

    const handlePaymentConfirmation = async () => {
        if (!liff || !profile || !appointment) {
            setError('ไม่สามารถดำเนินการได้ กรุณาเปิดใน LINE');
            return;
        }

        setIsProcessing(true);
        try {
            // อัปเดตสถานะการชำระเงิน
            const result = await updatePaymentStatus(appointmentId, 'paid', {
                paidAt: new Date(),
                paidBy: profile.userId,
                paymentMethod: 'promptpay'
            });

            if (result.success) {
                setPaymentStatus('paid');
                
                // ส่งข้อความกลับ LINE OA
                if (liff.isInClient()) {
                    try {
                        await liff.sendMessages([
                            {
                                type: 'text',
                                text: `✅ ชำระเงินเรียบร้อยแล้ว\n💰 ยอดเงิน: ${appointment.paymentInfo.totalPrice.toLocaleString()} บาท\n📝 การนัดหมาย: ${appointmentId.substring(0, 6).toUpperCase()}\n\nขอบคุณที่ใช้บริการ!`
                            }
                        ]);
                    } catch (msgError) {
                        console.warn('ไม่สามารถส่งข้อความได้:', msgError);
                    }
                }
                
                // ปิด LIFF หลังจากสำเร็จ
                setTimeout(() => {
                    if (liff && liff.closeWindow) {
                        liff.closeWindow();
                    }
                }, 2000);
            } else {
                throw new Error(result.error || 'ไม่สามารถอัปเดตสถานะการชำระเงินได้');
            }
        } catch (err) {
            setError(err.message);
            console.error('Error updating payment:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = () => {
        if (liff && liff.closeWindow) {
            liff.closeWindow();
        }
    };

    if (liffLoading || loading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p>กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <div className="text-red-600 text-lg font-semibold mb-2">เกิดข้อผิดพลาด</div>
                <p className="text-red-500 mb-4">{error}</p>
                <button 
                    onClick={handleCancel}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                    ปิดหน้าต่าง
                </button>
            </div>
        );
    }

    // แสดงหน้าสำเร็จถ้าชำระเงินแล้ว
    if (paymentStatus === 'paid') {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-green-600 text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">ชำระเงินเรียบร้อย</h2>
                <p className="text-green-700 mb-4">
                    ยอดเงิน: {appointment?.paymentInfo.totalPrice.toLocaleString()} บาท
                </p>
                <p className="text-green-600 text-sm mb-6">
                    การนัดหมายของคุณได้รับการยืนยันแล้ว
                </p>
                <button 
                    onClick={handleCancel}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                >
                    ปิดหน้าต่าง
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">ใบแจ้งค่าบริการ</h1>
                <p className="text-sm text-gray-500 mb-4">
                    รหัสการนัดหมาย: {appointment?.id.substring(0, 8).toUpperCase()}
                </p>
                
                {/* Service Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                    <h3 className="font-semibold text-gray-800 mb-2">รายละเอียดบริการ</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>บริการหลัก:</span>
                            <span>{appointment?.serviceInfo.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>ราคาหลัก:</span>
                            <span>{appointment?.paymentInfo.basePrice?.toLocaleString()} บาท</span>
                        </div>
                        {appointment?.paymentInfo.addOnsTotal > 0 && (
                            <div className="flex justify-between">
                                <span>บริการเสริม:</span>
                                <span>{appointment?.paymentInfo.addOnsTotal?.toLocaleString()} บาท</span>
                            </div>
                        )}
                        <hr className="my-2"/>
                        <div className="flex justify-between font-semibold text-gray-800">
                            <span>ยอดรวม:</span>
                            <span>{appointment?.paymentInfo.totalPrice.toLocaleString()} บาท</span>
                        </div>
                    </div>
                </div>

                <div className="my-6">
                    <p className="text-gray-600 mb-2">สแกน QR Code เพื่อชำระเงิน</p>
                    <p className="text-3xl font-bold text-green-600">
                        {appointment?.paymentInfo.totalPrice.toLocaleString()}
                        <span className="text-lg font-medium ml-1">บาท</span>
                    </p>
                </div>

                {qrCodeDataUrl && (
                    <div className="flex justify-center my-6">
                         <Image 
                            src={qrCodeDataUrl} 
                            alt="PromptPay QR Code" 
                            width={250} 
                            height={250} 
                            className="border-2 border-gray-200 rounded-lg shadow-md"
                         />
                    </div>
                )}

                <p className="text-gray-600 text-sm mb-6">
                    สแกน QR Code นี้เพื่อชำระเงินผ่านแอปพลิเคชันธนาคาร หรือแอป True Money Wallet
                </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
                <button
                    onClick={handlePaymentConfirmation}
                    disabled={isProcessing}
                    className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'กำลังดำเนินการ...' : '✅ ยืนยันการชำระเงิน'}
                </button>

                <button
                    onClick={handleCancel}
                    className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600"
                >
                    ยกเลิก
                </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                    💡 <strong>คำแนะนำ:</strong> หลังจากชำระเงินเรียบร้อยแล้ว กรุณากดปุ่ม "ยืนยันการชำระเงิน" 
                    เพื่อแจ้งให้ทางร้านทราบ
                </p>
            </div>
        </div>
    );
}

// Main component that wraps PaymentContent with Suspense
export default function PaymentPage() {
    return (
        <Suspense fallback={
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p>กำลังโหลด...</p>
            </div>
        }>
            <PaymentContent />
        </Suspense>
    );
}