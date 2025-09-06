// src/app/(employee)/check-in/page.js
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { findAppointmentsByPhone, findAppointmentById, updateAppointmentStatus } from '@/app/actions/employeeActions';
import { updatePaymentStatusByEmployee } from '@/app/actions/employeeActions';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { format, isToday, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { generateQrCodePayload } from '@/app/actions/paymentActions';


// --- Payment QR Code Modal ---
const PaymentQrModal = ({ show, onClose, appointment }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const PROMPTPAY_ID = process.env.NEXT_PUBLIC_PROMPTPAY_ID; // Use environment variable

    useEffect(() => {
        if (show && appointment) {
            const generateQR = async () => {
                setLoading(true);
                try {
                    const amount = appointment.paymentInfo.totalPrice;
                    const url = await generateQrCodePayload(PROMPTPAY_ID, amount);
                    setQrCodeUrl(url);
                } catch (error) {
                    console.error("Error generating payment QR code:", error);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointment, PROMPTPAY_ID]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-1 text-gray-800">Scan to Pay</h2>
                <p className="text-2xl font-bold text-blue-600 mb-3">{appointment.paymentInfo.totalPrice?.toLocaleString()} THB</p>
                {loading ? (
                    <div className="h-48 flex items-center justify-center"><p>กำลังสร้าง QR Code...</p></div>
                ) : (
                    <div className="flex justify-center">
                        {qrCodeUrl && <Image src={qrCodeUrl} alt="Payment QR Code" width={256} height={256} />}
                    </div>
                )}
                <button onClick={onClose} className="mt-4 w-full bg-gray-200 text-gray-800 py-2 rounded-xl font-semibold">ปิด</button>
            </div>
        </div>
    );
};


// --- Appointment Card (Updated) ---
const AppointmentCard = ({ appointment, onConfirm, onUpdatePayment, onShowPaymentQr }) => {
    const appointmentDate = parseISO(appointment.date);
    const isAppointmentToday = isToday(appointmentDate);
    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const now = new Date();
    const isFuture = appointmentDate > now;

    return (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{appointment.customerInfo.fullName}</p>
                    <p className="text-sm text-gray-600">{appointment.serviceInfo.name}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {isPaid ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}
                </span>
            </div>
            <div className="text-sm text-gray-700 border-t pt-3">
                <p><strong>วันที่:</strong> {format(appointmentDate, 'dd MMMM yyyy', { locale: th })}</p>
                <p><strong>เวลา:</strong> {appointment.time} น.</p>
                <p><strong>ยอดชำระ:</strong> <span className="font-bold">{appointment.paymentInfo.totalPrice?.toLocaleString()} บาท</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
                 <button
                    onClick={() => onShowPaymentQr(appointment)}
                    className="font-semibold py-2 rounded-lg transition-colors bg-blue-500 text-white hover:bg-blue-600"
                    disabled={isPaid}
                >
                    แสดง QR ชำระเงิน
                </button>
                <button
                    onClick={() => {
                        if (isFuture) {
                            alert('เตือน: คุณกำลังอัปเดตสถานะการชำระเงินก่อนถึงวันนัดหมาย!');
                        }
                        onUpdatePayment(appointment.id);
                    }}
                    className="font-semibold py-2 rounded-lg transition-colors bg-green-500 text-white hover:bg-green-600"
                    disabled={isPaid}
                >
                    {isPaid ? 'ชำระเงินแล้ว' : 'อัปเดตชำระเงิน'}
                </button>
            </div>
            <button
                onClick={() => onConfirm(appointment.id)}
                className={`w-full font-bold py-2 rounded-lg transition-colors mt-2 ${isAppointmentToday ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                disabled={!isAppointmentToday}
            >
                {isAppointmentToday ? 'ยืนยันเข้ารับบริการ' : 'ยังไม่ถึงวันนัด'}
            </button>
        </div>
    );
};


export default function CheckInPage() {
    const { liff, profile, loading: liffLoading } = useLiffContext();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [showPaymentQr, setShowPaymentQr] = useState(false);
    const [selectedAppointmentForQr, setSelectedAppointmentForQr] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!phoneNumber) return;
        const sanitizedPhoneNumber = phoneNumber.replace(/[\s-()]/g, '');
        setLoading(true);
        setMessage('');
        setAppointments([]);
        const result = await findAppointmentsByPhone(sanitizedPhoneNumber);
        if (result.success) {
            if (result.appointments.length > 0) setAppointments(result.appointments);
            else setMessage('ไม่พบการนัดหมายสำหรับเบอร์โทรนี้');
        } else {
            setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        }
        setLoading(false);
    };

    const handleScan = async () => {
        if (!liff || !liff.isInClient()) {
            setMessage('ฟังก์ชันสแกน QR ใช้งานได้บน LINE เท่านั้น');
            return;
        }
        try {
            const result = await liff.scanCodeV2();
            if (result && result.value) {
                setLoading(true);
                setMessage('กำลังค้นหาข้อมูล...');
                const searchResult = await findAppointmentById(result.value);
                if (searchResult.success) {
                    setAppointments([searchResult.appointment]);
                    setMessage('');
                } else {
                    setMessage(`ไม่พบข้อมูล: ${searchResult.error}`);
                }
                setLoading(false);
            }
        } catch (error) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถสแกน QR Code ได้'}`);
        }
    };
    
    const handleConfirmAppointment = async (appointmentId) => {
        if (!profile?.userId) return setMessage("ไม่สามารถระบุตัวตนพนักงานได้");
        if (confirm("ยืนยันการเข้ารับบริการของลูกค้ารายนี้?")) {
            const result = await updateAppointmentStatus(appointmentId, 'in_progress', profile.userId, 'Customer checked in');
            if (result.success) {
                setMessage('ยืนยันการเข้ารับบริการสำเร็จ!');
                setAppointments(prev => prev.filter(app => app.id !== appointmentId));
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
            }
        }
    };

    const handleUpdatePayment = async (appointmentId) => {
        if (!profile?.userId) return setMessage("ไม่สามารถระบุตัวตนพนักงานได้");
        if (confirm("ยืนยันว่าได้รับชำระเงินแล้วใช่หรือไม่?")) {
            setLoading(true);
            const result = await updatePaymentStatusByEmployee(appointmentId, profile.userId);
            if (result.success) {
                setMessage('อัปเดตสถานะการชำระเงินสำเร็จ!');
                // Refresh the appointment list to show updated status
                setAppointments(prev => prev.map(app => 
                    app.id === appointmentId 
                    ? { ...app, paymentInfo: { ...app.paymentInfo, paymentStatus: 'paid' } }
                    : app
                ));
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
            }
            setLoading(false);
        }
    };

    const handleShowPaymentQr = (appointment) => {
        setSelectedAppointmentForQr(appointment);
        setShowPaymentQr(true);
    };


    return (
        <div>
            <EmployeeHeader />
            <PaymentQrModal 
                show={showPaymentQr}
                onClose={() => setShowPaymentQr(false)}
                appointment={selectedAppointmentForQr}
            />
            <div className="p-4 space-y-6">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <form onSubmit={handleSearch}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ค้นหาด้วยเบอร์โทรศัพท์</label>
                        <div className="flex space-x-2">
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="กรอกเบอร์โทรลูกค้า"
                                className="flex-1 p-2 border rounded-md"
                            />
                            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md" disabled={loading}>
                                {loading ? '...' : 'ค้นหา'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center">
                    <p className="mb-2 text-gray-600">หรือ</p>
                    <button
                        onClick={handleScan}
                        className="w-full max-w-xs mx-auto bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-700"
                        disabled={liffLoading || loading}
                    >
                        สแกน QR Code
                    </button>
                </div>

                <div className="space-y-4">
                    {loading && <p className="text-center">กำลังค้นหา...</p>}
                    {message && <p className="text-center text-red-500 bg-red-50 p-3 rounded-lg">{message}</p>}
                    {appointments.map(app => (
                        <AppointmentCard 
                            key={app.id} 
                            appointment={app} 
                            onConfirm={handleConfirmAppointment}
                            onUpdatePayment={handleUpdatePayment}
                            onShowPaymentQr={handleShowPaymentQr}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}