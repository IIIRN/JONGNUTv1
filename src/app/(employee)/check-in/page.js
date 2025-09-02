// src/app/(employee)/check-in/page.js
"use client";

import { useState } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { findAppointmentsByPhone, findAppointmentById, updateAppointmentStatusByEmployee } from '@/app/actions/appointmentActions';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { format, isToday, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

const AppointmentCard = ({ appointment, onConfirm }) => {
    const appointmentDate = parseISO(appointment.date);
    const isAppointmentToday = isToday(appointmentDate);

    return (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{appointment.customerInfo.fullName}</p>
                    <p className="text-sm text-gray-600">{appointment.serviceInfo.name}</p>
                </div>
                {!isAppointmentToday && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        นัดหมายล่วงหน้า
                    </span>
                )}
            </div>
            <div className="text-sm text-gray-700 border-t pt-3">
                <p>
                    <strong>วันที่:</strong>{' '}
                    <span className={!isAppointmentToday ? 'text-red-600 font-bold' : ''}>
                        {format(appointmentDate, 'dd MMMM yyyy', { locale: th })}
                    </span>
                </p>
                <p><strong>เวลา:</strong> {appointment.time} น.</p>
                <p><strong>สถานะ:</strong> <span className="font-semibold text-blue-600">{appointment.status === 'confirmed' ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</span></p>
            </div>
            <button
                onClick={() => onConfirm(appointment.id)}
                className={`w-full font-bold py-2 rounded-lg transition-colors ${
                    isAppointmentToday 
                        ? 'bg-green-500 text-white hover:bg-green-600' 
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!isAppointmentToday}
            >
                {isAppointmentToday ? 'ยืนยันการเข้ารับบริการ' : 'ยังไม่ถึงวันนัด'}
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

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!phoneNumber) return;
        
        // --- Added phone number sanitization ---
        const sanitizedPhoneNumber = phoneNumber.replace(/[\s-()]/g, '');

        setLoading(true);
        setMessage('');
        setAppointments([]);
        const result = await findAppointmentsByPhone(sanitizedPhoneNumber);
        if (result.success) {
            if (result.appointments.length > 0) {
                setAppointments(result.appointments);
            } else {
                setMessage('ไม่พบการนัดหมายสำหรับเบอร์โทรนี้');
            }
        } else {
            setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        }
        setLoading(false);
    };

    const handleScan = async () => {
        // Check if LIFF is available and initialized
        if (!liff) {
            setMessage('กำลังโหลด LIFF กรุณารอสักครู่...');
            return;
        }

        // Check if running in LINE app
        if (!liff.isInClient()) {
            setMessage('ฟังก์ชันสแกน QR ใช้งานได้บน LINE เท่านั้น');
            return;
        }

        try {
            setMessage('กำลังเปิดกล้องเพื่อสแกน QR Code...');
            
            // Use scanCodeV2 with error handling
            const result = await liff.scanCodeV2();
            
            if (result && result.value) {
                setLoading(true);
                setMessage('กำลังค้นหาข้อมูลจาก QR Code...');
                setAppointments([]);
                
                const searchResult = await findAppointmentById(result.value);
                if (searchResult.success) {
                    setAppointments([searchResult.appointment]);
                    setMessage('');
                } else {
                    setMessage(`ไม่พบข้อมูลจาก QR Code: ${searchResult.error}`);
                }
                setLoading(false);
            } else {
                setMessage('ไม่ได้รับข้อมูลจาก QR Code หรือยกเลิกการสแกน');
            }
        } catch (error) {
            console.error('QR Scan Error:', error);
            
            // More specific error handling
            if (error.type === 'PermissionError') {
                setMessage('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้องในแอป LINE');
            } else if (error.type === 'NotSupportedError') {
                setMessage('อุปกรณ์นี้ไม่รองรับฟังก์ชันสแกน QR Code');
            } else if (error.message && error.message.includes('scanCode')) {
                setMessage('เกิดข้อผิดพลาดในการสแกน QR Code กรุณาลองใหม่อีกครั้ง');
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถสแกน QR Code ได้'}`);
            }
        }
    };
    
    const handleConfirmAppointment = async (appointmentId) => {
        if (!profile?.userId) {
            setMessage("ไม่สามารถระบุตัวตนพนักงานได้");
            return;
        }
        const confirmation = confirm("ยืนยันการเข้ารับบริการของลูกค้ารายนี้?");
        if (confirmation) {
            const result = await updateAppointmentStatusByEmployee(appointmentId, profile.userId, 'in_progress', 'Customer checked in');
            if (result.success) {
                setMessage('ยืนยันการเข้ารับบริการสำเร็จ!');
                setAppointments(prev => prev.filter(app => app.id !== appointmentId));
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
            }
        }
    };


    return (
        <div>
            <EmployeeHeader />
            <div className="p-4 space-y-6">
                {/* Search by Phone */}
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

                {/* Scan QR */}
                <div className="text-center">
                    <p className="mb-2 text-gray-600">หรือ</p>
                    <button
                        onClick={handleScan}
                        className="w-full max-w-xs mx-auto bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={liffLoading || loading}
                    >
                        {liffLoading ? 'กำลังโหลด LIFF...' : loading ? 'กำลังสแกน...' : 'สแกน QR Code'}
                    </button>
                    {!liff && !liffLoading && (
                        <p className="text-sm text-red-500 mt-2">LIFF ไม่พร้อมใช้งาน</p>
                    )}
                </div>

                {/* Results */}
                <div className="space-y-4">
                    {loading && <p className="text-center">กำลังค้นหา...</p>}
                    {message && <p className="text-center text-red-500 bg-red-50 p-3 rounded-lg">{message}</p>}
                    {appointments.map(app => (
                        <AppointmentCard key={app.id} appointment={app} onConfirm={handleConfirmAppointment} />
                    ))}
                </div>
            </div>
        </div>
    );
}