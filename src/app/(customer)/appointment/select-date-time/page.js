"use client";

import { useState, useEffect, Suspense } from 'react'; // Import Suspense
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/common/Toast';

// --- Beautician Card Component ---
const BeauticianCard = ({ beautician, isSelected, onSelect }) => (
    <div
        onClick={() => onSelect(beautician)}
        className={`rounded-lg p-4 flex items-center space-x-4 border-2 transition-all cursor-pointer w-full ${isSelected ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}
    >
        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
            <Image
                src={beautician.imageUrl || 'https://via.placeholder.com/150'}
                alt={beautician.firstName}
                fill
                style={{ objectFit: 'cover' }}
            />
        </div>
        <div className="flex-1">
            <p className="font-bold text-lg text-gray-800">{beautician.firstName}</p>
        </div>
        <div className="flex items-center space-x-3">
            <p className={`text-sm px-3 py-1 rounded-full ${beautician.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {beautician.status === 'available' ? 'ว่าง' : 'ไม่ว่าง'}
            </p>
            {isSelected && (
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    </div>
);

// --- Time Slot Component ---
const TimeSlot = ({ time, isSelected, onSelect }) => (
    <button
        onClick={() => onSelect(time)}
        className={`rounded-lg px-4 py-2 transition-colors text-sm font-semibold ${isSelected ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
        {time}
    </button>
);


function SelectDateTimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');
    const { showToast, ToastComponent } = useToast();

    const [date, setDate] = useState(new Date());
    const [activeMonth, setActiveMonth] = useState(new Date());

    const [time, setTime] = useState('');
    const [beauticians, setBeauticians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBeautician, setSelectedBeautician] = useState(null);
    const [timeQueues, setTimeQueues] = useState([]); // [{time, count}]
    const [totalBeauticians, setTotalBeauticians] = useState(1);
    const [slotCounts, setSlotCounts] = useState({}); // { '09:00': 2, ... }
    const [useBeautician, setUseBeautician] = useState(false); // โหมดการจอง
    const [weeklySchedule, setWeeklySchedule] = useState({}); // ตารางเวลาทำการ
    const [holidayDates, setHolidayDates] = useState([]); // วันหยุดพิเศษ

    // Fetch timeQueues and totalBeauticians from settings/booking
    useEffect(() => {
        const fetchBookingSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'booking');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTimeQueues(Array.isArray(data.timeQueues) ? data.timeQueues : []);
                    setTotalBeauticians(Number(data.totalBeauticians) || 1);
                    setUseBeautician(!!data.useBeautician); // โหมดการจอง
                    setWeeklySchedule(data.weeklySchedule || {});
                    setHolidayDates(Array.isArray(data.holidayDates) ? data.holidayDates : []);
                } else {
                    setTimeQueues([]);
                    setTotalBeauticians(1);
                    setUseBeautician(false);
                    setWeeklySchedule({});
                    setHolidayDates([]);
                }
            } catch (e) {
                setTimeQueues([]);
                setTotalBeauticians(1);
                setUseBeautician(false);
                setWeeklySchedule({});
                setHolidayDates([]);
            }
        };
        fetchBookingSettings();
    }, []);

    // Fetch appointment counts for the selected date
    useEffect(() => {
        if (!date) return;
        const fetchSlotCounts = async () => {
            try {
                const dateStr = format(date, 'yyyy-MM-dd');
                const q = query(
                    collection(db, 'appointments'),
                    where('date', '==', dateStr),
                    where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
                );
                const querySnapshot = await getDocs(q);
                const counts = {};
                querySnapshot.forEach(doc => {
                    const appt = doc.data();
                    if (appt.time) {
                        counts[appt.time] = (counts[appt.time] || 0) + 1;
                    }
                });
                setSlotCounts(counts);
            } catch (e) {
                setSlotCounts({});
            }
        };
        fetchSlotCounts();
    }, [date]);

    useEffect(() => {
        const fetchBeauticians = async () => {
            setLoading(true);
            try {
                // Fetch only available beauticians
                const q = query(
                    collection(db, 'beauticians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const querySnapshot = await getDocs(q);
                setBeauticians(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (e) {
                console.error("Error fetching beauticians:", e);
            }
            setLoading(false);
        };
        fetchBeauticians();
    }, []);

    const handleConfirm = () => {
        if (!date || !time) {
            showToast('กรุณาเลือกวันและเวลาที่ต้องการจอง', "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        
        // ตรวจสอบการเลือกช่างตามโหมด
        if (useBeautician && !selectedBeautician) {
            showToast('กรุณาเลือกช่างเสริมสวยที่ต้องการ', "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        
        const params = new URLSearchParams();
        if (serviceId) params.set('serviceId', serviceId);
        if (addOns) params.set('addOns', addOns);
        params.set('date', format(date, 'yyyy-MM-dd'));
        params.set('time', time);
        
        // ส่ง beauticianId เฉพาะเมื่อเป็นโหมดเลือกช่าง
        if (useBeautician && selectedBeautician) {
            params.set('beauticianId', selectedBeautician.id);
        } else {
            // สำหรับโหมดไม่เลือกช่าง ใส่ค่า default หรือ null
            params.set('beauticianId', 'auto-assign');
        }
        
        router.push(`/appointment/general-info?${params.toString()}`);
    };

    // Helper: get max allowed for a slot
    const getMaxForSlot = (slot) => {
        const queue = timeQueues.find(q => q.time === slot);
        if (queue && queue.count) return queue.count;
        return totalBeauticians;
    };

    // Helper: check if a date is open for business
    const isDateOpen = (checkDate) => {
        const dayOfWeek = checkDate.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        
        // ตรวจสอบตารางเวลาทำการประจำ
        const isRegularlyOpen = daySchedule ? daySchedule.isOpen : true;
        if (!isRegularlyOpen) return false;
        
        // ตรวจสอบวันหยุดพิเศษ
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const isHoliday = holidayDates.some(holiday => holiday.date === dateStr);
        if (isHoliday) return false;
        
        return true;
    };

    // Helper: check if a time slot is within business hours
    const isTimeInBusinessHours = (timeSlot) => {
        if (!date) return true;
        const dayOfWeek = date.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        if (!daySchedule || !daySchedule.isOpen) return false;
        
        const slotTime = timeSlot.replace(':', '');
        const openTime = daySchedule.openTime.replace(':', '');
        const closeTime = daySchedule.closeTime.replace(':', '');
        
        return slotTime >= openTime && slotTime <= closeTime;
    };

    return (
        <div>
            <ToastComponent />
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="min-h-screen flex flex-col items-center pt-4 px-4">
            {/* Calendar */}
            <div className="w-full max-w-md mx-auto flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4">
                    <button
                        onClick={() => setActiveMonth(prev => {
                            const d = new Date(prev);
                            d.setMonth(d.getMonth() - 1);
                            return d;
                        })}
                        className="px-3 py-2 text-xl text-purple-400 hover:text-pink-500"
                    >&#60;</button>
                    <span className="font-bold text-lg text-purple-700">
                        {activeMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={() => setActiveMonth(prev => {
                            const d = new Date(prev);
                            d.setMonth(d.getMonth() + 1);
                            return d;
                        })}
                        className="px-3 py-2 text-xl text-purple-400 hover:text-pink-500"
                    >&#62;</button>
                </div>
                <div className="w-full">
                    {/* Header วันในสัปดาห์ */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((d, i) => (
                            <div key={i} className="text-sm text-purple-400 text-center font-semibold py-2">{d}</div>
                        ))}
                    </div>
                    
                    {/* วันที่ในเดือน */}
                    <div className="grid grid-cols-7 gap-1">
                        {(() => {
                            const year = activeMonth.getFullYear();
                            const month = activeMonth.getMonth();
                            const firstDay = new Date(year, month, 1);
                            const lastDay = new Date(year, month + 1, 0);
                            const startDate = new Date(firstDay);
                            startDate.setDate(startDate.getDate() - firstDay.getDay()); // เริ่มจากวันอาทิตย์
                            
                            const days = [];
                            const currentDate = new Date(startDate);
                            
                            // สร้างปฏิทิน 6 สัปดาห์ (42 วัน)
                            for (let i = 0; i < 42; i++) {
                                const d = new Date(currentDate);
                                const isCurrentMonth = d.getMonth() === month;
                                const isToday = (new Date()).toDateString() === d.toDateString();
                                const isSelected = date && d.toDateString() === date.toDateString();
                                const isPast = d < new Date(new Date().setHours(0,0,0,0));
                                const isBusinessOpen = isDateOpen(d);
                                
                                // ตรวจสอบวันหยุดพิเศษ
                                const dateStr = format(d, 'yyyy-MM-dd');
                                const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);
                                const isHoliday = !!holidayInfo;
                                
                                const isDisabled = isPast || !isBusinessOpen || !isCurrentMonth;
                                
                                days.push(
                                    <button
                                        key={i}
                                        onClick={() => !isDisabled && setDate(d)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors relative
                                            ${!isCurrentMonth ? 'text-gray-300' : 
                                              isSelected ? 'bg-gradient-to-tr from-pink-400 to-purple-500 text-white shadow-lg' : 
                                              isToday ? 'border-2 border-pink-400 text-pink-500 bg-white' : 
                                              isHoliday ? 'bg-red-100 text-red-600 border border-red-300' :
                                              'bg-white text-purple-700 hover:bg-purple-50'}
                                            ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                                            ${!isBusinessOpen && !isPast && isCurrentMonth ? 'bg-gray-200 text-gray-400' : ''}
                                        `}
                                        disabled={isDisabled}
                                        title={
                                            isHoliday && holidayInfo?.note 
                                                ? `วันหยุด: ${holidayInfo.note}` 
                                                : !isBusinessOpen && !isPast && isCurrentMonth 
                                                ? 'วันปิดทำการ' 
                                                : ''
                                        }
                                    >
                                        {d.getDate()}
                                        {isHoliday && isCurrentMonth && (
                                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white text-xs text-white flex items-center justify-center">
                                                ✕
                                            </span>
                                        )}
                                        {!isBusinessOpen && !isPast && isCurrentMonth && !isHoliday && (
                                            <span className="absolute top-0 right-0 w-2 h-2 bg-gray-400 rounded-full"></span>
                                        )}
                                    </button>
                                );
                                currentDate.setDate(currentDate.getDate() + 1);
                            }
                            
                            return days;
                        })()}
                    </div>
                </div>
            </div>

            {/* Available Time */}
            <div className="w-full max-w-md mx-auto mt-6">
                <h2 className="text-base font-bold mb-2 text-purple-700">เลือกช่วงเวลา</h2>
                
                {/* ตรวจสอบว่าวันที่เลือกเปิดทำการหรือไม่ */}
                {date && !isDateOpen(date) ? (
                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                        {(() => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);
                            
                            if (holidayInfo) {
                                return (
                                    <div>
                                        <p className="text-red-600 font-medium">วันหยุดพิเศษ</p>
                                        {holidayInfo.note && (
                                            <p className="text-red-500 text-sm mt-1">{holidayInfo.note}</p>
                                        )}
                                        <p className="text-red-400 text-xs mt-2">กรุณาเลือกวันที่อื่น</p>
                                    </div>
                                );
                            } else {
                                return <p className="text-gray-600">วันที่เลือกปิดทำการ</p>;
                            }
                        })()}
                        <p className="text-sm text-gray-500">กรุณาเลือกวันอื่น</p>
                    </div>
                ) : timeQueues.filter(q => q.time && isTimeInBusinessHours(q.time)).length === 0 ? (
                    <div className="text-center p-4 bg-gray-100 rounded-lg">
                        <p className="text-gray-600">ไม่มีช่วงเวลาให้บริการในวันนี้</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {timeQueues
                            .filter(q => q.time && isTimeInBusinessHours(q.time))
                            .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                            .map(queue => {
                                const slot = queue.time;
                                const max = queue.count || totalBeauticians;
                                const booked = slotCounts[slot] || 0;
                                const isFull = booked >= max;
                                return (
                                    <button
                                        key={slot}
                                        onClick={() => !isFull && setTime(slot)}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors
                                            ${time === slot ? 'bg-gradient-to-tr from-pink-400 to-purple-500 text-white shadow-lg' : 'bg-white text-purple-700 border border-purple-100 hover:bg-purple-50'}
                                            ${isFull ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                                        disabled={isFull}
                                        title={isFull ? 'คิวเต็ม' : ''}
                                    >
                                        {slot} {isFull && <span className="text-xs">(เต็ม)</span>}
                                    </button>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* Beautician Selection - แสดงเฉพาะเมื่อเปิดโหมดเลือกช่าง */}
            {useBeautician && (
                <div className="w-full max-w-md mx-auto mt-6">
                    <h2 className="text-base font-bold mb-2 text-purple-700">เลือกช่างเสริมสวย</h2>
                    {loading ? (
                        <div className="text-center">กำลังโหลดรายชื่อช่าง...</div>
                    ) : beauticians.length === 0 ? (
                        <div className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">ขออภัย ไม่มีช่างที่พร้อมให้บริการในขณะนี้</div>
                    ) : (
                        <div className="space-y-3">
                            {beauticians.map(beautician => (
                                <BeauticianCard
                                    key={beautician.id}
                                    beautician={beautician}
                                    isSelected={selectedBeautician?.id === beautician.id}
                                    onSelect={setSelectedBeautician}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ข้อความสำหรับโหมดไม่เลือกช่าง */}
            {!useBeautician && (
                <div className="w-full max-w-md mx-auto mt-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-700">
                            <strong>โหมดคิวธรรมดา</strong><br/>
                            ระบบจะจัดช่างที่เหมาะสมให้คุณโดยอัตโนมัติ
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Button */}
            <div className="w-full max-w-md mx-auto mt-8 mb-8">
                <button
                    onClick={handleConfirm}
                    disabled={!date || !time || (useBeautician && !selectedBeautician)}
                    className="w-full bg-violet-800 text-white py-3 rounded-xl font-bold shadow-lg "
                >
                    ถัดไป
                </button>
            </div>
            </div>
        </div>
    );
}

export default function SelectDateTimePage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">กำลังโหลด...</div>}>
            <SelectDateTimeContent />
        </Suspense>
    );
}