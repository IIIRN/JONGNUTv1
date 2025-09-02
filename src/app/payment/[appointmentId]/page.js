"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateQrCodePayload } from '@/app/actions/paymentActions';
import Image from 'next/image';

// --- !! สำคัญมาก !! ---
// --- ใส่เบอร์ PromptPay ของคุณที่นี่ ---
const PROMPTPAY_ID = '0623733306'; // <--- แก้ไขตรงนี้

export default function PaymentPage({ params }) {
    const [appointment, setAppointment] = useState(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ใช้ React.use() สำหรับ Next.js 15+ เพื่อ unwrap params
    const { appointmentId } = React.use(params);

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

                console.log('PROMPTPAY_ID:', PROMPTPAY_ID);
                console.log('Appointment ID:', appointmentId);

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

    if (loading) {
        return (
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p>กำลังสร้าง QR Code สำหรับชำระเงิน...</p>
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
        <div className="bg-gray-100 max-w-md mx-auto rounded-2xl shadow-lg  ">
            <div className="p-6 text-center">
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
                        <p><strong>ลูกค้า:</strong> {appointment.customerInfo.name}</p>
                        <p><strong>บริการ:</strong> {appointment.serviceInfo.name}</p>
                        <p><strong>วันที่:</strong> {appointment.appointmentInfo.dateTime.toDate().toLocaleDateString('th-TH')}</p>
                        <p><strong>เวลา:</strong> {appointment.appointmentInfo.dateTime.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                )}

                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                >
                    รีเฟรชหน้า
                </button>
            </div>
        </div>
    );
}