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
    });
    const [bookingSettings, setBookingSettings] = useState({ bufferHours: 0 });
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

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const notificationData = {
                reportRecipients: settings.reportRecipients || []
            };
            const bookingData = {
                bufferHours: bookingSettings.bufferHours || 0,
                availableTimes: bookingSettings.availableTimes || [],
                holidays: Array.isArray(bookingSettings.holidays) ? bookingSettings.holidays.map(Number) : [],
                timeQueues: bookingSettings.timeQueues || [],
                useBeautician: !!bookingSettings.useBeautician,
                totalBeauticians: bookingSettings.totalBeauticians || '',
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
                <SettingsCard title="ตั้งค่าช่วงเวลาและคิวสูงสุดต่อช่วง (ไม่กำหนดพนักงาน)">
                    <div className="mb-4 flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">เปิดใช้งานตัวเลือกพนักงาน</label>
                        <button
                            type="button"
                            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${bookingSettings.useBeautician ? 'bg-green-500' : 'bg-gray-300'}`}
                            onClick={() => setBookingSettings(prev => ({ ...prev, useBeautician: !prev.useBeautician }))}
                        >
                            <span className={`h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 ${bookingSettings.useBeautician ? 'translate-x-6' : ''}`}></span>
                        </button>
                        <span className="text-xs text-gray-500">{bookingSettings.useBeautician ? 'เปิด' : 'ปิด'}</span>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนช่างทั้งหมด (ใช้สำหรับคำนวณคิวสูงสุดต่อช่วงเวลา)</label>
                        <input
                            type="number"
                            min={1}
                            value={bookingSettings.totalBeauticians !== undefined && bookingSettings.totalBeauticians !== null ? String(bookingSettings.totalBeauticians) : ''}
                            onChange={e => setBookingSettings(prev => ({ ...prev, totalBeauticians: e.target.value.replace(/[^0-9]/g, '') }))}
                            className="border rounded-md px-2 py-1 w-24"
                            placeholder="จำนวนช่าง"
                        />
                        <p className="text-xs text-gray-500 mt-1">ใช้สำหรับคำนวณคิวสูงสุดต่อช่วงเวลา</p>
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
                            placeholder="จำนวนคิว"
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
                                {q.time} <span className="mx-1">•</span> {q.count} คิว
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
                    <p className="text-xs text-gray-500 mt-1">เพิ่มช่วงเวลาและจำนวนคิวสูงสุด เช่น 11:00 3 คิว, 13:00 8 คิว</p>
                </SettingsCard>
                <SettingsCard title="ตั้งค่าวันหยุดและเวลาทำการ">
                    <div className="mb-4 flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">เปิดใช้งานตัวเลือกพนักงาน</label>
                        <button
                            type="button"
                            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${bookingSettings.useBeautician ? 'bg-green-500' : 'bg-gray-300'}`}
                            onClick={() => setBookingSettings(prev => ({ ...prev, useBeautician: !prev.useBeautician }))}
                        >
                            <span className={`h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 ${bookingSettings.useBeautician ? 'translate-x-6' : ''}`}></span>
                        </button>
                        <span className="text-xs text-gray-500">{bookingSettings.useBeautician ? 'เปิด' : 'ปิด'}</span>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">วันหยุดประจำสัปดาห์</label>
                        <div className="flex flex-wrap gap-2">
                            {["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"].map((day, idx) => (
                                <label key={day} className="flex items-center gap-1">
                                    <input
                                        type="checkbox"
                                        name="holidays"
                                        value={idx}
                                        checked={bookingSettings.holidays?.includes(idx)}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setBookingSettings(prev => {
                                                const holidays = prev.holidays || [];
                                                return {
                                                    ...prev,
                                                    holidays: checked
                                                        ? [...holidays, idx]
                                                        : holidays.filter(d => d !== idx)
                                                };
                                            });
                                        }}
                                    />
                                    <span>{day}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่เปิดให้จอง (เพิ่มทีละช่วงเวลา)</label>
                        <div className="flex gap-2 items-center mb-2">
                            <input
                                type="time"
                                value={bookingSettings._newTime !== undefined && bookingSettings._newTime !== null ? bookingSettings._newTime : ''}
                                onChange={e => setBookingSettings(prev => ({ ...prev, _newTime: e.target.value }))}
                                className="border rounded-md px-2 py-1"
                            />
                            <button
                                type="button"
                                className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600"
                                onClick={() => {
                                    const t = bookingSettings._newTime;
                                    if (!t) return;
                                    setBookingSettings(prev => {
                                        const arr = prev.availableTimes || [];
                                        if (arr.includes(t)) return prev;
                                        return { ...prev, availableTimes: [...arr, t], _newTime: '' };
                                    });
                                }}
                                disabled={!bookingSettings._newTime}
                            >
                                เพิ่ม
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(bookingSettings.availableTimes || []).map(timeStr => (
                                <span key={timeStr} className="inline-flex items-center bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                                    {timeStr}
                                    <button
                                        type="button"
                                        className="ml-2 text-red-500 hover:text-red-700"
                                        onClick={() => setBookingSettings(prev => ({
                                            ...prev,
                                            availableTimes: (prev.availableTimes || []).filter(t => t !== timeStr)
                                        }))}
                                        aria-label={`ลบ ${timeStr}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">เวลาที่เปิดให้จองและจำนวนช่างจะใช้ร่วมกันในการคำนวณคิวสูงสุดต่อช่วงเวลา เช่น ถ้ามี 5 ช่าง เวลานี้จะจองได้สูงสุด 5 คิว</p>
                    </div>
                </SettingsCard>



                {/* [!code focus start] */}
                {/* --- นำโค้ดส่วน Report กลับมา --- */}
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