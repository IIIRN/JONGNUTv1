"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { saveNotificationSettings, saveBookingSettings } from '@/app/actions/settingsActions';
import { fetchAllAdmins } from '@/app/actions/adminActions';
import { sendDailyReportNow } from '@/app/actions/reportActions'; 

const SettingsCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{title}</h2>
        <div className="space-y-4">{children}</div>
    </div>
);

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState({
        reportRecipients: [],
        lineNotifications: {
            enabled: true,
            newBooking: true,
            bookingCancelled: true,
            bookingModified: true,
            paymentReceived: true,
            reminderNotifications: true
        }
    });
    const [bookingSettings, setBookingSettings] = useState({ 
        bufferHours: 0,
        useBeautician: false,
        totalBeauticians: 1,
        timeQueues: [],
        weeklySchedule: {
            0: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // อาทิตย์
            1: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // จันทร์
            2: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // อังคาร
            3: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // พุธ
            4: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // พฤหัสบดี
            5: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // ศุกร์
            6: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, // เสาร์
        },
        holidayDates: [] // วันหยุดพิเศษ เก็บเป็น array ของ date strings
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
                    const data = docSnap.data();
                    setSettings(prev => ({ 
                        ...prev, 
                        ...data,
                        lineNotifications: data.lineNotifications || {
                            enabled: true,
                            newBooking: true,
                            bookingCancelled: true,
                            bookingModified: true,
                            paymentReceived: true,
                            reminderNotifications: true
                        }
                    }));
                }

                const bookSettingsRef = doc(db, 'settings', 'booking');
                const bookDocSnap = await getDoc(bookSettingsRef);
                if (bookDocSnap.exists()) {
                    const data = bookDocSnap.data();
                    // รวม weeklySchedule จากฐานข้อมูลกับค่าเริ่มต้น
                    const defaultSchedule = {
                        0: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        1: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        2: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        3: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        4: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        5: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        6: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                    };
                    setBookingSettings(prev => ({ 
                        ...prev, 
                        ...data,
                        weeklySchedule: data.weeklySchedule ? { ...defaultSchedule, ...data.weeklySchedule } : defaultSchedule,
                        holidayDates: data.holidayDates || []
                    }));
                }

                const adminResult = await fetchAllAdmins();
                if (adminResult.success) {
                    setAllAdmins(adminResult.admins);
                } else {
                    throw new Error(adminResult.error);
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
    
    const handleRecipientChange = (e) => {
        const { value, checked } = e.target;
        setSettings(prev => {
            const recipients = prev.reportRecipients || [];
            if (checked) {
                return { ...prev, reportRecipients: [...recipients, value] };
            } else {
                return { ...prev, reportRecipients: recipients.filter(id => id !== value) };
            }
        });
    };


    const handleBookingSettingChange = (e) => {
        const { name, value } = e.target;
        setBookingSettings(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleLineNotificationChange = (setting, value) => {
        setSettings(prev => ({
            ...prev,
            lineNotifications: {
                ...prev.lineNotifications,
                [setting]: value
            }
        }));
    };

    // Whenever timeQueues changes, sync availableTimes to match timeQueues
    useEffect(() => {
        setBookingSettings(prev => ({
            ...prev,
            availableTimes: Array.isArray(prev.timeQueues) ? prev.timeQueues.map(q => q.time) : []
        }));
    }, [bookingSettings.timeQueues]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const notificationData = {
                reportRecipients: settings.reportRecipients || [],
                lineNotifications: settings.lineNotifications || {
                    enabled: true,
                    newBooking: true,
                    bookingCancelled: true,
                    bookingModified: true,
                    paymentReceived: true,
                    reminderNotifications: true
                }
            };

            const bookingData = {
                bufferHours: bookingSettings.bufferHours || 0,
                // availableTimes always sync with timeQueues
                availableTimes: Array.isArray(bookingSettings.timeQueues) ? bookingSettings.timeQueues.map(q => q.time) : [],
                timeQueues: bookingSettings.timeQueues || [],
                useBeautician: !!bookingSettings.useBeautician,
                totalBeauticians: bookingSettings.totalBeauticians || '',
                weeklySchedule: bookingSettings.weeklySchedule || {},
                holidayDates: bookingSettings.holidayDates || [],
            };

            const results = await Promise.all([
                saveNotificationSettings(notificationData),
                saveBookingSettings(bookingData)
            ]);

            if (results.every(r => r.success)) {
                setMessage('บันทึกการตั้งค่าทั้งหมดสำเร็จ!');
            } else {
                throw new Error('มีข้อผิดพลาดในการบันทึกอย่างน้อยหนึ่งรายการ');
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

    if (loading) {
        return <div className="text-center p-10">กำลังโหลดการตั้งค่า...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-6">ตั้งค่าระบบ</h1>

            <div className="max-w-2xl mx-auto space-y-6">
                <SettingsCard title="โหมดการจอง">
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-semibold text-blue-800 mb-3">เลือกโหมดการจอง</h3>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="bookingMode"
                                    checked={!bookingSettings.useBeautician}
                                    onChange={() => setBookingSettings(prev => ({ ...prev, useBeautician: false }))}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="font-medium text-gray-900">โหมดคิวธรรมดา (ไม่เลือกช่าง)</div>
                                    <div className="text-sm text-gray-600">ลูกค้าเลือกเฉพาะวันและเวลา ระบบจะจัดช่างให้อัตโนมัติ</div>
                                </div>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="bookingMode"
                                    checked={bookingSettings.useBeautician}
                                    onChange={() => setBookingSettings(prev => ({ ...prev, useBeautician: true }))}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="font-medium text-gray-900">โหมดเลือกช่าง</div>
                                    <div className="text-sm text-gray-600">ลูกค้าสามารถเลือกช่างที่ต้องการได้</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </SettingsCard>

                <SettingsCard title={bookingSettings.useBeautician ? "ตั้งค่าช่างเสริมสวย" : "ตั้งค่าคิวและเวลา"}>
                    {!bookingSettings.useBeautician && (
                        <div className="mb-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                            <p className="text-sm text-yellow-800">
                                <strong>โหมดคิวธรรมดา:</strong> กำหนดจำนวนคิวสูงสุดในแต่ละช่วงเวลา 
                                ระบบจะไม่แสดงตัวเลือกช่างให้ลูกค้า
                            </p>
                        </div>
                    )}
                    {bookingSettings.useBeautician && (
                        <div className="mb-4 p-3 bg-green-50 rounded border border-green-200">
                            <p className="text-sm text-green-800">
                                <strong>โหมดเลือกช่าง:</strong> ลูกค้าสามารถเลือกช่างที่ต้องการได้ 
                                แต่ละช่างจะมีเวลาทำงานและคิวของตัวเอง
                            </p>
                        </div>
                    )}
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {bookingSettings.useBeautician ? 'จำนวนช่างทั้งหมด' : 'จำนวนคิวสูงสุดพร้อมกัน (ถ้าไม่กำหนดเฉพาะช่วงเวลา)'}
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={bookingSettings.totalBeauticians !== undefined && bookingSettings.totalBeauticians !== null ? String(bookingSettings.totalBeauticians) : ''}
                            onChange={e => setBookingSettings(prev => ({ ...prev, totalBeauticians: e.target.value.replace(/[^0-9]/g, '') }))}
                            className="border rounded-md px-2 py-1 w-24"
                            placeholder={bookingSettings.useBeautician ? "จำนวนช่าง" : "จำนวนคิว"}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {bookingSettings.useBeautician 
                                ? 'จำนวนช่างที่พร้อมให้บริการในร้าน' 
                                : 'จำนวนคิวสูงสุดที่รับได้พร้อมกันในช่วงเวลาที่ไม่ได้กำหนดเฉพาะ'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center mb-2">
                        <input
                            type="time"
                            value={bookingSettings._queueTime !== undefined && bookingSettings._queueTime !== null ? bookingSettings._queueTime : ''}
                            onChange={e => setBookingSettings(prev => ({ ...prev, _queueTime: e.target.value }))}
                            className="border rounded-md px-2 py-1"
                        />
                        <input
                            type="number"
                            min={1}
                            value={bookingSettings._queueCount !== undefined && bookingSettings._queueCount !== null ? String(bookingSettings._queueCount) : ''}
                            onChange={e => setBookingSettings(prev => ({ ...prev, _queueCount: e.target.value.replace(/[^0-9]/g, '') }))}
                            className="border rounded-md px-2 py-1 w-20"
                            placeholder={bookingSettings.useBeautician ? "จำนวนช่าง" : "จำนวนคิว"}
                        />
                        <button
                            type="button"
                            className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600"
                            onClick={() => {
                                const t = bookingSettings._queueTime;
                                const n = parseInt(bookingSettings._queueCount);
                                if (!t || !n || n < 1) return;
                                setBookingSettings(prev => {
                                    const arr = prev.timeQueues || [];
                                    if (arr.some(q => q.time === t)) return prev;
                                    return {
                                        ...prev,
                                        timeQueues: [...arr, { time: t, count: n }],
                                        _queueTime: '',
                                        _queueCount: ''
                                    };
                                });
                            }}
                            disabled={!bookingSettings._queueTime || !bookingSettings._queueCount}
                        >
                            เพิ่ม
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(bookingSettings.timeQueues || []).map(q => (
                            <span key={q.time} className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                                {q.time} <span className="mx-1">•</span> {q.count} {bookingSettings.useBeautician ? 'ช่าง' : 'คิว'}
                                <button
                                    type="button"
                                    className="ml-2 text-red-500 hover:text-red-700"
                                    onClick={() => setBookingSettings(prev => ({
                                        ...prev,
                                        timeQueues: (prev.timeQueues || []).filter(x => x.time !== q.time)
                                    }))}
                                    aria-label={`ลบ ${q.time}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {bookingSettings.useBeautician 
                            ? 'กำหนดจำนวนช่างที่พร้อมให้บริการในช่วงเวลาต่างๆ'
                            : 'กำหนดจำนวนคิวสูงสุดที่รับได้ในช่วงเวลาต่างๆ เช่น 11:00 3 คิว, 13:00 8 คิว'}
                    </p>
                </SettingsCard>
                <SettingsCard title="การตั้งค่าวันและเวลาทำการ">
                    <div className="space-y-6">
                        {/* Weekly Schedule */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">ตารางเวลาทำการประจำสัปดาห์</h3>
                            <div className="space-y-3">
                                {["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"].map((dayName, dayIndex) => {
                                    const daySchedule = bookingSettings.weeklySchedule?.[dayIndex] || { isOpen: false, openTime: '09:00', closeTime: '18:00' };
                                    return (
                                        <div key={dayIndex} className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50">
                                            <div className="w-20 font-medium text-gray-700">{dayName}</div>
                                            
                                            {/* เปิด/ปิด Toggle */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                                                        daySchedule.isOpen ? 'bg-green-500' : 'bg-gray-300'
                                                    }`}
                                                    onClick={() => setBookingSettings(prev => ({
                                                        ...prev,
                                                        weeklySchedule: {
                                                            ...prev.weeklySchedule,
                                                            [dayIndex]: {
                                                                ...daySchedule,
                                                                isOpen: !daySchedule.isOpen
                                                            }
                                                        }
                                                    }))}
                                                >
                                                    <span className={`h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 ${
                                                        daySchedule.isOpen ? 'translate-x-6' : ''
                                                    }`}></span>
                                                </button>
                                                <span className="text-sm text-gray-600 w-12">
                                                    {daySchedule.isOpen ? 'เปิด' : 'ปิด'}
                                                </span>
                                            </div>

                                            {/* เวลาทำการ */}
                                            {daySchedule.isOpen && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="time"
                                                        value={daySchedule.openTime}
                                                        onChange={e => setBookingSettings(prev => ({
                                                            ...prev,
                                                            weeklySchedule: {
                                                                ...prev.weeklySchedule,
                                                                [dayIndex]: {
                                                                    ...daySchedule,
                                                                    openTime: e.target.value
                                                                }
                                                            }
                                                        }))}
                                                        className="border rounded px-2 py-1 text-sm"
                                                    />
                                                    <span className="text-gray-500">ถึง</span>
                                                    <input
                                                        type="time"
                                                        value={daySchedule.closeTime}
                                                        onChange={e => setBookingSettings(prev => ({
                                                            ...prev,
                                                            weeklySchedule: {
                                                                ...prev.weeklySchedule,
                                                                [dayIndex]: {
                                                                    ...daySchedule,
                                                                    closeTime: e.target.value
                                                                }
                                                            }
                                                        }))}
                                                        className="border rounded px-2 py-1 text-sm"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                กำหนดวันและเวลาทำการของร้าน ลูกค้าจะสามารถจองได้เฉพาะในช่วงเวลาที่เปิดทำการเท่านั้น
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="border-t pt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-3">การตั้งค่าด่วน</h4>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newSchedule = {};
                                        for(let i = 0; i < 7; i++) {
                                            newSchedule[i] = { isOpen: true, openTime: '09:00', closeTime: '18:00' };
                                        }
                                        setBookingSettings(prev => ({ ...prev, weeklySchedule: newSchedule }));
                                    }}
                                    className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                >
                                    เปิดทุกวัน 9:00-18:00
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newSchedule = {};
                                        for(let i = 0; i < 7; i++) {
                                            newSchedule[i] = { 
                                                isOpen: i !== 0, // ปิดวันอาทิตย์
                                                openTime: '09:00', 
                                                closeTime: '18:00' 
                                            };
                                        }
                                        setBookingSettings(prev => ({ ...prev, weeklySchedule: newSchedule }));
                                    }}
                                    className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                                >
                                    จันทร์-เสาร์ 9:00-18:00
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newSchedule = {};
                                        for(let i = 0; i < 7; i++) {
                                            newSchedule[i] = { 
                                                isOpen: i >= 1 && i <= 5, // จันทร์-ศุกร์
                                                openTime: '09:00', 
                                                closeTime: '17:00' 
                                            };
                                        }
                                        setBookingSettings(prev => ({ ...prev, weeklySchedule: newSchedule }));
                                    }}
                                    className="px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                                >
                                    จันทร์-ศุกร์ 9:00-17:00
                                </button>
                            </div>
                        </div>
                    </div>
                </SettingsCard>

                <SettingsCard title="วันหยุดพิเศษ">
                    <div className="space-y-4">
                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                            <p className="text-sm text-blue-800">
                                <strong>วันหยุดพิเศษ:</strong> กำหนดวันที่จะปิดทำการเป็นพิเศษ เช่น วันหยุดนักขัตฤกษ์, วันลาพักร้อน, ฯลฯ 
                                ระบบจะไม่เปิดให้จองในวันที่กำหนดไว้
                            </p>
                        </div>

                        {/* Add Holiday Form */}
                        <div className="border p-4 rounded-lg bg-gray-50">
                            <h4 className="font-medium text-gray-700 mb-3">เพิ่มวันหยุดใหม่</h4>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-600 mb-1">
                                        เลือกวันที่
                                    </label>
                                    <input
                                        type="date"
                                        value={bookingSettings._newHolidayDate || ''}
                                        onChange={e => setBookingSettings(prev => ({ 
                                            ...prev, 
                                            _newHolidayDate: e.target.value 
                                        }))}
                                        className="border rounded-md px-3 py-2 w-full"
                                        min={new Date().toISOString().split('T')[0]} // ป้องกันเลือกวันที่ผ่านมาแล้ว
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-600 mb-1">
                                        หมายเหตุ (ไม่บังคับ)
                                    </label>
                                    <input
                                        type="text"
                                        value={bookingSettings._newHolidayNote || ''}
                                        onChange={e => setBookingSettings(prev => ({ 
                                            ...prev, 
                                            _newHolidayNote: e.target.value 
                                        }))}
                                        placeholder="เช่น วันขึ้นปีใหม่, ลาพักร้อน"
                                        className="border rounded-md px-3 py-2 w-full"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const date = bookingSettings._newHolidayDate;
                                        const note = bookingSettings._newHolidayNote || '';
                                        
                                        if (!date) return;
                                        
                                        // ตรวจสอบว่าวันที่นั้นมีอยู่แล้วหรือไม่
                                        const existing = (bookingSettings.holidayDates || []).find(h => h.date === date);
                                        if (existing) {
                                            alert('วันที่นี้ได้ถูกเพิ่มเป็นวันหยุดแล้ว');
                                            return;
                                        }

                                        setBookingSettings(prev => ({
                                            ...prev,
                                            holidayDates: [
                                                ...(prev.holidayDates || []),
                                                { 
                                                    date: date, 
                                                    note: note,
                                                    createdAt: new Date().toISOString()
                                                }
                                            ],
                                            _newHolidayDate: '',
                                            _newHolidayNote: ''
                                        }));
                                    }}
                                    disabled={!bookingSettings._newHolidayDate}
                                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    เพิ่มวันหยุด
                                </button>
                            </div>
                        </div>

                        {/* Holiday List */}
                        <div>
                            <h4 className="font-medium text-gray-700 mb-3">รายการวันหยุดพิเศษ</h4>
                            {(!bookingSettings.holidayDates || bookingSettings.holidayDates.length === 0) ? (
                                <div className="text-center p-6 text-gray-500 border rounded-lg bg-gray-50">
                                    ยังไม่ได้กำหนดวันหยุดพิเศษ
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg">
                                    {bookingSettings.holidayDates
                                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                                        .map((holiday, index) => {
                                            const dateObj = new Date(holiday.date);
                                            const isExpired = dateObj < new Date().setHours(0, 0, 0, 0);
                                            const formattedDate = dateObj.toLocaleDateString('th-TH', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                weekday: 'long'
                                            });
                                            
                                            return (
                                                <div 
                                                    key={index} 
                                                    className={`flex items-center justify-between p-3 border-b last:border-b-0 ${
                                                        isExpired ? 'bg-gray-100 opacity-60' : 'bg-white'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <div className={`font-medium ${isExpired ? 'text-gray-500' : 'text-gray-800'}`}>
                                                            {formattedDate}
                                                            {isExpired && <span className="ml-2 text-xs text-red-500">(ผ่านมาแล้ว)</span>}
                                                        </div>
                                                        {holiday.note && (
                                                            <div className={`text-sm ${isExpired ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {holiday.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (confirm(`ต้องการลบวันหยุด "${formattedDate}" หรือไม่?`)) {
                                                                setBookingSettings(prev => ({
                                                                    ...prev,
                                                                    holidayDates: (prev.holidayDates || []).filter((_, i) => i !== index)
                                                                }));
                                                            }
                                                        }}
                                                        className="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                                                        title="ลบวันหยุดนี้"
                                                    >
                                                        ลบ
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Quick Actions - ลบส่วนวันหยุดนักขัตฤกษ์ออก */}
                    </div>
                </SettingsCard>

                {/* [!code focus start] */}
                {/* --- นำโค้ดส่วน Report กลับมา --- */}
                <SettingsCard title="ตั้งค่าการแจ้งเตือน LINE">
                    <div className="space-y-4">
                        {/* Main Toggle */}
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div>
                                <div className="font-medium text-gray-900">เปิดการแจ้งเตือน LINE</div>
                                <div className="text-sm text-gray-600">เปิด/ปิดการแจ้งเตือนทั้งระบบ</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.lineNotifications?.enabled ?? true}
                                    onChange={(e) => handleLineNotificationChange('enabled', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {/* Individual Notification Settings */}
                        {settings.lineNotifications?.enabled && (
                            <div className="space-y-3">
                                <h4 className="font-medium text-gray-800">เลือกประเภทการแจ้งเตือน</h4>
                                
                                <div className="space-y-2">
                                    <label className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                        <div>
                                            <div className="font-medium text-gray-900">การจองใหม่</div>
                                            <div className="text-sm text-gray-600">แจ้งเตือนเมื่อมีลูกค้าจองใหม่</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.lineNotifications?.newBooking ?? true}
                                            onChange={(e) => handleLineNotificationChange('newBooking', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                        <div>
                                            <div className="font-medium text-gray-900">ยกเลิกการจอง</div>
                                            <div className="text-sm text-gray-600">แจ้งเตือนเมื่อลูกค้ายกเลิกการจอง</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.lineNotifications?.bookingCancelled ?? true}
                                            onChange={(e) => handleLineNotificationChange('bookingCancelled', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                        <div>
                                            <div className="font-medium text-gray-900">แก้ไขการจอง</div>
                                            <div className="text-sm text-gray-600">แจ้งเตือนเมื่อลูกค้าแก้ไขการจอง</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.lineNotifications?.bookingModified ?? true}
                                            onChange={(e) => handleLineNotificationChange('bookingModified', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                        <div>
                                            <div className="font-medium text-gray-900">การชำระเงิน</div>
                                            <div className="text-sm text-gray-600">แจ้งเตือนเมื่อได้รับการชำระเงิน</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.lineNotifications?.paymentReceived ?? true}
                                            onChange={(e) => handleLineNotificationChange('paymentReceived', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                        <div>
                                            <div className="font-medium text-gray-900">การแจ้งเตือนล่วงหน้า</div>
                                            <div className="text-sm text-gray-600">แจ้งเตือนลูกค้าก่อนนัดหมาย</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.lineNotifications?.reminderNotifications ?? true}
                                            onChange={(e) => handleLineNotificationChange('reminderNotifications', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Test Notification Button */}
                    {settings.lineNotifications?.enabled && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                            <h5 className="font-medium text-gray-800 mb-2">ทดสอบการแจ้งเตือน</h5>
                            <p className="text-sm text-gray-600 mb-3">ส่งข้อความทดสอบไปยังแอดมินทั้งหมดที่มี LINE ID</p>
                            <button
                                onClick={async () => {
                                    try {
                                        const { sendLineMessageToAllAdmins } = await import('@/app/actions/lineActions');
                                        const result = await sendLineMessageToAllAdmins('🔔 ทดสอบการแจ้งเตือน LINE\n\nหากคุณเห็นข้อความนี้ แสดงว่าระบบการแจ้งเตือนทำงานปกติ ✅');
                                        if (result.success) {
                                            alert('ส่งข้อความทดสอบสำเร็จ!');
                                        } else {
                                            alert('เกิดข้อผิดพลาดในการส่งข้อความทดสอบ');
                                        }
                                    } catch (error) {
                                        alert('เกิดข้อผิดพลาด: ' + error.message);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                            >
                                ส่งข้อความทดสอบ
                            </button>
                            
                            <button
                                onClick={async () => {
                                    try {
                                        const { sendAppointmentReminders } = await import('@/app/actions/reminderActions');
                                        const result = await sendAppointmentReminders();
                                        if (result.success) {
                                            alert(`ทดสอบการแจ้งเตือนล่วงหน้าสำเร็จ!\nส่งไปยัง: ${result.successCount} คน\nไม่สำเร็จ: ${result.failureCount} คน`);
                                        } else {
                                            alert('เกิดข้อผิดพลาดในการทดสอบการแจ้งเตือนล่วงหน้า');
                                        }
                                    } catch (error) {
                                        alert('เกิดข้อผิดพลาด: ' + error.message);
                                    }
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm ml-2"
                            >
                                ทดสอบการแจ้งเตือนล่วงหน้า
                            </button>
                        </div>
                    )}
                </SettingsCard>

                <SettingsCard title="ตั้งค่า Report สรุปรายวัน">
                    <div className='text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200'>
                        <p className='font-bold'>หมายเหตุ:</p>
                        <p>
                            เวลาในการส่ง Report อัตโนมัติถูกกำหนดไว้ในไฟล์ `vercel.json` หากต้องการเปลี่ยนเวลา กรุณาติดต่อผู้พัฒนา
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เลือกผู้รับ Report</label>
                        <div className="mt-2 space-y-2 border p-4 rounded-md max-h-48 overflow-y-auto">
                            {allAdmins.map(admin => (
                                <div key={admin.id} className="flex items-center">
                                    <input
                                        id={`admin-${admin.id}`}
                                        name="reportRecipients"
                                        type="checkbox"
                                        value={admin.id}
                                        checked={(settings.reportRecipients || []).includes(admin.id)}
                                        onChange={handleRecipientChange}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`admin-${admin.id}`} className="ml-3 text-sm text-gray-900">
                                        {admin.firstName} {admin.lastName}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-t pt-4">
                        <button
                            onClick={handleSendNow}
                            disabled={isSending}
                            className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-green-700 disabled:bg-gray-400"
                        >
                            {isSending ? 'กำลังส่ง Report...' : 'ส่ง Report สรุปของวันนี้ทันที'}
                        </button>
                    </div>
                </SettingsCard>
                {/* [!code focus end] */}

                <div className="flex justify-end items-center">
                    {message && <p className="text-sm text-gray-600 mr-4">{message}</p>}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
                    </button>
                </div>
            </div>
        </div>
    );
}