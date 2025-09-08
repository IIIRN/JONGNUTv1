"use client";

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/common/Toast';

// --- Beautician Card Component ---
const BeauticianCard = ({ beautician, isSelected, onSelect, isAvailable }) => (
    <div
        onClick={() => isAvailable && onSelect(beautician)}
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300
            ${isSelected ? 'border-primary bg-purple-50 shadow-lg' : 'border-gray-200 bg-white hover:border-purple-200'}
            ${!isAvailable ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
        `}
    >
        <div className="flex items-center space-x-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {beautician.profileImage ? (
                    <Image
                        src={beautician.profileImage}
                        alt={beautician.name}
                        width={48}
                        height={48}
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-lg">
                            {beautician.name.charAt(0)}
                        </span>
                    </div>
                )}
                {!isAvailable && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">ไม่ว่าง</span>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-gray-800'} truncate`}>
                    {beautician.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1 truncate">
                    {beautician.specialties?.join(', ') || 'ช่างทั่วไป'}
                </p>
                {beautician.rating && (
                    <div className="flex items-center mt-1">
                        <span className="text-yellow-400 text-xs">★</span>
                        <span className="text-xs text-gray-600 ml-1">
                            {beautician.rating.toFixed(1)}
                        </span>
                    </div>
                )}
            </div>
            {isSelected && (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    </div>
);

function SelectDateTimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    
    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');
    const customerId = searchParams.get('customerId');

    const [date, setDate] = useState(null);
    const [time, setTime] = useState('');
    const [selectedBeautician, setSelectedBeautician] = useState(null);
    const [beauticians, setBeauticians] = useState([]);
    const [slotCounts, setSlotCounts] = useState({});
    const [existingAppointments, setExistingAppointments] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    
    // Booking settings
    const [timeQueues, setTimeQueues] = useState([]);
    const [totalBeauticians, setTotalBeauticians] = useState(1);
    const [useBeautician, setUseBeautician] = useState(false);
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [holidayDates, setHolidayDates] = useState([]);
    const [bufferMinutes, setBufferMinutes] = useState(20);
    
    // Service and add-ons data
    const [service, setService] = useState(null);
    const [addOnsData, setAddOnsData] = useState([]);

    // Fetch booking settings
    useEffect(() => {
        const fetchBookingSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'booking');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTimeQueues(Array.isArray(data.timeQueues) ? data.timeQueues : []);
                    setTotalBeauticians(Number(data.totalBeauticians) || 1);
                    setUseBeautician(!!data.useBeautician);
                    setWeeklySchedule(data.weeklySchedule || {});
                    setHolidayDates(Array.isArray(data.holidayDates) ? data.holidayDates : []);
                    setBufferMinutes(Number(data.bufferMinutes) || 20);
                }
            } catch (e) {
                console.error("Error fetching booking settings:", e);
            }
        };
        fetchBookingSettings();
    }, []);

    // Fetch service and addOns data
    useEffect(() => {
        const fetchServiceData = async () => {
            if (!serviceId) return;
            try {
                const serviceRef = doc(db, 'services', serviceId);
                const serviceSnap = await getDoc(serviceRef);
                if (serviceSnap.exists()) {
                    setService({ id: serviceSnap.id, ...serviceSnap.data() });
                }
                
                if (addOns) {
                    const addOnsIds = addOns.split(',');
                    const addOnsPromises = addOnsIds.map(async (id) => {
                        const addOnRef = doc(db, 'addOns', id);
                        const addOnSnap = await getDoc(addOnRef);
                        return addOnSnap.exists() ? { id: addOnSnap.id, ...addOnSnap.data() } : null;
                    });
                    const addOnsResults = await Promise.all(addOnsPromises);
                    setAddOnsData(addOnsResults.filter(Boolean));
                }
            } catch (e) {
                console.error("Error fetching service data:", e);
            }
        };
        fetchServiceData();
    }, [serviceId, addOns]);

    // Fetch all beauticians
    useEffect(() => {
        const fetchBeauticians = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'beauticians'),
                    where('status', '==', 'active'),
                    orderBy('name')
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

    // Helper function to check if a time slot is available considering buffer and overlaps
    const isTimeSlotAvailable = (timeSlot, dateStr, appointmentsForDay = null) => {
        const appointments = appointmentsForDay || existingAppointments.filter(appointment => {
            const appointmentDate = new Date(appointment.date.seconds * 1000).toDateString();
            const selectedDate = new Date(dateStr).toDateString();
            return appointmentDate === selectedDate;
        });

        if (!appointments.length) return true;

        // Calculate total duration of selected service + add-ons
        const serviceDuration = service?.duration || 60; // Default 60 minutes
        const addOnsDuration = addOnsData.reduce((total, addOn) => total + (addOn.duration || 0), 0);
        const totalDuration = serviceDuration + addOnsDuration;

        // Convert timeSlot to minutes for calculation
        const [hours, minutes] = timeSlot.split(':').map(Number);
        const slotStartMinutes = hours * 60 + minutes;
        const slotEndMinutes = slotStartMinutes + totalDuration;

        // Check existing appointments for conflicts
        for (let appointment of appointments) {
            const [appHours, appMinutes] = appointment.time.split(':').map(Number);
            const appStartMinutes = appHours * 60 + appMinutes;
            
            // Calculate appointment end time including its service and add-ons duration
            let appTotalDuration = 60; // Default duration
            
            // Add add-ons duration (estimate if actual data not available)
            if (appointment.addOns && appointment.addOns.length > 0) {
                appTotalDuration += appointment.addOns.length * 30; // Estimate 30 min per add-on
            }
            
            const appEndMinutes = appStartMinutes + appTotalDuration;

            // Check for overlap considering buffer time
            const hasOverlap = (
                // New appointment starts before existing ends (with buffer)
                (slotStartMinutes < appEndMinutes + bufferMinutes) &&
                // New appointment ends after existing starts (with buffer)
                (slotEndMinutes + bufferMinutes > appStartMinutes)
            );

            if (hasOverlap) {
                if (!useBeautician) {
                    return false; // No beautician mode - any overlap blocks the slot
                }
                // In beautician mode, we'll handle this in the beautician availability logic
            }
        }

        return true;
    };

    // Fetch appointment counts for the selected date and update beautician availability
    useEffect(() => {
        if (!date) return;

        const fetchAppointmentsForDate = async () => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const q = query(
                collection(db, 'appointments'),
                where('date', '==', dateStr),
                where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
            );
            const querySnapshot = await getDocs(q);
            const appointmentsForDay = querySnapshot.docs.map(doc => doc.data());
            
            // Calculate slot availability considering duration and buffer
            const counts = {};
            timeQueues.forEach(queue => {
                const timeSlot = queue.time;
                if (timeSlot && isTimeInBusinessHours(timeSlot)) {
                    const isAvailable = isTimeSlotAvailable(timeSlot, dateStr, appointmentsForDay);
                    
                    if (useBeautician) {
                        // Count how many beauticians are available for this slot
                        const unavailableForSlot = appointmentsForDay
                            .filter(appt => {
                                if (!appt.time || !appt.beauticianId) return false;
                                
                                const [appHours, appMinutes] = appt.time.split(':').map(Number);
                                const appStartMinutes = appHours * 60 + appMinutes;
                                
                                // Estimate appointment duration
                                let appDuration = 60; // Default
                                if (appt.addOns && appt.addOns.length > 0) {
                                    appDuration += appt.addOns.length * 30;
                                }
                                const appEndMinutes = appStartMinutes + appDuration;
                                
                                const [slotHours, slotMinutes] = timeSlot.split(':').map(Number);
                                const slotStartMinutes = slotHours * 60 + slotMinutes;
                                
                                // Calculate total duration for new appointment
                                const serviceDuration = service?.duration || 60;
                                const addOnsDuration = addOnsData.reduce((total, addOn) => total + (addOn.duration || 0), 0);
                                const totalDuration = serviceDuration + addOnsDuration;
                                const slotEndMinutes = slotStartMinutes + totalDuration;
                                
                                // Check for overlap with buffer
                                return (slotStartMinutes < appEndMinutes + bufferMinutes) &&
                                       (slotEndMinutes + bufferMinutes > appStartMinutes);
                            })
                            .map(appt => appt.beauticianId);
                        
                        const availableBeauticians = beauticians.length - new Set(unavailableForSlot).size;
                        counts[timeSlot] = Math.max(0, beauticians.length - availableBeauticians);
                    } else {
                        // For non-beautician mode, mark as full if not available
                        counts[timeSlot] = isAvailable ? 0 : 1;
                    }
                }
            });
            setSlotCounts(counts);

            // Update unavailable beauticians for the selected time
            if (time) {
                const unavailableIds = new Set(
                    appointmentsForDay
                        .filter(appt => {
                            if (!appt.time || !appt.beauticianId) return false;
                            
                            const [appHours, appMinutes] = appt.time.split(':').map(Number);
                            const appStartMinutes = appHours * 60 + appMinutes;
                            
                            // Estimate appointment duration
                            let appDuration = 60; // Default
                            if (appt.addOns && appt.addOns.length > 0) {
                                appDuration += appt.addOns.length * 30;
                            }
                            const appEndMinutes = appStartMinutes + appDuration;
                            
                            const [timeHours, timeMinutes] = time.split(':').map(Number);
                            const timeStartMinutes = timeHours * 60 + timeMinutes;
                            
                            // Calculate total duration for new appointment
                            const serviceDuration = service?.duration || 60;
                            const addOnsDuration = addOnsData.reduce((total, addOn) => total + (addOn.duration || 0), 0);
                            const totalDuration = serviceDuration + addOnsDuration;
                            const timeEndMinutes = timeStartMinutes + totalDuration;
                            
                            // Check for overlap with buffer
                            return (timeStartMinutes < appEndMinutes + bufferMinutes) &&
                                   (timeEndMinutes + bufferMinutes > appStartMinutes);
                        })
                        .map(appt => appt.beauticianId)
                );
                setUnavailableBeauticianIds(unavailableIds);
            }
        };

        fetchAppointmentsForDate();
    }, [date, time, beauticians, bufferMinutes, service, addOnsData, timeQueues]);

    // Reset time and beautician when date changes
    useEffect(() => {
        setTime('');
        setSelectedBeautician(null);
    }, [date]);

    // Reset beautician when time changes
    useEffect(() => {
        if (selectedBeautician && unavailableBeauticianIds.has(selectedBeautician.id)) {
            setSelectedBeautician(null);
            if (time) {
                showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning', 'โปรดเลือกช่างใหม่');
            }
        }
    }, [time, selectedBeautician, unavailableBeauticianIds, showToast]);

    // Business hours and date checking functions
    const isTimeInBusinessHours = (time) => {
        if (!date || !weeklySchedule) return true;
        
        const dayOfWeek = date.getDay();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        const daySchedule = weeklySchedule[dayName];
        
        if (!daySchedule || !daySchedule.isOpen) return false;
        
        const timeMinutes = time.split(':').reduce((acc, time) => (60 * acc) + parseInt(time));
        const openMinutes = daySchedule.openTime.split(':').reduce((acc, time) => (60 * acc) + parseInt(time));
        const closeMinutes = daySchedule.closeTime.split(':').reduce((acc, time) => (60 * acc) + parseInt(time));
        
        return timeMinutes >= openMinutes && timeMinutes <= closeMinutes;
    };

    const isDateOpen = (checkDate) => {
        if (!weeklySchedule) return true;
        
        const dayOfWeek = checkDate.getDay();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        const daySchedule = weeklySchedule[dayName];
        
        if (!daySchedule || !daySchedule.isOpen) return false;
        
        // Check if it's a holiday
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const isHoliday = holidayDates.some(holiday => holiday.date === dateStr);
        
        return !isHoliday;
    };

    const handleConfirm = () => {
        if (!date || !time) {
            showToast('กรุณาเลือกวันที่และเวลา', 'error');
            return;
        }
        
        if (useBeautician && !selectedBeautician) {
            showToast('กรุณาเลือกช่างเสริมสวย', 'error');
            return;
        }

        const params = new URLSearchParams({
            serviceId: serviceId || '',
            addOns: addOns || '',
            customerId: customerId || '',
            date: format(date, 'yyyy-MM-dd'),
            time: time,
            ...(selectedBeautician ? { beauticianId: selectedBeautician.id } : {})
        });

        router.push(`/appointment/review?${params.toString()}`);
    };

    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const monthNames = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
            <CustomerHeader />
            
            <div className="container mx-auto px-4 py-6">
                {/* Calendar */}
                <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => {
                                if (currentMonth === 0) {
                                    setCurrentMonth(11);
                                    setCurrentYear(currentYear - 1);
                                } else {
                                    setCurrentMonth(currentMonth - 1);
                                }
                            }}
                            className="p-2 rounded-full hover:bg-purple-50 text-primary"
                        >
                            &#8249;
                        </button>
                        <h2 className="text-lg font-bold text-primary">
                            {monthNames[currentMonth]} {currentYear + 543}
                        </h2>
                        <button
                            onClick={() => {
                                if (currentMonth === 11) {
                                    setCurrentMonth(0);
                                    setCurrentYear(currentYear + 1);
                                } else {
                                    setCurrentMonth(currentMonth + 1);
                                }
                            }}
                            className="p-2 rounded-full hover:bg-purple-50 text-primary"
                        >
                            &#8250;
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                            <div key={day} className="h-8 flex items-center justify-center">
                                <span className="text-xs font-semibold text-gray-600">{day}</span>
                            </div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-1">
                        {(() => {
                            const year = currentYear;
                            const month = currentMonth;
                            const firstDay = new Date(year, month, 1);
                            const lastDay = new Date(year, month + 1, 0);
                            const startDate = new Date(firstDay);
                            startDate.setDate(startDate.getDate() - firstDay.getDay());
                            
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
                                              isSelected ? 'bg-primary text-white shadow-lg' : 
                                              isToday ? 'border-2 border-primary text-primary bg-white' : 
                                              isHoliday ? 'bg-red-100 text-red-600 border border-red-300' :
                                              'bg-white text-primary hover:bg-purple-50'}
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

                {/* Available Time */}
                <div className="w-full max-w-md mx-auto mt-6">
                    <h2 className="text-base font-bold mb-2 text-primary">เลือกช่วงเวลา</h2>
                    
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
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {timeQueues
                                .filter(q => q.time && isTimeInBusinessHours(q.time))
                                .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                                .map(queue => {
                                    const slot = queue.time;
                                    const max = useBeautician ? beauticians.length : (queue.count || totalBeauticians);
                                    const booked = slotCounts[slot] || 0;
                                    const isFull = booked >= max;
                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => !isFull && setTime(slot)}
                                            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors
                                                ${time === slot ? 'bg-primary text-white shadow-lg' : 'bg-white text-primary border border-purple-100 hover:bg-purple-50'}
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

                {/* Beautician Selection */}
                {useBeautician && time && (
                    <div className="w-full max-w-md mx-auto mt-6">
                        <h2 className="text-base font-bold mb-2 text-primary">เลือกช่างเสริมสวย</h2>
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
                                        isAvailable={!unavailableBeauticianIds.has(beautician.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Confirm Button */}
                <div className="w-full max-w-md mx-auto mt-8 mb-8">
                    <button
                        onClick={handleConfirm}
                        disabled={!date || !time || (useBeautician && !selectedBeautician)}
                        className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
