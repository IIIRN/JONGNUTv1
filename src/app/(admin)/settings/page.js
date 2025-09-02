"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { saveNotificationSettings, saveBookingSettings } from '@/app/actions/settingsActions';
import { fetchAllAdmins } from '@/app/actions/adminActions';
import { sendDailyReportNow } from '@/app/actions/reportActions'; 

// --- Helper Components ---

const SettingsCard = ({ title, children, className = '' }) => (
    <div className={`bg-white p-4 rounded-lg shadow-md h-full flex flex-col ${className}`}>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">{title}</h2>
        <div className="space-y-3 text-sm flex-grow">{children}</div>
    </div>
);

const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
    </div>
);

// --- Main Page Component ---

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState({
        reportRecipients: [],
        adminNotifications: { enabled: true, newBooking: true, bookingCancelled: true, paymentReceived: true },
        customerNotifications: { enabled: true, appointmentConfirmed: true, appointmentCancelled: true, appointmentReminder: true },
    });
    const [bookingSettings, setBookingSettings] = useState({ 
        useBeautician: false,
        totalBeauticians: 1,
        timeQueues: [],
        weeklySchedule: {},
        holidayDates: []
    });
    const [allAdmins, setAllAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false); 
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const settingsRef = doc(db, 'settings', 'notifications');
                const docSnap = await getDoc(settingsRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }

                const bookSettingsRef = doc(db, 'settings', 'booking');
                const bookDocSnap = await getDoc(bookSettingsRef);
                if (bookDocSnap.exists()) {
                    setBookingSettings(prev => ({ ...prev, ...bookDocSnap.data() }));
                }
                
                const adminResult = await fetchAllAdmins();
                if (adminResult.success) {
                    setAllAdmins(adminResult.admins);
                }

            } catch (error) {
                console.error("Error fetching initial data:", error);
                setMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleNotificationChange = (group, key, value) => {
        setSettings(prev => ({
            ...prev,
            [group]: { ...prev[group], [key]: value }
        }));
    };
    
    const handleRecipientChange = (e) => {
        const { value, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            reportRecipients: checked ? [...(prev.reportRecipients || []), value] : (prev.reportRecipients || []).filter(id => id !== value)
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            // Create clean copies of the settings objects without Timestamp fields
            const { updatedAt: nUpdatedAt, ...notificationData } = settings;
            const { updatedAt: bUpdatedAt, ...cleanBookingSettings } = bookingSettings;


            const results = await Promise.all([
                saveNotificationSettings(notificationData),
                saveBookingSettings(cleanBookingSettings)
            ]);
            if (results.every(r => r.success)) {
                setMessage('บันทึกการตั้งค่าสำเร็จ!');
            } else {
                throw new Error('มีข้อผิดพลาดในการบันทึก');
            }
        } catch (error) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    const handleSendNow = async () => {
        setIsSending(true);
        setMessage('');
        try {
            const result = await sendDailyReportNow();
            if (result.success) {
                setMessage(result.message || 'ส่ง Report สำเร็จ!');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
             setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSending(false);
            setTimeout(() => setMessage(''), 5000);
        }
    };

    if (loading) return <div className="text-center p-10">กำลังโหลดการตั้งค่า...</div>;

    return (
        <div className="container mx-auto p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-indigo-700 disabled:bg-gray-400"
                >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
            </div>
             {message && <p className="text-center text-sm text-green-600 mb-4">{message}</p>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* --- Column 1: Booking & Time --- */}
                <div className="space-y-6">
                    <SettingsCard title="โหมดและคิวการจอง">
                        <Toggle 
                            label="โหมดเลือกช่าง" 
                            checked={bookingSettings.useBeautician}
                            onChange={(value) => setBookingSettings(prev => ({...prev, useBeautician: value}))}
                        />
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">{bookingSettings.useBeautician ? 'จำนวนช่างทั้งหมด' : 'จำนวนคิวสูงสุด (ค่าเริ่มต้น)'}</label>
                            <input type="number" min={1} value={bookingSettings.totalBeauticians || ''} onChange={e => setBookingSettings(prev => ({ ...prev, totalBeauticians: e.target.value.replace(/[^0-9]/g, '') }))} className="border rounded-md px-2 py-1 w-full text-sm"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">กำหนดคิว/ช่าง ตามช่วงเวลา</label>
                            <div className="flex gap-2 items-center mb-2">
                                <input type="time" value={bookingSettings._queueTime || ''} onChange={e => setBookingSettings(prev => ({ ...prev, _queueTime: e.target.value }))} className="border rounded-md px-2 py-1 text-sm flex-1"/>
                                <input type="number" min={1} value={bookingSettings._queueCount || ''} onChange={e => setBookingSettings(prev => ({ ...prev, _queueCount: e.target.value.replace(/[^0-9]/g, '') }))} className="border rounded-md px-2 py-1 w-16 text-sm" placeholder={bookingSettings.useBeautician ? "ช่าง" : "คิว"}/>
                                <button type="button" className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 text-sm" onClick={() => setBookingSettings(prev => ({...prev, timeQueues: [...(prev.timeQueues || []), { time: prev._queueTime, count: parseInt(prev._queueCount) }], _queueTime: '', _queueCount: '' }))} disabled={!bookingSettings._queueTime || !bookingSettings._queueCount}>เพิ่ม</button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {(bookingSettings.timeQueues || []).map(q => (
                                    <span key={q.time} className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                        {q.time} ({q.count})
                                        <button type="button" className="ml-1.5 text-red-500 hover:text-red-700" onClick={() => setBookingSettings(prev => ({...prev, timeQueues: prev.timeQueues.filter(x => x.time !== q.time)}))}>×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </SettingsCard>
                </div>

                {/* --- Column 2: Schedule & Holidays --- */}
                <div className="space-y-6">
                    <SettingsCard title="เวลาทำการ">
                        {["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"].map((dayName, dayIndex) => {
                            const day = bookingSettings.weeklySchedule?.[dayIndex] || { isOpen: false, openTime: '09:00', closeTime: '18:00' };
                            return (
                                <div key={dayIndex} className="flex items-center gap-3">
                                    <span className="w-16 font-medium text-gray-700 text-sm">{dayName}</span>
                                    <Toggle checked={day.isOpen} onChange={(value) => setBookingSettings(prev => ({...prev, weeklySchedule: {...prev.weeklySchedule, [dayIndex]: {...day, isOpen: value}}}))} />
                                    {day.isOpen && (
                                        <div className="flex items-center gap-1">
                                            <input type="time" value={day.openTime} onChange={e => setBookingSettings(prev => ({...prev, weeklySchedule: {...prev.weeklySchedule, [dayIndex]: {...day, openTime: e.target.value}}}))} className="border rounded px-1 py-0.5 text-xs"/>
                                            <span className="text-xs">-</span>
                                            <input type="time" value={day.closeTime} onChange={e => setBookingSettings(prev => ({...prev, weeklySchedule: {...prev.weeklySchedule, [dayIndex]: {...day, closeTime: e.target.value}}}))} className="border rounded px-1 py-0.5 text-xs"/>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </SettingsCard>
                    <SettingsCard title="วันหยุดพิเศษ">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">เลือกวันที่</label>
                                <input type="date" value={bookingSettings._newHolidayDate || ''} onChange={e => setBookingSettings(prev => ({ ...prev, _newHolidayDate: e.target.value }))} className="border rounded-md px-2 py-1 w-full text-sm" min={new Date().toISOString().split('T')[0]}/>
                            </div>
                            <button type="button" onClick={() => setBookingSettings(prev => ({...prev, holidayDates: [...(prev.holidayDates || []), { date: prev._newHolidayDate }], _newHolidayDate: ''}))} disabled={!bookingSettings._newHolidayDate} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">เพิ่ม</button>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto border rounded-lg p-2">
                           {(bookingSettings.holidayDates || []).sort((a, b) => new Date(a.date) - new Date(b.date)).map((holiday, index) => (
                                <div key={index} className="flex items-center justify-between text-xs p-1 bg-gray-50 rounded">
                                    <span>{new Date(holiday.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    <button type="button" onClick={() => setBookingSettings(prev => ({...prev, holidayDates: prev.holidayDates.filter((_, i) => i !== index)}))} className="text-red-500 hover:text-red-700">ลบ</button>
                                </div>
                            ))}
                        </div>
                    </SettingsCard>
                </div>
                
                {/* --- Column 3: Notifications & Reports --- */}
                <div className="space-y-6">
                    <SettingsCard title="การแจ้งเตือน LINE">
                        <Toggle label="แจ้งเตือน Admin ทั้งหมด" checked={settings.adminNotifications.enabled} onChange={(value) => handleNotificationChange('adminNotifications', 'enabled', value)}/>
                        {settings.adminNotifications.enabled && (
                            <div className="pl-4 border-l-2 ml-4 space-y-2 text-xs">
                                <Toggle label="เมื่อมีการจองใหม่" checked={settings.adminNotifications.newBooking} onChange={(value) => handleNotificationChange('adminNotifications', 'newBooking', value)} />
                                <Toggle label="เมื่อมีการยกเลิก" checked={settings.adminNotifications.bookingCancelled} onChange={(value) => handleNotificationChange('adminNotifications', 'bookingCancelled', value)} />
                                <Toggle label="เมื่อมีการชำระเงิน" checked={settings.adminNotifications.paymentReceived} onChange={(value) => handleNotificationChange('adminNotifications', 'paymentReceived', value)} />
                            </div>
                        )}
                        <hr/>
                        <Toggle label="แจ้งเตือนลูกค้า ทั้งหมด" checked={settings.customerNotifications.enabled} onChange={(value) => handleNotificationChange('customerNotifications', 'enabled', value)}/>
                        {settings.customerNotifications.enabled && (
                            <div className="pl-4 border-l-2 ml-4 space-y-2 text-xs">
                                <Toggle label="เมื่อยืนยันการนัดหมาย" checked={settings.customerNotifications.appointmentConfirmed} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentConfirmed', value)} />
                                <Toggle label="เมื่อยกเลิกการนัดหมาย" checked={settings.customerNotifications.appointmentCancelled} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentCancelled', value)} />
                                <Toggle label="แจ้งเตือนล่วงหน้า 1 ชม." checked={settings.customerNotifications.appointmentReminder} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentReminder', value)} />
                            </div>
                        )}
                    </SettingsCard>
                    <SettingsCard title="ตั้งค่า Report สรุปรายวัน">
                        <div>
                            <label className="block text-xs font-medium text-gray-700">เลือกผู้รับ Report</label>
                            <div className="mt-1 space-y-1 border p-2 rounded-md max-h-24 overflow-y-auto">
                                {allAdmins.map(admin => (
                                    <div key={admin.id} className="flex items-center">
                                        <input id={`admin-${admin.id}`} type="checkbox" value={admin.id} checked={(settings.reportRecipients || []).includes(admin.id)} onChange={handleRecipientChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                                        <label htmlFor={`admin-${admin.id}`} className="ml-2 text-sm text-gray-900">{admin.firstName} {admin.lastName}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleSendNow} disabled={isSending} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-green-700 disabled:bg-gray-400 text-sm">
                            {isSending ? 'กำลังส่ง...' : 'ส่ง Report วันนี้ทันที'}
                        </button>
                    </SettingsCard>
                </div>
            </div>
        </div>
    );
}