"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
    saveNotificationSettings, 
    saveBookingSettings, 
    savePointSettings, 
    savePaymentSettings, 
    saveCalendarSettings 
} from '@/app/actions/settingsActions';
import { fetchAllAdmins } from '@/app/actions/adminActions';
import { sendDailyNotificationsNow } from '@/app/actions/dailyNotificationActions';
import { useToast } from '@/app/components/Toast';

// --- Helper Components ---

const SettingsCard = ({ title, children, className = '' }) => (
    <div className={`bg-white p-4 rounded-lg shadow-md h-full flex flex-col ${className}`}>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">{title}</h2>
        <div className="space-y-3 text-sm flex-grow">{children}</div>
    </div>
);

const Toggle = ({ label, checked, onChange, disabled = false }) => (
    <div className="flex items-center justify-between">
        <span className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" disabled={disabled} />
            <div className={`w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${disabled ? 'peer-checked:bg-gray-400' : 'peer-checked:bg-blue-600'}`}></div>
        </label>
    </div>
);


// --- Main Page Component ---

export default function AdminSettingsPage() {
    // States for various settings sections
    const [settings, setSettings] = useState({
        allNotifications: { enabled: true },
        reportRecipients: [],
        adminNotifications: { enabled: true, newBooking: true, bookingCancelled: true, paymentReceived: true, customerConfirmed: true },
        customerNotifications: { 
            enabled: true, 
            appointmentConfirmed: true, 
            appointmentCancelled: true, 
            appointmentReminder: true, 
            reviewRequest: true, 
            paymentInvoice: true,
            dailyAppointmentNotification: true 
        },
    });
    const [bookingSettings, setBookingSettings] = useState({ 
        useBeautician: false,
        totalBeauticians: 1,
        bufferMinutes: 0,
        timeQueues: [],
        weeklySchedule: {},
        holidayDates: [],
        _queueTime: '',
        _queueCount: '',
        _newHolidayDate: ''
    });
    const [pointSettings, setPointSettings] = useState({
        reviewPoints: 5,
        pointsPerCurrency: 100,
        pointsPerVisit: 1,
        enableReviewPoints: true,
        enablePurchasePoints: false,
        enableVisitPoints: false
    });
    const [paymentSettings, setPaymentSettings] = useState({
        method: 'promptpay',
        promptPayAccount: '',
        qrCodeImageUrl: ''
    });
    const [calendarSettings, setCalendarSettings] = useState({
        enabled: false,
        calendarId: ''
    });
    
    // Other functional states
    const [allAdmins, setAllAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false); 
    const { showToast } = useToast();

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const docsToFetch = ['notifications', 'booking', 'points', 'payment', 'calendar'];
                const promises = docsToFetch.map(id => getDoc(doc(db, 'settings', id)));
                const [notificationsSnap, bookingSnap, pointsSnap, paymentSnap, calendarSnap] = await Promise.all(promises);

                if (notificationsSnap.exists()) setSettings(prev => ({ ...prev, ...notificationsSnap.data() }));
                if (bookingSnap.exists()) setBookingSettings(prev => ({ ...prev, ...bookingSnap.data() }));
                if (pointsSnap.exists()) setPointSettings(prev => ({ ...prev, ...pointsSnap.data() }));
                if (paymentSnap.exists()) setPaymentSettings(prev => ({ ...prev, ...paymentSnap.data() }));
                if (calendarSnap.exists()) setCalendarSettings(prev => ({ ...prev, ...calendarSnap.data() }));
                
                const adminResult = await fetchAllAdmins();
                if (adminResult.success) setAllAdmins(adminResult.admins);

            } catch (error) {
                console.error("Error fetching initial data:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleNotificationChange = (group, key, value) => {
        setSettings(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { updatedAt: nUpdatedAt, ...notificationData } = settings;
            const { updatedAt: bUpdatedAt, ...bookingData } = bookingSettings;
            const { updatedAt: pUpdatedAt, ...pointData } = pointSettings;
            const { updatedAt: payUpdatedAt, ...paymentData } = paymentSettings;
            const { updatedAt: calUpdatedAt, ...calData } = calendarSettings;

            const results = await Promise.all([
                saveNotificationSettings(notificationData),
                saveBookingSettings(bookingData),
                savePointSettings(pointData),
                savePaymentSettings(paymentData),
                saveCalendarSettings(calData)
            ]);

            if (results.every(r => r.success)) {
                showToast('บันทึกการตั้งค่าทั้งหมดสำเร็จ!', 'success');
            } else {
                const firstError = results.find(r => !r.success)?.error || 'มีข้อผิดพลาดในการบันทึกบางส่วน';
                throw new Error(firstError);
            }
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSendNow = async (isMock = false) => {
        setIsSending(true);
        try {
            const result = await sendDailyNotificationsNow(isMock);
            if (result.success) {
                const { data } = result;
                const mode = isMock ? '🎭 ทดสอบสำเร็จ' : 'ส่งแจ้งเตือนสำเร็จ';
                const message = data 
                    ? `${mode}: จะส่ง ${data.sentCount}/${data.validStatusAppointments || data.totalAppointments} คน`
                    : result.message || `${mode}!`;
                showToast(message, 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
             showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsSending(false);
        }
    };

    if (loading) return <div className="text-center p-10">กำลังโหลดการตั้งค่า...</div>;

    return (
        <div className="container mx-auto p-4 md:p-6">
            <div className="flex justify-between items-center mb-6 ">
                <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-indigo-700 disabled:bg-gray-400"
                >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* --- Column 1: Booking, Holidays, Payment, Calendar --- */}
                <div className="space-y-6">
                    <SettingsCard title="โหมดและคิวการจอง">
                        <div>
                            <label className="block text-sm font-medium mb-1">Buffer (นาที) ระหว่างคิว</label>
                            <input 
                                type="number" 
                                min={0} 
                                value={bookingSettings.bufferMinutes || ''} 
                                onChange={e => setBookingSettings(bs => ({ ...bs, bufferMinutes: Number(e.target.value) }))} 
                                className="w-full border rounded px-2 py-1" 
                            />
                            <p className="text-xs text-gray-500 mt-1">หากบริการก่อนหน้าจบเร็วกว่าเวลาเริ่มต้นของคิวถัดไปเกินค่านี้ จะจองซ้อนได้</p>
                        </div>
                        <Toggle 
                            label="โหมดเลือกช่าง" 
                            checked={bookingSettings.useBeautician}
                            onChange={(value) => setBookingSettings(prev => ({...prev, useBeautician: value}))}
                        />
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">{bookingSettings.useBeautician ? 'จำนวนช่างทั้งหมด' : 'จำนวนคิวสูงสุด'}</label>
                            <input 
                                type="number" min={1} value={bookingSettings.totalBeauticians || 1} 
                                onChange={e => setBookingSettings(prev => ({ ...prev, totalBeauticians: parseInt(e.target.value) || 1 }))} 
                                className="border rounded-md px-2 py-1 w-full text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">กำหนดคิว/ช่าง ตามช่วงเวลา</label>
                            <div className="flex gap-2 items-center mb-2">
                                <input 
                                    type="time" 
                                    value={bookingSettings._queueTime || ''} 
                                    onChange={e => setBookingSettings(prev => ({ ...prev, _queueTime: e.target.value || '' }))} 
                                    className="border rounded-md px-2 py-1 text-sm flex-1"
                                />
                                <input 
                                    type="number" min={1} value={bookingSettings._queueCount || ''} 
                                    onChange={e => setBookingSettings(prev => ({ ...prev, _queueCount: e.target.value.replace(/[^0-9]/g, '') || '' }))} 
                                    className="border rounded-md px-2 py-1 w-16 text-sm" 
                                    placeholder={bookingSettings.useBeautician ? "ช่าง" : "คิว"}
                                />
                                <button type="button" className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 text-sm" onClick={() => setBookingSettings(prev => ({...prev, timeQueues: [...(prev.timeQueues || []), { time: prev._queueTime, count: parseInt(prev._queueCount) }].sort((a,b) => a.time.localeCompare(b.time)), _queueTime: '', _queueCount: '' }))} disabled={!bookingSettings._queueTime || !bookingSettings._queueCount}>เพิ่ม</button>
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
                    <SettingsCard title="การตั้งค่าการชำระเงิน">
                        <div className="flex items-center mb-2 space-x-6">
                            <label className="flex items-center"><input type="radio" name="paymentMethod" value="promptpay" checked={paymentSettings.method === 'promptpay'} onChange={e => setPaymentSettings({...paymentSettings, method: e.target.value})} className="mr-2"/>PromptPay</label>
                            <label className="flex items-center"><input type="radio" name="paymentMethod" value="image" checked={paymentSettings.method === 'image'} onChange={e => setPaymentSettings({...paymentSettings, method: e.target.value})} className="mr-2"/>รูปภาพ QR</label>
                        </div>
                        {paymentSettings.method === 'promptpay' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">เบอร์ PromptPay</label>
                                <input type="text" value={paymentSettings.promptPayAccount || ''} onChange={e => setPaymentSettings({...paymentSettings, promptPayAccount: e.target.value})} className="border rounded-md px-2 py-1 w-full text-sm"/>
                            </div>
                        )}
                        {paymentSettings.method === 'image' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">ลิงก์รูปภาพ QR Code</label>
                                <input 
                                    type="text" 
                                    value={paymentSettings.qrCodeImageUrl || ''} 
                                    onChange={e => setPaymentSettings({...paymentSettings, qrCodeImageUrl: e.target.value})} 
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                    placeholder="https://example.com/image.jpg"
                                />
                                {paymentSettings.qrCodeImageUrl && <img src={paymentSettings.qrCodeImageUrl} alt="QR Code Preview" className="w-24 h-24 mt-2 border"/>}
                            </div>
                        )}
                    </SettingsCard>
                     <SettingsCard title="Google Calendar Sync">
                        <Toggle 
                            label="เปิดการเชื่อมต่อ" 
                            checked={calendarSettings.enabled}
                            onChange={(value) => setCalendarSettings(prev => ({...prev, enabled: value}))}
                        />
                        {calendarSettings.enabled && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Google Calendar ID</label>
                                <input 
                                    type="email" 
                                    value={calendarSettings.calendarId || ''} 
                                    onChange={e => setCalendarSettings(prev => ({...prev, calendarId: e.target.value}))} 
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                    placeholder="your-calendar-id@group.calendar.google.com"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    ดูได้จากหน้า Settings ของปฏิทิน และต้องแชร์ให้ Service Account Email ด้วย
                                </p>
                            </div>
                        )}
                    </SettingsCard>
                </div>

                {/* --- Column 2: Schedule & Notifications --- */}
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
                                            <input type="time" value={day.openTime} onChange={e => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...day, openTime: e.target.value } } }))} className="border rounded px-1 py-0.5 text-xs"/>
                                            <span className="text-xs">-</span>
                                            <input type="time" value={day.closeTime} onChange={e => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...day, closeTime: e.target.value } } }))} className="border rounded px-1 py-0.5 text-xs"/>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </SettingsCard>
                    <SettingsCard title="การแจ้งเตือน LINE">
                        <Toggle label="เปิดการแจ้งเตือนทั้งหมด" checked={settings.allNotifications.enabled} onChange={(value) => handleNotificationChange('allNotifications', 'enabled', value)}/>
                        <hr/>
                        <Toggle label="แจ้งเตือน Admin" checked={settings.adminNotifications.enabled} onChange={(value) => handleNotificationChange('adminNotifications', 'enabled', value)} disabled={!settings.allNotifications.enabled} />
                        {settings.adminNotifications.enabled && (
                            <div className="pl-4 border-l-2 ml-4 space-y-2 text-xs">
                                <Toggle label="เมื่อมีการจองใหม่" checked={settings.adminNotifications.newBooking} onChange={(value) => handleNotificationChange('adminNotifications', 'newBooking', value)} disabled={!settings.allNotifications.enabled} />
                                <Toggle label="เมื่อลูกค้ายืนยันนัดหมาย" checked={settings.adminNotifications.customerConfirmed} onChange={(value) => handleNotificationChange('adminNotifications', 'customerConfirmed', value)} disabled={!settings.allNotifications.enabled} />
                                <Toggle label="เมื่อมีการยกเลิก" checked={settings.adminNotifications.bookingCancelled} onChange={(value) => handleNotificationChange('adminNotifications', 'bookingCancelled', value)} disabled={!settings.allNotifications.enabled}/>
                                <Toggle label="เมื่อมีการชำระเงิน" checked={settings.adminNotifications.paymentReceived} onChange={(value) => handleNotificationChange('adminNotifications', 'paymentReceived', value)} disabled={!settings.allNotifications.enabled}/>
                            </div>
                        )}
                         <hr/>
                        <Toggle label="แจ้งเตือนลูกค้า" checked={settings.customerNotifications.enabled} onChange={(value) => handleNotificationChange('customerNotifications', 'enabled', value)} disabled={!settings.allNotifications.enabled}/>
                        {settings.customerNotifications.enabled && (
                            <div className="pl-4 border-l-2 ml-4 space-y-2 text-xs">
                                <Toggle label="เมื่อยืนยันการนัดหมาย" checked={settings.customerNotifications.appointmentConfirmed} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentConfirmed', value)} disabled={!settings.allNotifications.enabled}/>
                                <Toggle label="เมื่อยกเลิกการนัดหมาย" checked={settings.customerNotifications.appointmentCancelled} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentCancelled', value)} disabled={!settings.allNotifications.enabled}/>
                                <Toggle label="แจ้งเตือนล่วงหน้า 1 ชม." checked={settings.customerNotifications.appointmentReminder} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentReminder', value)} disabled={!settings.allNotifications.enabled}/>
                                <Toggle label="แจ้งเตือนประจำวัน (08:00 น.)" checked={settings.customerNotifications.dailyAppointmentNotification} onChange={(value) => handleNotificationChange('customerNotifications', 'dailyAppointmentNotification', value)} disabled={!settings.allNotifications.enabled}/>
                                <Toggle label="แจ้งเตือนชำระเงิน" checked={settings.customerNotifications.paymentInvoice} onChange={(value) => handleNotificationChange('customerNotifications', 'paymentInvoice', value)} disabled={!settings.allNotifications.enabled}/>
                                <Toggle label="แจ้งเตือนขอรีวิว" checked={settings.customerNotifications.reviewRequest} onChange={(value) => handleNotificationChange('customerNotifications', 'reviewRequest', value)} disabled={!settings.allNotifications.enabled}/>
                            </div>
                        )}
                    </SettingsCard>
                </div>
                
                {/* --- Column 3: Points & Daily Notifications --- */}
                <div className="space-y-6">
                     <SettingsCard title="ระบบสะสมพ้อยต์">
                        <Toggle 
                            label="ให้พ้อยต์หลังรีวิว" 
                            checked={pointSettings.enableReviewPoints}
                            onChange={(value) => setPointSettings(prev => ({...prev, enableReviewPoints: value}))}
                        />
                        {pointSettings.enableReviewPoints && (
                            <div className="pl-4 border-l-2 ml-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">พ้อยต์ที่ได้</label>
                                <input 
                                    type="number" min={1} value={pointSettings.reviewPoints || 5} 
                                    onChange={e => setPointSettings(prev => ({ ...prev, reviewPoints: parseInt(e.target.value) || 5 }))} 
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                />
                            </div>
                        )}
                        <Toggle 
                            label="ให้พ้อยต์ตามยอดซื้อ" 
                            checked={pointSettings.enablePurchasePoints}
                            onChange={(value) => setPointSettings(prev => ({...prev, enablePurchasePoints: value}))}
                        />
                        {pointSettings.enablePurchasePoints && (
                            <div className="pl-4 border-l-2 ml-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">ยอดซื้อกี่บาทต่อ 1 พ้อยต์</label>
                                <input 
                                    type="number" min={1} value={pointSettings.pointsPerCurrency || 100} 
                                    onChange={e => setPointSettings(prev => ({ ...prev, pointsPerCurrency: parseInt(e.target.value) || 100 }))} 
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                />
                            </div>
                        )}
                        <Toggle 
                            label="ให้พ้อยต์ต่อครั้งที่มาใช้บริการ" 
                            checked={pointSettings.enableVisitPoints}
                            onChange={(value) => setPointSettings(prev => ({...prev, enableVisitPoints: value}))}
                        />
                        {pointSettings.enableVisitPoints && (
                            <div className="pl-4 border-l-2 ml-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">พ้อยต์ที่ได้</label>
                                <input 
                                    type="number" min={1} value={pointSettings.pointsPerVisit || 1} 
                                    onChange={e => setPointSettings(prev => ({ ...prev, pointsPerVisit: parseInt(e.target.value) || 1 }))} 
                                    className="border rounded-md px-2 py-1 w-full text-sm"
                                />
                            </div>
                        )}
                    </SettingsCard>
                    <SettingsCard title="แจ้งเตือนประจำวัน (Manual)">
                        <p className="text-xs text-gray-500 mt-1 mb-3">
                            ใช้สำหรับส่งแจ้งเตือนลูกค้าทุกคนที่มีนัดหมายในวันนี้ทันที (ระบบจะส่งอัตโนมัติทุก 08:00 น. อยู่แล้ว)
                        </p>
                        <div className="space-y-2">
                            <button onClick={() => handleSendNow(true)} disabled={isSending} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-green-700 disabled:bg-gray-400 text-sm">
                                {isSending ? 'กำลังทดสอบ...' : '🎭 ทดสอบ (ไม่ส่งจริง)'}
                            </button>
                            <button onClick={() => handleSendNow(false)} disabled={isSending} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 disabled:bg-gray-400 text-sm">
                                {isSending ? 'กำลังส่ง...' : '📅 ส่งแจ้งเตือนทันที'}
                            </button>
                        </div>
                    </SettingsCard>
                </div>
            </div>
        </div>
    );
}