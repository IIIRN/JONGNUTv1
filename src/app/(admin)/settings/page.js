"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { saveNotificationSettings, saveBookingSettings } from '@/app/actions/settingsActions';
import { fetchAllAdmins } from '@/app/actions/adminActions';
import { sendDailyReportNow } from '@/app/actions/reportActions';

// --- Components ย่อยเพื่อความกระชับ ---
const SettingsCard = ({ title, children, className = '' }) => (
    <div className={`bg-white p-4 rounded-lg shadow-md ${className}`}>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">{title}</h2>
        <div className="space-y-3">{children}</div>
    </div>
);

const ToggleSwitch = ({ checked, onChange, labelOn = "เปิด", labelOff = "ปิด" }) => (
    <div className="flex items-center gap-2">
        <button
            type="button"
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
            onClick={onChange}
        >
            <span className={`h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`}></span>
        </button>
        <span className="text-sm text-gray-600 w-10">{checked ? labelOn : labelOff}</span>
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
            0: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
            1: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
            2: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
            3: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
            4: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
            5: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
            6: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        },
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
                    const data = docSnap.data();
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        lineNotifications: data.lineNotifications || prev.lineNotifications
                    }));
                }

                const bookSettingsRef = doc(db, 'settings', 'booking');
                const bookDocSnap = await getDoc(bookSettingsRef);
                if (bookDocSnap.exists()) {
                    const data = bookDocSnap.data();
                    const defaultSchedule = {
                        0: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, 1: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        2: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, 3: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
                        4: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, 5: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
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
                if (adminResult.success) setAllAdmins(adminResult.admins);
                else throw new Error(adminResult.error);

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
            if (checked) return { ...prev, reportRecipients: [...recipients, value] };
            return { ...prev, reportRecipients: recipients.filter(id => id !== value) };
        });
    };
    
    const handleLineNotificationChange = (setting, value) => {
        setSettings(prev => ({
            ...prev,
            lineNotifications: { ...prev.lineNotifications, [setting]: value }
        }));
    };

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
                lineNotifications: settings.lineNotifications || {}
            };
            const bookingData = {
                bufferHours: bookingSettings.bufferHours || 0,
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
            if (results.every(r => r.success)) setMessage('บันทึกการตั้งค่าทั้งหมดสำเร็จ!');
            else throw new Error('มีข้อผิดพลาดในการบันทึกอย่างน้อยหนึ่งรายการ');
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
            if (result.success) setMessage(result.message || 'ส่ง Report สำเร็จ!');
            else throw new Error(result.error);
        } catch (error) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSending(false);
            setTimeout(() => setMessage(''), 5000);
        }
    };

    if (loading) return <div className="text-center p-10">กำลังโหลดการตั้งค่า...</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">ตั้งค่าระบบ</h1>

            <div className="space-y-4">
                {/* --- ส่วนบน: โหมดจอง และ คิว/ช่าง --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingsCard title="โหมดการจอง">
                        <div className="space-y-2">
                            <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-blue-50">
                                <input type="radio" name="bookingMode" checked={!bookingSettings.useBeautician}
                                    onChange={() => setBookingSettings(prev => ({ ...prev, useBeautician: false }))}
                                    className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="font-medium text-gray-800 text-sm">โหมดคิวธรรมดา (ไม่เลือกช่าง)</div>
                                    <div className="text-xs text-gray-500">ลูกค้าเลือกเฉพาะเวลา ระบบจัดคิว/ช่างอัตโนมัติ</div>
                                </div>
                            </label>
                            <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-blue-50">
                                <input type="radio" name="bookingMode" checked={bookingSettings.useBeautician}
                                    onChange={() => setBookingSettings(prev => ({ ...prev, useBeautician: true }))}
                                    className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="font-medium text-gray-800 text-sm">โหมดเลือกช่าง</div>
                                    <div className="text-xs text-gray-500">ลูกค้าสามารถเลือกช่างที่ต้องการได้โดยตรง</div>
                                </div>
                            </label>
                        </div>
                    </SettingsCard>

                    <SettingsCard title={bookingSettings.useBeautician ? "ตั้งค่าช่าง" : "ตั้งค่าคิว"}>
                        <div className="space-y-3">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {bookingSettings.useBeautician ? 'จำนวนช่างทั้งหมด' : 'จำนวนคิวสูงสุดพร้อมกัน (ค่าเริ่มต้น)'}
                                </label>
                                <input
                                    type="number" min={1}
                                    value={bookingSettings.totalBeauticians ?? ''}
                                    onChange={e => setBookingSettings(prev => ({ ...prev, totalBeauticians: e.target.value.replace(/[^0-9]/g, '') }))}
                                    className="border rounded-md px-2 py-1 w-24 text-sm"
                                    placeholder={bookingSettings.useBeautician ? "ช่าง" : "คิว"}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {bookingSettings.useBeautician ? 'กำหนดจำนวนช่างเฉพาะช่วงเวลา' : 'กำหนดจำนวนคิวเฉพาะช่วงเวลา'}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input type="time"
                                        value={bookingSettings._queueTime || ''}
                                        onChange={e => setBookingSettings(prev => ({ ...prev, _queueTime: e.target.value }))}
                                        className="border rounded-md px-2 py-1 text-sm"
                                    />
                                    <input type="number" min={1}
                                        value={bookingSettings._queueCount || ''}
                                        onChange={e => setBookingSettings(prev => ({ ...prev, _queueCount: e.target.value.replace(/[^0-9]/g, '') }))}
                                        className="border rounded-md px-2 py-1 w-20 text-sm"
                                        placeholder={bookingSettings.useBeautician ? "ช่าง" : "คิว"}
                                    />
                                    <button type="button"
                                        className="bg-indigo-500 text-white px-3 py-1 text-sm rounded hover:bg-indigo-600 disabled:bg-gray-400"
                                        onClick={() => {
                                            const t = bookingSettings._queueTime; const n = parseInt(bookingSettings._queueCount);
                                            if (!t || !n || n < 1) return;
                                            setBookingSettings(prev => {
                                                const arr = prev.timeQueues || [];
                                                if (arr.some(q => q.time === t)) return prev;
                                                return { ...prev, timeQueues: [...arr, { time: t, count: n }].sort((a, b) => a.time.localeCompare(b.time)), _queueTime: '', _queueCount: '' };
                                            });
                                        }}
                                        disabled={!bookingSettings._queueTime || !bookingSettings._queueCount}>
                                        เพิ่ม
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {(bookingSettings.timeQueues || []).map(q => (
                                        <span key={q.time} className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                                            {q.time} ({q.count})
                                            <button type="button"
                                                className="ml-1.5 text-red-500 hover:text-red-700 font-bold"
                                                onClick={() => setBookingSettings(prev => ({ ...prev, timeQueues: (prev.timeQueues || []).filter(x => x.time !== q.time) }))}>
                                                &times;
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SettingsCard>
                </div>

                {/* --- เวลาทำการและวันหยุด --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <SettingsCard title="วัน-เวลาทำการ">
                        <div className="space-y-1">
                            {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((dayName, dayIndex) => {
                                const daySchedule = bookingSettings.weeklySchedule?.[dayIndex] || { isOpen: false, openTime: '09:00', closeTime: '18:00' };
                                return (
                                    <div key={dayIndex} className="grid grid-cols-[50px_auto_1fr] items-center gap-2 p-1.5 rounded-md hover:bg-gray-50">
                                        <div className="font-medium text-gray-700 text-sm">{dayName}</div>
                                        <ToggleSwitch
                                            checked={daySchedule.isOpen}
                                            onChange={() => setBookingSettings(prev => ({
                                                ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...daySchedule, isOpen: !daySchedule.isOpen } }
                                            }))}
                                        />
                                        {daySchedule.isOpen && (
                                            <div className="flex items-center gap-1 text-sm">
                                                <input type="time" value={daySchedule.openTime}
                                                    onChange={e => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...daySchedule, openTime: e.target.value } } }))}
                                                    className="border rounded px-1 py-0.5 w-[90px]"
                                                />
                                                <span>-</span>
                                                <input type="time" value={daySchedule.closeTime}
                                                    onChange={e => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...daySchedule, closeTime: e.target.value } } }))}
                                                    className="border rounded px-1 py-0.5 w-[90px]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="border-t pt-2 mt-2">
                             <h4 className="text-xs font-medium text-gray-600 mb-1.5">ตั้งค่าด่วน</h4>
                             <div className="flex flex-wrap gap-1.5">
                                 <button type="button" onClick={() => {
                                     const newSchedule = {}; for(let i=0; i<7; i++) newSchedule[i] = { isOpen: true, openTime: '09:00', closeTime: '18:00' };
                                     setBookingSettings(prev => ({ ...prev, weeklySchedule: newSchedule }));
                                 }} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">เปิดทุกวัน 9-18</button>
                                 <button type="button" onClick={() => {
                                     const newSchedule = {}; for(let i=0; i<7; i++) newSchedule[i] = { isOpen: i !== 0, openTime: '09:00', closeTime: '18:00' };
                                     setBookingSettings(prev => ({ ...prev, weeklySchedule: newSchedule }));
                                 }} className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">จ.-ส. 9-18</button>
                                 <button type="button" onClick={() => {
                                     const newSchedule = {}; for(let i=0; i<7; i++) newSchedule[i] = { isOpen: i >= 1 && i <= 5, openTime: '09:00', closeTime: '17:00' };
                                     setBookingSettings(prev => ({ ...prev, weeklySchedule: newSchedule }));
                                 }} className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600">จ.-ศ. 9-17</button>
                             </div>
                        </div>
                    </SettingsCard>

                    <SettingsCard title="วันหยุดพิเศษ">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="block text-sm text-gray-600 mb-1">วันที่</label>
                                <input type="date" value={bookingSettings._newHolidayDate || ''}
                                    onChange={e => setBookingSettings(prev => ({ ...prev, _newHolidayDate: e.target.value }))}
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm text-gray-600 mb-1">หมายเหตุ</label>
                                <input type="text" value={bookingSettings._newHolidayNote || ''}
                                    onChange={e => setBookingSettings(prev => ({ ...prev, _newHolidayNote: e.target.value }))}
                                    placeholder="เช่น ปีใหม่"
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                />
                            </div>
                            <button type="button" onClick={() => {
                                const date = bookingSettings._newHolidayDate; const note = bookingSettings._newHolidayNote || ''; if (!date) return;
                                const existing = (bookingSettings.holidayDates || []).find(h => h.date === date); if (existing) { alert('วันที่นี้ถูกเพิ่มแล้ว'); return; }
                                setBookingSettings(prev => ({ ...prev, holidayDates: [...(prev.holidayDates || []), { date, note, createdAt: new Date().toISOString() }].sort((a,b)=> a.date.localeCompare(b.date)), _newHolidayDate: '', _newHolidayNote: '' }));
                            }} disabled={!bookingSettings._newHolidayDate} className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 disabled:bg-gray-400">
                                เพิ่ม
                            </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                             {(!bookingSettings.holidayDates || bookingSettings.holidayDates.length === 0) ? (
                                <div className="text-center p-4 text-gray-500 text-sm border-dashed border-2 rounded-lg mt-2">ไม่มีวันหยุดพิเศษ</div>
                             ) : (
                                bookingSettings.holidayDates.map(holiday => (
                                    <div key={holiday.date} className="flex justify-between items-center bg-gray-100 p-1.5 rounded-md text-sm">
                                        <span>
                                            {new Date(holiday.date + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            {holiday.note && <span className="text-gray-500 ml-2">({holiday.note})</span>}
                                        </span>
                                        <button type="button"
                                            className="text-red-500 hover:text-red-700 font-bold px-2"
                                            onClick={() => setBookingSettings(prev => ({ ...prev, holidayDates: prev.holidayDates.filter(h => h.date !== holiday.date) }))}>
                                            &times;
                                        </button>
                                    </div>
                                ))
                             )}
                        </div>
                    </SettingsCard>
                </div>


                {/* --- การแจ้งเตือน --- */}
                 <SettingsCard title="การแจ้งเตือน (LINE & Email)">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                         {/* คอลัมน์ซ้าย: ตั้งค่า LINE */}
                         <div>
                             <h3 className="text-md font-semibold text-gray-700 mb-2">การแจ้งเตือนผ่าน LINE</h3>
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                     <span className="text-sm">เปิด/ปิดการแจ้งเตือนทั้งหมด</span>
                                     <ToggleSwitch checked={settings.lineNotifications.enabled} onChange={v => handleLineNotificationChange('enabled', !settings.lineNotifications.enabled)} />
                                </div>
                                <div className={`space-y-2 pl-4 border-l-2 ${!settings.lineNotifications.enabled ? 'opacity-50' : ''}`}>
                                     {Object.entries({
                                         newBooking: 'มีการจองใหม่', bookingModified: 'มีการแก้ไขการจอง',
                                         bookingCancelled: 'มีการยกเลิกการจอง', paymentReceived: 'ได้รับการชำระเงิน',
                                         reminderNotifications: 'แจ้งเตือนลูกค้า'
                                     }).map(([key, label]) => (
                                         <div key={key} className="flex justify-between items-center">
                                             <span className="text-sm">{label}</span>
                                             <ToggleSwitch checked={settings.lineNotifications[key]} onChange={v => handleLineNotificationChange(key, !settings.lineNotifications[key])} />
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </div>
                         {/* คอลัมน์ขวา: ตั้งค่า Report */}
                         <div>
                             <h3 className="text-md font-semibold text-gray-700 mb-2">สรุปรายงานประจำวัน (Daily Report)</h3>
                             <p className="text-xs text-gray-500 mb-2">เลือกผู้ดูแลที่จะได้รับสรุปรายงานประจำวันผ่านทางอีเมล</p>
                             <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                                {allAdmins.map(admin => (
                                    <label key={admin.id} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-100">
                                        <input type="checkbox" value={admin.id}
                                            checked={(settings.reportRecipients || []).includes(admin.id)}
                                            onChange={handleRecipientChange}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm">{admin.name} ({admin.email})</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-3 border-t pt-3">
                                <button
                                    onClick={handleSendNow}
                                    disabled={isSending}
                                    className="w-full bg-teal-500 text-white px-4 py-2 text-sm rounded hover:bg-teal-600 disabled:bg-gray-400"
                                >
                                    {isSending ? 'กำลังส่ง...' : 'ส่งรายงานสรุปยอดของวันนี้ทันที'}
                                </button>
                            </div>
                         </div>
                     </div>
                 </SettingsCard>


                {/* --- ปุ่มบันทึกและข้อความสถานะ --- */}
                <div className="mt-6 flex items-center justify-end gap-4">
                    {message && <span className="text-sm text-gray-600">{message}</span>}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
                    </button>
                </div>
            </div>
        </div>
    );
}