"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
    registerLineIdToEmployee, 
    findAppointmentsByPhone, 
    findAppointmentById, 
    updateAppointmentStatus 
} from '@/app/actions/employeeActions';
import { Notification } from '@/app/components/common/NotificationComponent';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Registration Form (for unregistered employees) ---
function RegistrationForm({ profile, onRegisterSuccess, showNotification }) {
    // ... This component's code remains the same ...
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await registerLineIdToEmployee(phoneNumber, profile.userId);
        if (result.success) {
            showNotification({ show: true, title: 'สำเร็จ', message: 'เชื่อมต่อบัญชี LINE สำเร็จ', type: 'success' });
            onRegisterSuccess();
        } else {
            showNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h2 className="text-xl font-bold mb-2">ยืนยันตัวตนพนักงาน</h2>
            <p className="text-sm text-gray-500 mb-6">กรุณากรอกเบอร์โทรศัพท์ที่ลงทะเบียนไว้กับระบบ เพื่อเชื่อมต่อกับบัญชี LINE ของคุณ</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก"
                    className="w-full p-3 border rounded-md text-center"
                    maxLength="10"
                />
                <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white p-3 rounded-lg font-bold">{loading ? '...' : 'ยืนยัน'}</button>
            </form>
        </div>
    );
}

// --- Component to display a found appointment ---
const FoundAppointmentCard = ({ appointment, onCheckIn, isProcessing }) => (
    <div className="bg-white p-4 rounded-lg shadow-md mt-4">
        <h3 className="font-bold text-lg">{appointment.customerInfo.name}</h3>
        <p className="text-sm text-gray-500">{appointment.customerInfo.phone}</p>
        <div className="border-t my-3"></div>
        <p><span className="font-semibold">บริการ:</span> {appointment.serviceInfo.name}</p>
        <p><span className="font-semibold">เวลา:</span> {format(appointment.appointmentInfo.dateTime.toDate(), 'HH:mm')} น.</p>
        <button 
            onClick={() => onCheckIn(appointment.id)} 
            disabled={isProcessing}
            className="w-full mt-4 bg-green-500 text-white font-bold py-2 rounded-lg disabled:bg-gray-400"
        >
            {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันเข้ารับบริการ'}
        </button>
    </div>
);

export default function EmployeePage() {
    const { liffObject, profile, loading: liffLoading } = useLiffContext();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });
    
    const [phoneSearch, setPhoneSearch] = useState('');
    const [foundAppointments, setFoundAppointments] = useState([]);

    useEffect(() => {
        if (liffLoading || !profile?.userId) return;
        
        const employeeQuery = query(collection(db, "employees"), where("lineUserId", "==", profile.userId));
        const unsubscribe = onSnapshot(employeeQuery, (snapshot) => {
            if (!snapshot.empty) {
                setEmployee({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
                setEmployee(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [profile, liffLoading]);
    
    const handlePhoneSearch = async (e) => {
        e.preventDefault();
        if (!phoneSearch) return;
        setIsProcessing(true);
        const result = await findAppointmentsByPhone(phoneSearch);
        if (result.success) {
            setFoundAppointments(result.appointments);
            if (result.appointments.length === 0) {
                setNotification({ show: true, title: 'ไม่พบข้อมูล', message: 'ไม่พบนัดหมายของวันนี้สำหรับเบอร์โทรศัพท์นี้', type: 'error' });
            }
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsProcessing(false);
    };

    const handleScan = async () => {
        setIsProcessing(true);
        setFoundAppointments([]);
        try {
            if (!liffObject?.scanCodeV2) throw new Error("LIFF function not available.");
            const result = await liffObject.scanCodeV2();
            if (result.value) {
                const appointmentResult = await findAppointmentById(result.value);
                if (appointmentResult.success && appointmentResult.appointment) {
                    setFoundAppointments([appointmentResult.appointment]);
                } else {
                     setNotification({ show: true, title: 'ไม่พบข้อมูล', message: 'ไม่พบข้อมูลนัดหมายจาก QR Code', type: 'error' });
                }
            }
        } catch (error) {
            setNotification({ show: true, title: 'Scan Error', message: error.message, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleCheckIn = async (appointmentId) => {
        setIsProcessing(true);
        const result = await updateAppointmentStatus(appointmentId, 'in_progress', employee.id);
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'เช็คอินลูกค้าเรียบร้อย', type: 'success' });
            setFoundAppointments([]); // Clear results after check-in
            setPhoneSearch('');
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsProcessing(false);
    };

    if (loading || liffLoading) {
        return <div className="text-center p-10">กำลังตรวจสอบข้อมูล...</div>;
    }

    return (
        <div className="space-y-6">
            <Notification {...notification} />
            
            {!employee ? (
                <RegistrationForm profile={profile} onRegisterSuccess={() => setLoading(true)} showNotification={setNotification} />
            ) : (
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <h1 className="text-xl font-bold mb-4 text-center">ต้อนรับลูกค้า</h1>
                    
                    {/* Phone Search */}
                    <form onSubmit={handlePhoneSearch} className="space-y-2">
                        <input
                            type="tel"
                            value={phoneSearch}
                            onChange={(e) => setPhoneSearch(e.target.value)}
                            placeholder="ค้นหาด้วยเบอร์โทรศัพท์"
                            className="w-full p-3 border rounded-md text-center"
                        />
                        <button type="submit" disabled={isProcessing} className="w-full bg-indigo-500 text-white font-semibold py-2 rounded-lg">
                            {isProcessing ? '...' : 'ค้นหา'}
                        </button>
                    </form>

                    <div className="my-4 flex items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">หรือ</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                    
                    {/* Scan Button */}
                    <button onClick={handleScan} disabled={isProcessing} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg">
                        สแกน QR Code
                    </button>
                    
                    {/* Search Results */}
                    {foundAppointments.length > 0 && (
                        <div className="mt-6">
                            <h2 className="font-bold">ผลการค้นหา:</h2>
                            {foundAppointments.map(app => (
                                <FoundAppointmentCard key={app.id} appointment={app} onCheckIn={handleCheckIn} isProcessing={isProcessing} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}