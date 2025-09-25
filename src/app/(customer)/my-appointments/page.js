// src/app/(customer)/my-appointments/page.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser, confirmAppointmentByUser } from '@/app/actions/appointmentActions'; // Import new action
import AppointmentCard from './AppointmentCard';
import QrCodeModal from '@/app/components/common/QrCodeModal';
import HistoryCard from './history/HistoryCard';
import CustomerHeader from '@/app/components/CustomerHeader';

export default function MyAppointmentsPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [appointments, setAppointments] = useState([]);
    const [historyBookings, setHistoryBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
    const [appointmentToCancel, setAppointmentToCancel] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => setNotification({ ...notification, show: false }), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (liffLoading || !profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }
        setLoading(true);
        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where("userId", "==", profile.userId),
            where("status", "in", ['awaiting_confirmation', 'confirmed', 'in_progress']),
            orderBy("appointmentInfo.dateTime", "asc")
        );
        const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAppointments(docs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            setNotification({ show: true, title: 'Error', message: 'Could not fetch appointments.', type: 'error' });
            setLoading(false);
        });
        
        const fetchHistory = async () => {
            try {
                const bookingsQuery = query(
                    collection(db, 'appointments'),
                    where("userId", "==", profile.userId),
                    where("status", "in", ["completed", "cancelled"]),
                    orderBy("appointmentInfo.dateTime", "desc")
                );
                const querySnapshot = await getDocs(bookingsQuery);
                const bookingsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHistoryBookings(bookingsData);
            } catch (error) {
                console.error("Error fetching booking history:", error);
            }
        };
        fetchHistory();
        return () => unsubscribe();
    }, [profile, liffLoading]);

    const handleQrCodeClick = (appointmentId) => {
        setSelectedAppointmentId(appointmentId);
        setShowQrModal(true);
    };

    const handleCancelClick = (appointment) => {
        setAppointmentToCancel(appointment);
    };

    const confirmCancelAppointment = async () => {
        if (!appointmentToCancel || !profile?.userId) return;
        setIsCancelling(true);
        const result = await cancelAppointmentByUser(appointmentToCancel.id, profile.userId);

        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'การนัดหมายของคุณถูกยกเลิกแล้ว', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsCancelling(false);
        setAppointmentToCancel(null);
    };

    const handleConfirmClick = async (appointment) => {
        if (!profile?.userId) return;
        setIsConfirming(true);
        const result = await confirmAppointmentByUser(appointment.id, profile.userId);
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยืนยันการนัดหมายเรียบร้อย', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsConfirming(false);
    };


    if (liffLoading) return <div className="p-4 text-center">รอสักครู่...</div>;
    if (liffError) return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;

    return (
        <div>
            <CustomerHeader showBackButton={false} showActionButtons={true} />
            <div className="px-4 pb-4 space-y-5">
            <Notification {...notification} />
            <ConfirmationModal
                show={!!appointmentToCancel}
                title="ยืนยันการยกเลิก"
                message={`คุณต้องการยกเลิกการนัดหมายบริการ ${appointmentToCancel?.serviceInfo.name} ใช่หรือไม่?`}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setAppointmentToCancel(null)}
                isProcessing={isCancelling}
            />
            <QrCodeModal
                show={showQrModal}
                onClose={() => setShowQrModal(false)}
                appointmentId={selectedAppointmentId}
            />
            
            <div className="space-y-4">
                <div className="font-bold text-md text-gray-700">นัดหมายของฉัน</div>
                {loading ? (
                    <div className="text-center text-gray-500 pt-10">กำลังโหลดรายการนัดหมาย...</div>
                ) : appointments.length === 0 ? (
                    <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-xl shadow-sm">
                        <p className="font-semibold">ไม่มีรายการนัดหมายที่กำลังดำเนินอยู่</p>
                    </div>
                ) : (
                    appointments.map((job) => (
                        <AppointmentCard
                            key={job.id}
                            job={job}
                            onQrCodeClick={handleQrCodeClick}
                            onCancelClick={handleCancelClick}
                            onConfirmClick={handleConfirmClick}
                            isConfirming={isConfirming}
                        />
                    ))
                )}
            </div>
            
            <div className="flex flex-col items-center mt-6">
                <button
                    className="text-gray-400 flex items-center gap-2 focus:outline-none"
                    onClick={() => setShowHistory(v => !v)}
                >
                    <span className="text-lg">{showHistory ? '▲ ซ่อนประวัติที่ผ่านมา' : '▼ ดูประวัติที่ผ่านมา'}</span>
                </button>
            </div>
            
            {showHistory && (
                <div className="space-y-4 mt-2">
                    <div className="text-md text-gray-700">ประวัติการใช้บริการ</div>
                    {historyBookings.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-xl">
                            <p>ยังไม่มีประวัติการใช้บริการ</p>
                        </div>
                    ) : (
                        historyBookings.map(job => (
                            <HistoryCard
                                key={job.id}
                                appointment={job}
                                onBookAgain={() => { window.location.href = '/appointment'; }}
                            />
                        ))
                    )}
                </div>
            )}
            </div>
        </div>
    );
}