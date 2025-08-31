"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { navigateToDetail } from '@/lib/navigateToDetail';
import Image from 'next/image';
import { cancelBookingByAdmin, sendInvoiceToCustomer, confirmPayment, sendReviewRequestToCustomer } from '@/app/actions/appointmentActions';
import { isToday, isFuture, isPast, format } from 'date-fns';
import { th } from 'date-fns/locale';


// --- (Modal Components: CancelBookingModal, InvoicePreviewModal - No Changes) ---
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
function InvoicePreviewModal({ appointment, onClose, onConfirm }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const paymentUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID}/payment/${appointment.id}`;
    const customerMessage = `เรียนคุณ ${appointment.customerInfo.name},

นี่คือใบแจ้งค่าบริการสำหรับบริการของคุณ
ยอดชำระ: ${appointment.paymentInfo.totalPrice.toLocaleString()} บาท

กรุณาคลิกที่ลิงก์เพื่อชำระเงิน:
${paymentUrl}`;
    const handleSubmit = async () => {
        setIsSubmitting(true);
        await onConfirm(appointment.id);
        setIsSubmitting(false);
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold mb-2 text-gray-800">ตัวอย่างใบแจ้งหนี้</h2>
                <p className="text-sm text-gray-600 mb-4">ระบบจะส่งข้อความด้านล่างนี้ไปยัง LINE ของลูกค้า</p>
                <div className="bg-gray-100 p-4 rounded-md border"><pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{customerMessage}</pre></div>
                <div className="flex justify-end space-x-3 mt-5">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md font-semibold">ยกเลิก</button>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold disabled:bg-gray-400">{isSubmitting ? 'กำลังส่ง...' : 'ยืนยันและส่ง'}</button>
                </div>
            </div>
        </div>
    );
}

// --- NEW: Stat Card Component ---
const StatCard = ({ title, value, icon, color, onClick, isActive }) => (
    <div 
        onClick={onClick}
        className={`p-4 rounded-lg shadow-md flex items-center transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${isActive ? 'ring-2 ring-offset-2 ' + color.ring : 'bg-white'}`}
    >
        <div className={`p-3 rounded-full mr-4 ${color.bg}`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm font-medium text-gray-500">{title}</p>
        </div>
    </div>
);


// --- MODIFIED: Status Translations for Self-Drive ---
const statusTranslations = {
    'awaiting_confirmation': 'รอยืนยัน',
    'confirmed': 'ยืนยันแล้ว',
    'completed': 'เสร็จสมบูรณ์',
    'cancelled': 'ยกเลิก',
};

const statusColors = {
    'awaiting_confirmation': 'bg-yellow-100 text-yellow-800',
    'confirmed': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
};

// Unified filter state (status + optional date filter + free-text query)
const STATUS_FILTERS = ['all', 'awaiting_confirmation', 'confirmed', 'completed', 'cancelled'];

// --- NEW: Booking Card Component ---
const AppointmentCard = ({ appointment, beauticians, onCancel }) => {
    const router = useRouter();
    const appointmentDate = appointment.appointmentInfo && appointment.appointmentInfo.dateTime && typeof appointment.appointmentInfo.dateTime.toDate === 'function'
            ? appointment.appointmentInfo.dateTime.toDate()
            : null;
        const beauticianName = appointment.appointmentInfo?.beauticianId && beauticians[appointment.appointmentInfo.beauticianId]
            ? `${beauticians[appointment.appointmentInfo.beauticianId].firstName || ''} ${beauticians[appointment.appointmentInfo.beauticianId].lastName || ''}`.trim()
            : 'N/A';

    const formatPrice = (val) => {
        if (val === null || val === undefined || val === '-') return '-';
        if (typeof val === 'number') return val.toLocaleString();
        const n = Number(val);
        return Number.isFinite(n) ? n.toLocaleString() : String(val);
    };

    const addOns = appointment.appointmentInfo?.addOns || appointment.addOns || [];

    return (
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="font-bold text-lg text-gray-800">{appointment.customerInfo?.name || '-'}</p>
                        <p className="text-xs text-gray-500">{appointment.customerInfo?.phone || '-'}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[appointment.status]}`}>
                        {statusTranslations[appointment.status]}
                    </span>
                </div>
                <div className="border-t my-2"></div>
                <div className="flex items-center space-x-3 text-sm">
                    <Image src={appointment.serviceInfo && appointment.serviceInfo.imageUrl ? appointment.serviceInfo.imageUrl : '/placeholder.png'} alt="service" width={60} height={60} className="rounded-md object-cover flex-shrink-0"/>
                    <div>
                        <p className="font-semibold text-gray-900">{appointment.serviceInfo && appointment.serviceInfo.name ? appointment.serviceInfo.name : '-'}</p>
                                <p className="text-gray-600">ช่างเสริมสวย: {beauticianName}</p>
                    </div>
                </div>
                {addOns && addOns.length > 0 && (
                    <div className="mt-3 bg-gray-50 p-2 rounded-md text-sm text-gray-700">
                        <h4 className="font-medium mb-1">บริการเสริม</h4>
                        <ul className="space-y-1">
                            {addOns.map((a, i) => (
                                <li key={i} className="flex justify-between">
                                    <span>{a.name || a.title || 'ไม่มีชื่อ'}</span>
                                    <span className="font-medium">{formatPrice(a.price)} ฿</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                      <div className="text-xs text-gray-600 mt-3 space-y-1 bg-gray-50 p-2 rounded-md">
                          <p><strong>นัดหมาย:</strong> {appointmentDate ? format(appointmentDate, 'dd MMM yy, HH:mm', { locale: th }) : '-'} ที่ {appointment.locationInfo?.name || '-'}</p>
                </div>
            </div>
            <div className="mt-4 pt-3 flex justify-end items-center gap-2">
                 <button onClick={() => navigateToDetail(router, appointment.id)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-md">รายละเอียด</button>
                 {['awaiting_confirmation', 'confirmed'].includes(appointment.status) && (
                    <button onClick={() => onCancel(appointment)} className="text-sm bg-red-100 hover:bg-red-200 text-red-800 font-semibold py-1 px-3 rounded-md">ยกเลิก</button>
                 )}
            </div>
        </div>
    );
};


export default function AdminDashboardPage() {
    const [allAppointments, setAllAppointments] = useState([]);
    const [allServices, setAllServices] = useState([]); // <-- For stats
    const [beauticians, setBeauticians] = useState({}); // Renamed from employees
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today'
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState(null);
    const [appointmentToInvoice, setAppointmentToInvoice] = useState(null);

    // --- Real-time listeners for appointments and services ---
    useEffect(() => {
        const appointmentsQuery = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
        const servicesQuery = query(collection(db, 'services'));

        const unsubscribeAppointments = onSnapshot(appointmentsQuery, async (snapshot) => {
            const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllAppointments(appointmentsData);
            
            // Fetch beautician data if not already fetched
                        const newBeauticianIds = [...new Set(
                            appointmentsData
                                .filter(a => a.appointmentInfo && a.appointmentInfo.beauticianId)
                                .map(a => a.appointmentInfo.beauticianId)
                        )];
            const missingBeauticianIds = newBeauticianIds.filter(id => !beauticians[id]);
            if(missingBeauticianIds.length > 0){
                const beauticianPromises = missingBeauticianIds.map(id => getDoc(doc(db, 'beauticians', id)));
                const beauticianDocs = await Promise.all(beauticianPromises);
                const newBeauticians = {};
                beauticianDocs.forEach(doc => {
                    if(doc.exists()) newBeauticians[doc.id] = doc.data();
                });
                setBeauticians(prev => ({...prev, ...newBeauticians}));
            }

            setLoading(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            setLoading(false);
        });

        const unsubscribeServices = onSnapshot(servicesQuery, (snapshot) => {
            const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllServices(servicesData);
        });

        return () => {
            unsubscribeAppointments();
            unsubscribeServices();
        };
    }, []);

    // --- Memoized calculations for performance ---
    const stats = useMemo(() => {
        const confirmedAppointments = allAppointments.filter(a => a.status === 'confirmed').length;
        const appointmentsToday = allAppointments.filter(a => a.status === 'confirmed' && isToday(a.appointmentInfo.dateTime.toDate())).length;
        const completedToday = allAppointments.filter(a => a.status === 'completed' && isToday(a.appointmentInfo.dateTime.toDate())).length;
        const awaitingConfirmation = allAppointments.filter(b => b.status === 'awaiting_confirmation').length;

        return {
            awaitingConfirmation: awaitingConfirmation,
            confirmedAppointments: confirmedAppointments,
            appointmentsToday: appointmentsToday,
            completedToday: completedToday,
        };
    }, [allAppointments]);

    const filteredAppointments = useMemo(() => {
        let list = allAppointments.slice();

        if (statusFilter && statusFilter !== 'all') {
            list = list.filter(a => a.status === statusFilter);
        }

        if (dateFilter === 'today') {
            list = list.filter(a => {
                try {
                    return isToday(a.appointmentInfo.dateTime.toDate());
                } catch (e) { return false; }
            });
        }

        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(a => {
                const cust = (a.customerInfo?.name || a.userInfo?.displayName || '').toLowerCase();
                const phone = (a.customerInfo?.phone || '').toLowerCase();
                const svc = ((a.serviceInfo && a.serviceInfo.name) || a.serviceName || '').toLowerCase();
                return cust.includes(q) || phone.includes(q) || svc.includes(q);
            });
        }

        list.sort((a, b) => {
            try {
                const ta = a.appointmentInfo?.dateTime?.toMillis ? a.appointmentInfo.dateTime.toMillis() : (a.appointmentInfo?.dateTime ? new Date(a.appointmentInfo.dateTime).getTime() : 0);
                const tb = b.appointmentInfo?.dateTime?.toMillis ? b.appointmentInfo.dateTime.toMillis() : (b.appointmentInfo?.dateTime ? new Date(b.appointmentInfo.dateTime).getTime() : 0);
                return ta - tb;
            } catch (e) { return 0; }
        });

        return list;
    }, [allAppointments, statusFilter, dateFilter, searchQuery]);
    
    const handleStatFilterClick = (filter, date = 'all') => {
        if (statusFilter === filter && dateFilter === date) {
            setStatusFilter('all');
            setDateFilter('all');
        } else {
            setStatusFilter(filter);
            setDateFilter(date);
        }
    };
    
    // --- Action Handlers (Implemented) ---
    const handleConfirmCancel = async (appointmentId, reason) => {
        const result = await cancelAppointmentByAdmin(appointmentId, reason);
        if (result.success) {
            alert('ยกเลิกการนัดหมายสำเร็จ');
        } else {
            alert(`เกิดข้อผิดพลาด: ${result.error}`);
        }
    };

    const handleSendInvoice = async (appointmentId) => {
        const result = await sendInvoiceToCustomer(appointmentId);
        if (result.success) {
            alert('ส่งใบแจ้งหนี้ให้ลูกค้าแล้ว');
        } else {
            alert(`เกิดข้อผิดพลาด: ${result.error}`);
        }
    };

    const handleConfirmPayment = async (appointmentId) => {
        const result = await confirmPayment(appointmentId);
        if (result.success) {
            alert('ยืนยันการชำระเงินสำเร็จ');
        } else {
            alert(`เกิดข้อผิดพลาด: ${result.error}`);
        }
    };

    const handleSendReviewRequest = async (appointmentId) => {
        const result = await sendReviewRequestToCustomer(appointmentId);
        if (result.success) {
            alert('ส่งคำขอรีวิวให้ลูกค้าแล้ว');
        } else {
            alert(`เกิดข้อผิดพลาด: ${result.error}`);
        }
    };
    

    if (loading) {
        return <div className="text-center p-10">Loading Dashboard...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            {appointmentToCancel && <CancelAppointmentModal appointment={appointmentToCancel} onClose={() => setAppointmentToCancel(null)} onConfirm={handleConfirmCancel} />}
            {appointmentToInvoice && <InvoicePreviewModal appointment={appointmentToInvoice} onClose={() => setAppointmentToInvoice(null)} onConfirm={handleSendInvoice} />}
            
            {/* --- NEW: Stats Section --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="รอยืนยัน" value={stats.awaitingConfirmation} color={{bg: 'bg-yellow-100', ring: 'ring-yellow-500'}} icon={'⏰'} onClick={() => handleStatFilterClick('awaiting_confirmation')} isActive={statusFilter === 'awaiting_confirmation' && dateFilter === 'all'}/>
                <StatCard title="ยืนยันแล้ว" value={stats.confirmedAppointments} color={{bg: 'bg-blue-100', ring: 'ring-blue-500'}} icon={''} onClick={() => handleStatFilterClick('confirmed')} isActive={statusFilter === 'confirmed' && dateFilter === 'all'}/>
                <StatCard title="นัดหมายวันนี้" value={stats.appointmentsToday} color={{bg: 'bg-green-100', ring: 'ring-green-500'}} icon={'➡️'} onClick={() => handleStatFilterClick('confirmed', 'today')} isActive={statusFilter === 'confirmed' && dateFilter === 'today'}/>
                <StatCard title="เสร็จสิ้นวันนี้" value={stats.completedToday} color={{bg: 'bg-purple-100', ring: 'ring-purple-500'}} icon={'⬅️'} onClick={() => handleStatFilterClick('completed', 'today')} isActive={statusFilter === 'completed' && dateFilter === 'today'}/>
            </div>

            {/* --- FILTER BAR (status / date / search) --- */}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border rounded-md bg-white">
                            <option value="all">ทั้งหมด</option>
                            <option value="awaiting_confirmation">รอยืนยัน</option>
                            <option value="confirmed">ยืนยันแล้ว</option>
                            <option value="completed">เสร็จสิ้น</option>
                            <option value="cancelled">ยกเลิก</option>
                        </select>
                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="p-2 border rounded-md bg-white">
                            <option value="all">ทุกวันที่</option>
                            <option value="today">วันนี้</option>
                        </select>
                        <input placeholder="ค้นหาชื่อ/เบอร์/บริการ" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="p-2 border rounded-md" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setStatusFilter('all'); setDateFilter('all'); setSearchQuery(''); }} className="px-3 py-2 bg-gray-100 rounded-md">ล้าง</button>
                    </div>
                </div>
                
                {/* --- NEW: Appointment Cards Grid --- */}
                <div className="mt-4">
                    {filteredAppointments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredAppointments.map(appointment => (
                                <AppointmentCard 
                                    key={appointment.id} 
                                    appointment={appointment} 
                                    beauticians={beauticians} 
                                    onCancel={setAppointmentToCancel}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500">
                            <p className="font-semibold">ไม่พบรายการนัดหมาย</p>
                            <p className="text-sm">ไม่มีรายการที่ตรงกับเงื่อนไขที่เลือก</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}