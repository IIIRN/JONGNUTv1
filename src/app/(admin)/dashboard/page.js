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
import { useProfile } from '@/context/ProfileProvider';

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
    const { profile } = useProfile();
    const mainDuration = appointment.serviceInfo?.duration || appointment.appointmentInfo?.duration || 0;
    const addOns = appointment.appointmentInfo?.addOns || appointment.addOns || [];
    const addOnsDuration = addOns.reduce((sum, addon) => sum + (addon.duration || 0), 0);
    const totalDuration = mainDuration + addOnsDuration;
    const router = useRouter();
    const statusInfo = STATUSES[appointment.status] || { label: appointment.status, color: 'bg-gray-100 text-gray-800' };
    const appointmentDate = appointment.appointmentInfo?.dateTime?.toDate();

    return (
        <div className="bg-white rounded-lg shadow-sm border p-3 space-y-2 text-sm">
            <div className="flex justify-between items-start">
                <p className="font-bold text-gray-800">{appointment.customerInfo?.fullName || appointment.customerInfo?.name}</p>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
            <div className="text-gray-600 space-y-1">
                <div>{appointment.serviceInfo?.name}</div>
                <div>เวลาบริการ: {appointment.serviceInfo?.duration || appointment.appointmentInfo?.duration || '-'} นาที</div>
                <div>ราคา: {appointment.serviceInfo?.price ? `${Number(appointment.serviceInfo.price).toLocaleString()} ${profile.currencySymbol}` :
                    appointment.appointmentInfo?.price ? `${Number(appointment.appointmentInfo.price).toLocaleString()} ${profile.currencySymbol}` : '-'}</div>
    
            </div>
            {addOns.length > 0 && (
                <div className="mt-1 text-xs text-gray-700 bg-gray-50 rounded p-2">
                    <span className="font-semibold">บริการเสริม:</span>
                    <ul className="list-disc ml-4">
                        {addOns.map((addon, idx) => (
                            <li key={idx}>
                                {addon.name || addon.title || 'ไม่มีชื่อ'}
                                {addon.price ? ` (${Number(addon.price).toLocaleString()} ${profile.currencySymbol})` : ''}
                                {addon.duration ? ` • ${addon.duration} นาที` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="text-xs text-blue-700 mt-1">รวมเวลาทั้งหมด: {totalDuration ? `${totalDuration} นาที` : '-'}</div>
            <div className="text-xs text-gray-700 mt-1">ราคา: {(appointment.paymentInfo?.totalPrice || 0).toLocaleString()} {profile.currencySymbol}</div>

            <div className="text-md font-semibold text-gray-500 border-t pt-2 mt-2">
                <p>{appointmentDate ? format(appointmentDate, 'dd MMM yy, HH:mm', { locale: th }) : '-'}</p>
            </div>
            <div className="flex justify-between items-center gap-2 mt-2">
                <button onClick={() => navigateToDetail(router, appointment.id)} className="text-md bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold p-2 rounded">อัพเดทการนัดหมาย</button>
                {['awaiting_confirmation', 'confirmed', 'in_progress'].includes(appointment.status) && (
                    <button onClick={() => onCancelClick(appointment)} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-semibold p-2 rounded">ยกเลิก</button>
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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const { profile, loading: profileLoading } = useProfile();

    const getMonthRange = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            startDate: format(firstDay, 'yyyy-MM-dd'),
            endDate: format(lastDay, 'yyyy-MM-dd'),
        };
    };
    const [filters, setFilters] = useState({
        ...getMonthRange(),
        search: '',
    });
    const router = useRouter();

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
    
    const totalItems = appointmentsForActiveTab.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentAppointments = appointmentsForActiveTab.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, filters]);
    
    if (loading || profileLoading) return <div className="text-center p-10">Loading Dashboard...</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            {appointmentToCancel && <CancelAppointmentModal appointment={appointmentToCancel} onClose={() => setAppointmentToCancel(null)} onConfirm={handleConfirmCancel} />}
            
            <header className="pb-4 border-b mb-4">
                <h1 className="text-2xl font-bold text-slate-800">ภาพรวมการนัดหมาย</h1>
                <div className="flex flex-wrap items-center gap-4 mt-4 text-black">
                     <div>
                        <label className=" text-sm font-medium mr-2">วันที่เริ่มต้น:</label>
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

            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex flex-wrap gap-2">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} 
                            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${activeTab === tab.key ? 'bg-slate-800 text-white' : 'bg-white hover:bg-gray-100 text-gray-600'}`}>
                            {tab.label} ({filteredAppointments.filter(a => a.status === tab.key).length})
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 p-1 bg-gray-200 text-black rounded-md">
                    <button onClick={() => setViewMode('grid')} className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}>แถว</button>
                    <button onClick={() => setViewMode('table')} className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-white shadow' : ''}`}>ตาราง</button>
                </div>
            </div>

            {totalItems > 0 && (
                <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                    <div>
                        แสดง {startIndex + 1}-{Math.min(endIndex, totalItems)} จาก {totalItems} รายการ
                    </div>
                    <div>
                        หน้า {currentPage} จาก {totalPages}
                    </div>
                </div>
            )}

            <div className="mt-4">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {currentAppointments.map(app => (
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
                                {currentAppointments.map(app => (
                                    <tr key={app.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{app.customerInfo?.fullName || app.customerInfo?.name}</div>
                                            <div className="text-sm text-gray-500">{app.customerInfo?.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                            <p>{app.serviceInfo?.name}</p>
                                            {(app.appointmentInfo?.addOns?.length || app.addOns?.length) > 0 && (
                                                <ul className="list-disc ml-4 text-xs text-gray-600">
                                                    {(app.appointmentInfo?.addOns || app.addOns || []).map((addon, idx) => (
                                                        <li key={idx}>
                                                            {addon.name || addon.title || 'ไม่มีชื่อ'}
                                                            {addon.price ? ` (${Number(addon.price).toLocaleString()} ${profile.currencySymbol})` : ''}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{app.appointmentInfo?.dateTime?.toDate() ? format(app.appointmentInfo.dateTime.toDate(), 'dd MMM yy, HH:mm', { locale: th }) : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{(app.paymentInfo?.totalPrice || 0).toLocaleString()} {profile.currencySymbol}</td>
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

            {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 space-x-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                    >
                        ก่อนหน้า
                    </button>
                    
                    <div className="flex space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                            const showPage = pageNum === 1 || 
                                           pageNum === totalPages || 
                                           Math.abs(pageNum - currentPage) <= 2;
                            
                            if (!showPage) {
                                if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                                    return <span key={pageNum} className="px-2 py-1 text-gray-400">...</span>;
                                }
                                return null;
                            }
                            
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-3 py-2 rounded-md ${ 
                                        currentPage === pageNum
                                            ? 'bg-slate-800 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>
                    
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                    >
                        ถัดไป
                    </button>
                </div>
            )}
        </div>
    );
}
