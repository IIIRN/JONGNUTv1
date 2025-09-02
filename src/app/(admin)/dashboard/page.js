// src/app/(admin)/dashboard/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { navigateToDetail } from '@/lib/navigateToDetail';
import Image from 'next/image';
import { cancelAppointmentByAdmin } from '@/app/actions/appointmentActions';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Modal Component (No Changes) ---
function CancelAppointmentModal({ appointment, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async () => {
        if (!reason.trim()) { alert('กรุณาระบุเหตุผลการยกเลิก'); return; }
        setIsSubmitting(true);
        await onConfirm(appointment.id, reason);
        setIsSubmitting(false);
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold mb-2 text-gray-800">ยืนยันการยกเลิกนัดหมาย</h2>
                <p className="text-sm text-gray-600 mb-4">คุณต้องการยกเลิกการนัดหมายของ <span className="font-semibold">{appointment.customerInfo.name}</span> (ID: {appointment.id.substring(0, 6).toUpperCase()}) ใช่หรือไม่?</p>
                <div>
                    <label htmlFor="cancellationReason" className="block text-sm font-medium text-gray-700">เหตุผลการยกเลิก <span className="text-red-500">*</span></label>
                    <textarea id="cancellationReason" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 p-2 border rounded-md" placeholder="เช่น ลูกค้าขอเลื่อนนัด"></textarea>
                </div>
                <div className="flex justify-end space-x-3 mt-5">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md font-semibold">ปิด</button>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold disabled:bg-gray-400">{isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยัน'}</button>
                </div>
            </div>
        </div>
    );
}

// --- Status & Color Definitions ---
const STATUSES = {
    awaiting_confirmation: { label: 'รอยืนยัน', color: 'bg-yellow-100 text-yellow-800' },
    confirmed: { label: 'ยืนยันแล้ว', color: 'bg-blue-100 text-blue-800' },
    in_progress: { label: 'กำลังใช้บริการ', color: 'bg-purple-100 text-purple-800' },
    completed: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

const TABS = [
    { key: 'in_progress', label: 'กำลังใช้บริการ' },
    { key: 'confirmed', label: 'ยืนยันแล้ว' },
    { key: 'awaiting_confirmation', label: 'รอยืนยัน' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
];

// --- Appointment Card Component ---
const AppointmentCard = ({ appointment, onCancelClick }) => {
    const router = useRouter();
    const statusInfo = STATUSES[appointment.status] || { label: appointment.status, color: 'bg-gray-100 text-gray-800' };
    const appointmentDate = appointment.appointmentInfo?.dateTime?.toDate();

    return (
        <div className="bg-white rounded-lg shadow-sm border p-3 space-y-2 text-sm">
            <div className="flex justify-between items-start">
                <p className="font-bold text-gray-800">{appointment.customerInfo?.fullName || appointment.customerInfo?.name}</p>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
            <p className="text-gray-600">{appointment.serviceInfo?.name}</p>
            <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                <p>{appointmentDate ? format(appointmentDate, 'dd MMM yy, HH:mm', { locale: th }) : '-'}</p>
                <p>ราคา: {(appointment.paymentInfo?.totalPrice || 0).toLocaleString()} บาท</p>
            </div>
             <div className="flex justify-end gap-2 mt-1">
                <button onClick={() => navigateToDetail(router, appointment.id)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-1 px-2 rounded">รายละเอียด</button>
                {['awaiting_confirmation', 'confirmed', 'in_progress'].includes(appointment.status) && (
                    <button onClick={() => onCancelClick(appointment)} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-semibold py-1 px-2 rounded">ยกเลิก</button>
                )}
            </div>
        </div>
    );
};

// --- Main Page Component ---
export default function AdminDashboardPage() {
    const [allAppointments, setAllAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState(null);
    const [activeTab, setActiveTab] = useState('in_progress');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
    const [filters, setFilters] = useState({
        startDate: format(startOfDay(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfDay(new Date()), 'yyyy-MM-dd'),
        search: '',
    });
    const router = useRouter(); // Correct: Initialize hook at the top level

    useEffect(() => {
        const appointmentsQuery = query(collection(db, 'appointments'), orderBy('appointmentInfo.dateTime', 'desc'));
        const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
            const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllAppointments(appointmentsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const filteredAppointments = useMemo(() => {
        const startDate = startOfDay(parseISO(filters.startDate));
        const endDate = endOfDay(parseISO(filters.endDate));
        const search = filters.search.toLowerCase();

        return allAppointments.filter(app => {
            const appDate = app.appointmentInfo?.dateTime?.toDate();
            if (!appDate || appDate < startDate || appDate > endDate) return false;
            if (search && 
                !app.customerInfo?.fullName?.toLowerCase().includes(search) &&
                !app.customerInfo?.phone?.includes(search)) return false;
            return true;
        }).sort((a,b) => (a.appointmentInfo?.dateTime?.toDate() || 0) - (b.appointmentInfo?.dateTime?.toDate() || 0));
    }, [allAppointments, filters]);

    const handleConfirmCancel = async (appointmentId, reason) => {
        const result = await cancelAppointmentByAdmin(appointmentId, reason);
        if (result.success) alert('ยกเลิกการนัดหมายสำเร็จ');
        else alert(`เกิดข้อผิดพลาด: ${result.error}`);
    };

    const appointmentsForActiveTab = filteredAppointments.filter(a => a.status === activeTab);
    
    if (loading) return <div className="text-center p-10">Loading Dashboard...</div>;

    return (
        <div className="p-4 md:p-6">
            {appointmentToCancel && <CancelAppointmentModal appointment={appointmentToCancel} onClose={() => setAppointmentToCancel(null)} onConfirm={handleConfirmCancel} />}
            
            <header className="pb-4 border-b mb-4">
                <h1 className="text-2xl font-bold text-slate-800">ภาพรวมการนัดหมาย</h1>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                     <div>
                        <label className="text-sm font-medium mr-2">วันที่เริ่มต้น:</label>
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium mr-2">วันที่สิ้นสุด:</label>
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium mr-2">ค้นหา:</label>
                        <input type="text" name="search" placeholder="ชื่อ หรือ เบอร์โทร" value={filters.search} onChange={handleFilterChange} className="p-2 border rounded-md"/>
                    </div>
                </div>
            </header>

            {/* Tabs and View Toggler */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex flex-wrap gap-2">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} 
                            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${activeTab === tab.key ? 'bg-slate-800 text-white' : 'bg-white hover:bg-gray-100 text-gray-600'}`}>
                            {tab.label} ({filteredAppointments.filter(a => a.status === tab.key).length})
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 p-1 bg-gray-200 rounded-md">
                    <button onClick={() => setViewMode('grid')} className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}>แถว</button>
                    <button onClick={() => setViewMode('table')} className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-white shadow' : ''}`}>ตาราง</button>
                </div>
            </div>

            {/* Content Display */}
            <div className="mt-4">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {appointmentsForActiveTab.map(app => (
                            <AppointmentCard key={app.id} appointment={app} onCancelClick={setAppointmentToCancel} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">บริการ</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่/เวลา</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {appointmentsForActiveTab.map(app => (
                                    <tr key={app.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{app.customerInfo?.fullName || app.customerInfo?.name}</div>
                                            <div className="text-sm text-gray-500">{app.customerInfo?.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{app.serviceInfo?.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{app.appointmentInfo?.dateTime?.toDate() ? format(app.appointmentInfo.dateTime.toDate(), 'dd MMM yy, HH:mm', { locale: th }) : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{(app.paymentInfo?.totalPrice || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                             <button onClick={() => navigateToDetail(router, app.id)} className="text-indigo-600 hover:text-indigo-900">ดูรายละเอียด</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                 {appointmentsForActiveTab.length === 0 && (
                    <p className="text-center text-gray-500 pt-10">ไม่พบรายการนัดหมายสำหรับสถานะนี้ในช่วงวันที่ที่เลือก</p>
                )}
            </div>
        </div>
    );
}