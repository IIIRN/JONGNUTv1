"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { findAppointmentsByPhone, findAppointmentById, updateAppointmentStatus, updatePaymentStatusByEmployee } from '@/app/actions/employeeActions';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { format, isToday, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Import ใหม่ที่จำเป็น ---
import { getPaymentSettings } from '@/app/actions/settingsActions';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';


// --- Payment QR Code Modal (ฉบับแก้ไขใหม่) ---
const PaymentQrModal = ({ show, onClose, appointment }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show && appointment) {
            const generateQR = async () => {
                setLoading(true);
                setError('');
                setQrCodeUrl('');
                try {
                    // 1. ดึงข้อมูลการตั้งค่า Payment ล่าสุดจาก Server Action
                    const settingsResult = await getPaymentSettings();
                    
                    // V V V V V V V V V V V V V V V V V V V V V
                    //  แก้ไขการตรวจสอบข้อมูลให้ถูกต้องตรงนี้
                    // V V V V V V V V V V V V V V V V V V V V V
                    if (!settingsResult.success) {
                        throw new Error(settingsResult.error || "ไม่พบการตั้งค่าการชำระเงิน");
                    }
                    const { settings } = settingsResult; // ดึง settings object ออกมาใช้งาน

                    // 2. ตรวจสอบเงื่อนไขและสร้าง QR Code
                    if (settings.method === 'image') {
                        if (!settings.qrCodeImageUrl) {
                            throw new Error("แอดมินยังไม่ได้ตั้งค่ารูปภาพ QR Code");
                        }
                        setQrCodeUrl(settings.qrCodeImageUrl);
                    } else if (settings.method === 'promptpay') {
                        if (!settings.promptPayAccount) {
                            throw new Error("แอดมินยังไม่ได้ตั้งค่าบัญชี PromptPay");
                        }
                        const amount = appointment.paymentInfo.totalPrice;
                        const payload = generatePayload(settings.promptPayAccount, { amount });
                        const url = await QRCode.toDataURL(payload);
                        setQrCodeUrl(url);
                    } else {
                        throw new Error("รูปแบบการชำระเงินไม่ถูกต้อง กรุณาติดต่อแอดมิน");
                    }
                } catch (err) {
                    console.error("Error generating payment QR code:", err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointment]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-1 text-gray-800">Scan to Pay</h2>
                <p className="text-2xl font-bold text-blue-600 mb-3">{appointment.paymentInfo.totalPrice?.toLocaleString()} THB</p>
                <div className="h-64 w-64 mx-auto flex items-center justify-center">
                    {loading ? (
                        <p>กำลังสร้าง QR Code...</p>
                    ) : error ? (
                        <p className="text-red-500 text-sm">{error}</p>
                    ) : (
                        qrCodeUrl && <Image src={qrCodeUrl} alt="Payment QR Code" width={256} height={256} style={{ objectFit: 'contain' }} />
                    )}
                </div>
                <button onClick={onClose} className="mt-4 w-full bg-gray-200 text-gray-800 py-2 rounded-xl font-semibold">ปิด</button>
            </div>
        </div>
    );
};


// --- Appointment Card (โค้ดเดิมของคุณ ไม่มีการแก้ไข) ---
const AppointmentCard = ({ appointment, onConfirm, onUpdatePayment, onShowPaymentQr }) => {
    const appointmentDate = parseISO(appointment.date);
    const isAppointmentToday = isToday(appointmentDate);
    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const now = new Date();
    const isFuture = appointmentDate > now;

    const statusOptions = [
        { value: 'pending', label: 'รอใช้บริการ', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'in_progress', label: 'เริ่มใช้บริการ', color: 'bg-blue-100 text-blue-800' },
        { value: 'completed', label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
        { value: 'cancelled', label: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
    ];

    const [selectedStatus, setSelectedStatus] = useState(appointment.status);
    const [statusUpdating, setStatusUpdating] = useState(false);

    const handleStatusUpdate = async () => {
        if (selectedStatus === appointment.status) {
            alert('กรุณาเลือกสถานะใหม่ที่แตกต่างจากสถานะปัจจุบัน');
            return;
        }
        if (!confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${statusOptions.find(opt => opt.value === selectedStatus)?.label}"?`)) {
            return;
        }
        setStatusUpdating(true);
        try {
            const employeeId = appointment.employeeId || 'employee';
            const result = await updateAppointmentStatus(appointment.id, selectedStatus, employeeId, `อัพเดทสถานะเป็น ${selectedStatus}`);
            if (result.success) {
                alert('อัพเดทสถานะสำเร็จ!');
                appointment.status = selectedStatus;
            } else {
                alert('เกิดข้อผิดพลาด: ' + result.error);
                setSelectedStatus(appointment.status);
            }
        } catch (err) {
            alert('เกิดข้อผิดพลาด: ' + err.message);
            setSelectedStatus(appointment.status);
        }
        setStatusUpdating(false);
    };

    const getCurrentStatusInfo = () => {
        return statusOptions.find(opt => opt.value === appointment.status) || statusOptions[0];
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{appointment.customerInfo.fullName}</p>
                    <p className="text-sm text-gray-600">{appointment.serviceInfo.name}</p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {isPaid ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getCurrentStatusInfo().color}`}>
                        {getCurrentStatusInfo().label}
                    </span>
                </div>
            </div>
            <div className="text-sm text-gray-700 border-t pt-3">
                <p><strong>วันที่:</strong> {format(appointmentDate, 'dd MMMM yyyy', { locale: th })}</p>
                <p><strong>เวลา:</strong> {appointment.time} น.</p>
                <p><strong>ยอดชำระ:</strong> <span className="font-bold">{appointment.paymentInfo.totalPrice?.toLocaleString()} บาท</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
                 <button
                    onClick={() => onShowPaymentQr(appointment)}
                    className="font-semibold py-2 rounded-lg transition-colors bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400"
                    disabled={isPaid}
                >
                    แสดง QR ชำระเงิน
                </button>
                <button
                    onClick={() => {
                        if (isFuture && !isPaid) {
                            alert('เตือน: คุณกำลังอัปเดตสถานะการชำระเงินก่อนถึงวันนัดหมาย!');
                        }
                        onUpdatePayment(appointment.id);
                    }}
                    className={`font-semibold py-2 rounded-lg transition-colors bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400 ${isFuture && !isPaid ? 'border-2 border-yellow-400' : ''}`}
                    disabled={isPaid}
                >
                    {isPaid ? 'ชำระเงินแล้ว' : 'อัปเดตชำระเงิน'}
                </button>
            </div>
            <div className="border-t pt-3">
                <label className="block text-sm font-medium mb-2 text-gray-700">อัพเดทสถานะการนัดหมาย</label>
                <div className="flex items-center space-x-2">
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        disabled={statusUpdating}
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleStatusUpdate}
                        disabled={statusUpdating || selectedStatus === appointment.status}
                        className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                            statusUpdating || selectedStatus === appointment.status
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                    >
                        {statusUpdating ? 'กำลังอัพเดท...' : 'ยืนยัน'}
                    </button>
                </div>
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


// --- Main Page Component (โค้ดเดิมของคุณ ไม่มีการแก้ไข) ---
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

