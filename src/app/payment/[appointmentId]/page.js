'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import QRCode from 'qrcode';
// V V V V V V V V V V V V V V V V V
// แก้ไขการ import ที่บรรทัดนี้
// V V V V V V V V V V V V V V V V V
import generatePayload from 'promptpay-qr';

export default function PaymentPage() {
    const { appointmentId } = useParams();
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [paymentSettings, setPaymentSettings] = useState(null);

    useEffect(() => {
        const fetchAppointmentAndSettings = async () => {
            if (!appointmentId) {
                setError('ไม่พบรหัสการนัดหมาย');
                setLoading(false);
                return;
            }

            try {
                // Fetch Payment Settings first
                const paymentRef = doc(db, 'settings', 'payment');
                const paymentSnap = await getDoc(paymentRef);
                if (!paymentSnap.exists()) {
                    throw new Error("ไม่พบการตั้งค่าการชำระเงินของร้านค้า");
                }
                const settings = paymentSnap.data();
                setPaymentSettings(settings);

                // Fetch Appointment
                const appointmentRef = doc(db, 'appointments', appointmentId);
                const appointmentSnap = await getDoc(appointmentRef);
                if (!appointmentSnap.exists()) {
                    throw new Error("ไม่พบข้อมูลการนัดหมาย");
                }
                const appointmentData = { id: appointmentSnap.id, ...appointmentSnap.data() };
                setAppointment(appointmentData);

                // Generate QR Code based on settings
                if (settings.method === 'image') {
                    if (!settings.qrCodeImageUrl) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่ารูปภาพ QR Code");
                    }
                    setQrCodeDataUrl(settings.qrCodeImageUrl);
                } else if (settings.method === 'promptpay') {
                    const amount = parseFloat(appointmentData.paymentInfo?.totalPrice);
                    if (isNaN(amount) || amount <= 0) {
                        throw new Error("ยอดชำระของรายการนี้ไม่ถูกต้อง");
                    }
                    if (!settings.promptPayAccount) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่าบัญชี PromptPay");
                    }
                    const payload = generatePayload(settings.promptPayAccount, { amount });
                    const qrCodeUrl = await QRCode.toDataURL(payload, { width: 300 });
                    setQrCodeDataUrl(qrCodeUrl);
                } else {
                    throw new Error("รูปแบบการชำระเงินที่ร้านค้าตั้งค่าไว้ไม่ถูกต้อง");
                }

            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointmentAndSettings();
    }, [appointmentId]);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
                <p className="text-lg">กำลังโหลดข้อมูลการชำระเงิน...</p>
                <p className="text-sm text-gray-500">กรุณารอสักครู่</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-red-50 p-4 text-center">
                <p className="text-xl font-semibold text-red-600">เกิดข้อผิดพลาด</p>
                <p className="text-red-500">{error}</p>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 max-w-md bg-gray-50 min-h-screen">
            <div className="bg-white shadow-xl rounded-lg p-6">
                <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">ชำระเงิน</h1>
                <p className="text-center text-gray-500 mb-4">
                    บริการ: <strong>{appointment?.serviceInfo?.name || 'N/A'}</strong>
                </p>
                
                <div className="text-center mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-md text-blue-800">ยอดชำระทั้งหมด</p>
                    <p className="text-4xl font-bold text-blue-600">
                        {appointment?.paymentInfo?.totalPrice?.toLocaleString() || '0'} บาท
                    </p>
                </div>
                
                {qrCodeDataUrl ? (
                    <div className="flex flex-col items-center p-4 border rounded-lg bg-white">
                        <img src={qrCodeDataUrl} alt="QR Code สำหรับชำระเงิน" className="w-64 h-64 object-contain" />
                        <p className="mt-4 text-gray-800 font-semibold">สแกน QR Code เพื่อชำระเงิน</p>
                        {paymentSettings?.method === 'promptpay' && (
                             <p className="text-sm text-gray-500 mt-1">บัญชี: {paymentSettings.promptPayAccount}</p>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg">
                        <p>ไม่สามารถสร้าง QR Code สำหรับการชำระเงินได้</p>
                        <p className="text-sm">กรุณาติดต่อร้านค้า</p>
                    </div>
                )}

                <div className="mt-6 text-center bg-yellow-100 border border-yellow-300 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">
                        ✨ หลังจากชำระเงินแล้ว กรุณาแนบสลิปเพื่อยืนยันการชำระเงินผ่านทาง LINE OA ของเรานะคะ
                    </p>
                </div>
            </div>
        </div>
    );
}