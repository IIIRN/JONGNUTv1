"use client";

import { useState, useEffect, Suspense, useCallback } from 'react'; // Import useCallback
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/common/Toast';

// --- Technician Card Component (ได้รับการแก้ไข) ---
const TechnicianCard = ({ technician, isSelected, onSelect, isAvailable }) => (
    <div
        onClick={() => isAvailable && onSelect(technician)}
        className={`rounded-lg p-4 flex items-center space-x-4 border-2 transition-all w-full ${!isAvailable ? 'bg-gray-200 opacity-60 cursor-not-allowed' : isSelected ? 'border-primary bg-primary-light cursor-pointer' : 'border-gray-200 bg-white cursor-pointer'}`}
    >
        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
            <Image
                src={technician.imageUrl || 'https://via.placeholder.com/150'}
                alt={technician.firstName}
                fill
                style={{ objectFit: 'cover' }}
            />
        </div>
        <div className="flex-1">
            <p className="font-bold text-lg text-gray-800">{technician.firstName}</p>
        </div>
        <div className="flex items-center space-x-3">
            <p className={`text-sm px-3 py-1 rounded-full ${isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
            </p>
            {isSelected && isAvailable && (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    </div>
);

// --- Time Slot Component (คงเดิม) ---
const TimeSlot = ({ time, isSelected, onSelect }) => (
    <button
        onClick={() => onSelect(time)}
        className={`rounded-lg px-4 py-2 transition-colors text-sm font-semibold ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
        {time}
    </button>
);


function SelectDateTimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');
    const areaIndex = searchParams.get('areaIndex');
    const packageIndex = searchParams.get('packageIndex');
    const { showToast, ToastComponent } = useToast();

    const [service, setService] = useState(null);
    const [selectedAddOns, setSelectedAddOns] = useState([]);
    const [date, setDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
    });
    const [activeMonth, setActiveMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1, 7, 0, 0);
    });

    const [time, setTime] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const [timeQueues, setTimeQueues] = useState([]);
    const [totalTechnicians, setTotalTechnicians] = useState(1);
    const [slotCounts, setSlotCounts] = useState({});
    const [useTechnician, setUseTechnician] = useState(false);
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [holidayDates, setHolidayDates] = useState([]);
    const [unavailableTechnicianIds, setUnavailableTechnicianIds] = useState(new Set());
    const [bufferMinutes, setBufferMinutes] = useState(0);
    const [unavailableSlots, setUnavailableSlots] = useState(new Set());

    // Fetch service data
    useEffect(() => {
        if (!serviceId) return;
        
        const fetchService = async () => {
            try {
                const docRef = doc(db, 'services', serviceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setService({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Error fetching service:", error);
            }
        };
        fetchService();
    }, [serviceId]);

    // Process add-ons from URL params
    useEffect(() => {
        if (!service || !addOns) return;
        
        const addOnNames = addOns.split(',');
        const selected = (service.addOnServices || []).filter(addOn => 
            addOnNames.includes(addOn.name)
        );
        setSelectedAddOns(selected);
    }, [service, addOns]);

    // Fetch technicians
    useEffect(() => {
        const fetchTechnicians = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'technicians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const querySnapshot = await getDocs(q);
                setTechnicians(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (e) {
                console.error("Error fetching technicians:", e);
            }
            setLoading(false);
        };
        fetchTechnicians();
    }, []);

    // Fetch booking settings
    useEffect(() => {
        const fetchBookingSettings = async () => {
            try {
                const bookingSettingsDoc = await getDoc(doc(db, 'settings', 'booking'));
                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    setTimeQueues(Array.isArray(settings.timeQueues) ? settings.timeQueues : []);
                    setTotalTechnicians(Number(settings.totalTechnicians) || 1);
                    setUseTechnician(!!settings.useTechnician);
                    setWeeklySchedule(settings.weeklySchedule || {});
                    setHolidayDates(Array.isArray(settings.holidayDates) ? settings.holidayDates : []);
                    setBufferMinutes(Number(settings.bufferMinutes) || 0);
                }
            } catch (error) {
                console.error("Error fetching booking settings:", error);
            }
        };
        fetchBookingSettings();
    }, []);

    // Fetch appointment counts for the selected date and update technician availability
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
            
            // Calculate total bookings for each time slot
            const counts = {};
            appointmentsForDay.forEach(appt => {
                if (appt.time) {
                    counts[appt.time] = (counts[appt.time] || 0) + 1;
                }
            });
            setSlotCounts(counts);

            // คำนวณช่วงเวลาที่ทับซ้อนกัน (Time Overlap Detection)
            // เก็บจำนวนการทับซ้อนจากช่วงเวลาอื่น (ไม่นับเวลาเริ่มต้น)
            const slotOverlapCounts = {};
            const unavailable = new Set();
            const bufferTime = bufferMinutes || 0;
            
            appointmentsForDay.forEach(appt => {
                if (!appt.time || !appt.serviceInfo?.duration) return;
                
                const [hours, minutes] = appt.time.split(':').map(Number);
                const startMinutes = hours * 60 + minutes;
                const duration = appt.serviceInfo.duration || appt.appointmentInfo?.duration || 60;
                const endMinutes = startMinutes + duration + bufferTime;
                
                timeQueues.forEach(queue => {
                    if (!queue.time) return;
                    const [qHours, qMinutes] = queue.time.split(':').map(Number);
                    const qTimeMinutes = qHours * 60 + qMinutes;
                    
                    // นับเฉพาะช่วงเวลาที่ทับซ้อน (ไม่ใช่เวลาเริ่มต้น) เพื่อไม่ให้นับซ้ำ
                    if (qTimeMinutes > startMinutes && qTimeMinutes < endMinutes) {
                        slotOverlapCounts[queue.time] = (slotOverlapCounts[queue.time] || 0) + 1;
                    }
                });
            });
            
            // ตรวจสอบว่าช่วงเวลาไหนที่มีการทับซ้อนเต็มทุกคิว
            timeQueues.forEach(queue => {
                if (!queue.time) return;
                const maxSlots = useTechnician ? technicians.length : (queue.count || totalTechnicians);
                const overlapCount = slotOverlapCounts[queue.time] || 0;
                const bookedCount = counts[queue.time] || 0;
                
                if (bookedCount + overlapCount >= maxSlots) {
                    unavailable.add(queue.time);
                }
            });
            
            setUnavailableSlots(unavailable);

            // Update unavailable technicians for the selected time
            if (time) {
                const unavailableIds = new Set(
                    appointmentsForDay
                        .filter(appt => appt.time === time && appt.technicianId)
                        .map(appt => appt.technicianId)
                );
                setUnavailableTechnicianIds(unavailableIds);

                // If currently selected technician becomes unavailable, deselect them
                if (selectedTechnician && unavailableIds.has(selectedTechnician.id)) {
                    setSelectedTechnician(null);
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning', 'โปรดเลือกช่างใหม่');
                }
            } else {
                setUnavailableTechnicianIds(new Set());
            }
        };

        fetchAppointmentsForDate();
    }, [date, time, selectedTechnician, showToast, timeQueues, bufferMinutes, useTechnician, technicians, totalTechnicians]);
    
    // Reset time and technician when date changes
    useEffect(() => {
        setTime('');
        setSelectedTechnician(null);
    }, [date]);
    

    const handleConfirm = () => {
        if (!date || !time) {
            showToast('กรุณาเลือกวันและเวลาที่ต้องการจอง', "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        
        if (useTechnician && !selectedTechnician) {
            showToast('กรุณาเลือกช่างเสริมสวยที่ต้องการ', "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        
        const params = new URLSearchParams();
        if (serviceId) params.set('serviceId', serviceId);
        if (addOns) params.set('addOns', addOns);
        if (areaIndex !== null) params.set('areaIndex', areaIndex);
        if (packageIndex !== null) params.set('packageIndex', packageIndex);
        params.set('date', format(date, 'yyyy-MM-dd'));
        params.set('time', time);
        
        if (useTechnician && selectedTechnician) {
            params.set('technicianId', selectedTechnician.id);
        } else {
            params.set('technicianId', 'auto-assign');
        }
        
        router.push(`/appointment/general-info?${params.toString()}`);
    };

    const isDateOpen = (checkDate) => {
        const dayOfWeek = checkDate.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        const isRegularlyOpen = daySchedule ? daySchedule.isOpen : true;
        if (!isRegularlyOpen) return false;
        
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const isHoliday = holidayDates.some(holiday => holiday.date === dateStr);
        if (isHoliday) return false;
        
        return true;
    };

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
            <div className="min-h-screen flex flex-col items-center px-4">
            
            {/* Service Summary */}
            {service && (
                <div className="w-full max-w-md mx-auto mb-6">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                <Image
                                    src={service.imageUrl || 'https://via.placeholder.com/150'}
                                    alt={service.serviceName}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-md font-bold text-gray-800">{service.serviceName}</h3>
                                {service.serviceType === 'multi-area' && areaIndex !== null && packageIndex !== null && service.areas?.[areaIndex] && (
                                    <p className="text-sm text-gray-600">
                                        {service.areas[areaIndex].name} - {service.areas[areaIndex].packages[packageIndex].duration} นาที
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">ระยะเวลา:</span>
                                <span className="font-medium">
                                    {(() => {
                                        let duration = 0;
                                        if (service.serviceType === 'multi-area' && areaIndex !== null && packageIndex !== null) {
                                            duration = service.areas[areaIndex].packages[packageIndex].duration;
                                        } else {
                                            duration = service.duration || 0;
                                        }
                                        const addOnsDuration = selectedAddOns.reduce((total, addOn) => total + (addOn.duration || 0), 0);
                                        return duration + addOnsDuration;
                                    })()} นาที
                                </span>
                            </div>
                            
                            {selectedAddOns.length > 0 && (
                                <div className="text-xs text-gray-500">
                                    รวมบริการเสริม: {selectedAddOns.map(a => a.name).join(', ')}
                                </div>
                            )}
                            
                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                <span className="text-gray-800">ราคารวม:</span>
                                <span className="text-primary">
                                    {(() => {
                                        let price = 0;
                                        if (service.serviceType === 'multi-area' && areaIndex !== null && packageIndex !== null) {
                                            price = service.areas[areaIndex].packages[packageIndex].price;
                                        } else {
                                            price = service.price || 0;
                                        }
                                        const addOnsPrice = selectedAddOns.reduce((total, addOn) => total + (addOn.price || 0), 0);
                                        return (price + addOnsPrice).toLocaleString();
                                    })()}  
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Calendar */}
            <div className="w-full bg-white/30 border border-[#A8999E] p-4 rounded-2xl max-w-md mx-auto flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4">
                    <button
                        onClick={() => setActiveMonth(prev => {
                            const d = new Date(prev);
                            d.setMonth(d.getMonth() - 1);
                            return d;
                        })}
                        className="px-3 py-2 text-xl text-primary hover:text-primary"
                    >&#60;</button>
                    <span className="font-bold text-lg text-primary">
                        {activeMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={() => setActiveMonth(prev => {
                            const d = new Date(prev);
                            d.setMonth(d.getMonth() + 1);
                            return d;
                        })}
                        className="px-3 py-2 text-xl text-primary hover:text-primary"
                    >&#62;</button>
                </div>
                <div className="w-full">
                    {/* Header วันในสัปดาห์ */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((d, i) => (
                            <div key={i} className="text-sm text-primary text-center font-semibold py-2">{d}</div>
                        ))}
                    </div>
                    
                    {/* วันที่ในเดือน */}
                    <div className="grid grid-cols-7 gap-2">
                        {(() => {
                            const year = activeMonth.getFullYear();
                            const month = activeMonth.getMonth();
                            const firstDay = new Date(year, month, 1);
                            const lastDay = new Date(year, month + 1, 0);
                            const startDate = new Date(firstDay);
                            startDate.setDate(startDate.getDate() - firstDay.getDay()); // เริ่มจากวันอาทิตย์
                            
                            const days = [];
                            const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 7, 0, 0);
                            
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
                                const max = useTechnician ? technicians.length : (queue.count || totalTechnicians);
                                const booked = slotCounts[slot] || 0;
                                const isFull = booked >= max;
                                const isOverlapping = unavailableSlots.has(slot);
                                const isDisabled = isFull || isOverlapping;
                                return (
                                    <button
                                        key={slot}
                                        onClick={() => !isDisabled && setTime(slot)}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors
                                            ${time === slot ? 'bg-primary text-white shadow-lg' : 'bg-white text-primary border border-purple-100 hover:bg-purple-50'}
                                            ${isDisabled ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                                        disabled={isDisabled}
                                        title={isFull ? 'คิวเต็ม' : isOverlapping ? 'เวลาทับซ้อนกับการจองอื่น' : ''}
                                    >
                                        {slot} {isFull && <span className="text-xs">(เต็ม)</span>} {isOverlapping && !isFull && <span className="text-xs">(ทับ)</span>}
                                    </button>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* technician Selection */}
            {useTechnician && time && (
                <div className="w-full max-w-md mx-auto mt-6">
                    <h2 className="text-base font-bold mb-2 text-primary">เลือกช่างเสริมสวย</h2>
                    {loading ? (
                        <div className="text-center">กำลังโหลดรายชื่อช่าง...</div>
                    ) : technicians.length === 0 ? (
                        <div className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">ขออภัย ไม่มีช่างที่พร้อมให้บริการในขณะนี้</div>
                    ) : (
                        <div className="space-y-3">
                            {technicians.map(technician => (
                                <TechnicianCard
                                    key={technician.id}
                                    technician={technician}
                                    isSelected={selectedTechnician?.id === technician.id}
                                    onSelect={setSelectedTechnician}
                                    isAvailable={!unavailableTechnicianIds.has(technician.id)}
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
                    disabled={!date || !time || (useTechnician && !selectedTechnician)}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg "
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

