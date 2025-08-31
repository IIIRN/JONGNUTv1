"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { updateAppointmentStatus, registerLineIdToEmployee } from '@/app/actions/employeeActions'; // Reverted action file name
import { Notification } from '@/app/components/common/NotificationComponent';
import { format } from 'date-fns';

// --- Registration Form ---
function RegistrationForm({ profile, onRegisterSuccess, showNotification }) {
    // ... (This component's code remains the same)
}

// --- Appointment Card ---
const AppointmentCard = ({ appointment, onAction, isProcessing }) => {
    // ... (This component's code is functionally the same, just uses "พนักงาน" context)
    const { customerInfo, serviceInfo, appointmentInfo } = appointment;
    const canStart = appointment.status === 'confirmed';
    const canComplete = appointment.status === 'in_progress';

    return (
        <div className="bg-white p-4 rounded-lg shadow-md animate-fade-in">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg">{customerInfo.name}</h3>
                    <p className="text-sm text-gray-500">{customerInfo.phone}</p>
                </div>
                <p className="text-sm font-semibold text-pink-500">{format(appointmentInfo.dateTime.toDate(), 'HH:mm')} น.</p>
            </div>
            <div className="border-t my-3"></div>
            <p><span className="font-semibold">บริการ:</span> {serviceInfo.name}</p>
            {appointmentInfo.addOns && appointmentInfo.addOns.length > 0 && (
                <p className="text-sm text-gray-600">+ {appointmentInfo.addOns.map(a => a.name).join(', ')}</p>
            )}

            <div className="mt-4">
                {canStart && (
                    <button onClick={() => onAction(appointment.id, 'in_progress')} disabled={isProcessing} className="w-full bg-green-500 text-white font-bold py-2 rounded-lg">
                        เริ่มให้บริการ
                    </button>
                )}
                {canComplete && (
                     <button onClick={() => onAction(appointment.id, 'completed')} disabled={isProcessing} className="w-full bg-blue-500 text-white font-bold py-2 rounded-lg">
                        เสร็จสิ้นบริการ
                    </button>
                )}
            </div>
        </div>
    );
}


export default function EmployeePage() { // Reverted to Employee
    const { profile, loading: liffLoading } = useLiffContext();
    const [employee, setEmployee] = useState(null); // Reverted state name
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });

    useEffect(() => {
        if (liffLoading || !profile?.userId) return;

        let unsubAppointments = () => {};
        const employeeQuery = query(collection(db, "employees"), where("lineUserId", "==", profile.userId));
        
        const unsubEmployee = onSnapshot(employeeQuery, (snapshot) => {
            if (!snapshot.empty) {
                const employeeData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                setEmployee(employeeData);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const appointmentsQuery = query(
                    collection(db, "appointments"),
                    where("appointmentInfo.employeeId", "==", employeeData.id), // Switched from beauticianId
                    where("status", "in", ["confirmed", "in_progress"]),
                    where("appointmentInfo.dateTime", ">=", today),
                    orderBy("appointmentInfo.dateTime", "asc")
                );

                unsubAppointments = onSnapshot(appointmentsQuery, (appSnapshot) => {
                    setAppointments(appSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setLoading(false);
                });

            } else {
                setEmployee(null);
                setLoading(false);
            }
        });

        return () => {
            unsubEmployee();
            unsubAppointments();
        };
    }, [profile, liffLoading]);
    
    const handleUpdateStatus = async (appointmentId, newStatus) => {
        setIsProcessing(true);
        const result = await updateAppointmentStatus(appointmentId, newStatus, employee.id);
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'อัปเดตสถานะเรียบร้อย', type: 'success' });
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
                <div>
                    <h1 className="text-xl font-bold mb-4">นัดหมายวันนี้</h1>
                    {appointments.length > 0 ? (
                        <div className="space-y-4">
                            {appointments.map(app => (
                                <AppointmentCard key={app.id} appointment={app} onAction={handleUpdateStatus} isProcessing={isProcessing} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center bg-white p-6 rounded-lg shadow-md">
                            <p className="text-gray-500">ไม่มีนัดหมายสำหรับวันนี้</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}