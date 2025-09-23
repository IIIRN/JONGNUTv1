// src/app/(admin)/create-appointment/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import { findOrCreateCustomer } from '@/app/actions/customerActions';
import { useProfile } from '@/context/ProfileProvider';
import BeauticianCard from '@/app/components/admin/BeauticianCard';
import TimeSlotGrid from '@/app/components/admin/TimeSlotGrid';

export default function CreateAppointmentPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    // State for form data
    const [customerInfo, setCustomerInfo] = useState({ 
        fullName: '', 
        phone: '', 
        note: '', 
        lineUserId: ''
    });
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedAddOnNames, setSelectedAddOnNames] = useState([]);
    const [selectedBeauticianId, setSelectedBeauticianId] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [useBeautician, setUseBeautician] = useState(false);

    // State for data from Firestore
    const [services, setServices] = useState([]);
    const [beauticians, setBeauticians] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());
    // State สำหรับการตั้งค่าการจอง
    const defaultWeeklySchedule = {
        0: { isOpen: false },  // อาทิตย์
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // จันทร์
        2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // อังคาร
        3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // พุธ
        4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // พฤหัส
        5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // ศุกร์
        6: { isOpen: false }   // เสาร์
    };

    const [bookingSettings, setBookingSettings] = useState({
        timeQueues: [],
        weeklySchedule: defaultWeeklySchedule,
        holidayDates: [],
        totalBeauticians: 1,
        useBeautician: true
    });
    const [slotCounts, setSlotCounts] = useState({});

    // State for UI
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState(null);
    const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
    const [timeQueueFull, setTimeQueueFull] = useState(false);
    const [activeMonth, setActiveMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            input[type="date"]::-webkit-calendar-picker-indicator {
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // โหลดข้อมูลพื้นฐาน
                const [settingsDoc, bookingSettingsDoc] = await Promise.all([
                    getDoc(doc(db, 'settings', 'general')),
                    getDoc(doc(db, 'settings', 'booking'))
                ]);

                // โหลดข้อมูล services
                const servicesQuery = query(collection(db, 'services'), orderBy('serviceName'));
                const servicesSnapshot = await getDocs(servicesQuery);
                setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                // โหลดการตั้งค่าการจอง
                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    console.log('Loading booking settings:', settings);

                    setBookingSettings(prev => {
                        // ใช้ weeklySchedule จาก settings ถ้ามี หรือใช้ค่าเริ่มต้นถ้าไม่มี
                        const weeklySchedule = settings.weeklySchedule || defaultWeeklySchedule;
                        
                        return {
                            ...prev,
                            timeQueues: Array.isArray(settings.timeQueues) ? settings.timeQueues : [],
                            totalBeauticians: Number(settings.totalBeauticians) || 1,
                            useBeautician: !!settings.useBeautician,
                            holidayDates: Array.isArray(settings.holidayDates) ? settings.holidayDates : [],
                            weeklySchedule: weeklySchedule
                        };
                    });
                }

                // โหลดข้อมูลช่าง
                const beauticiansQuery = query(
                    collection(db, 'beauticians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const beauticiansSnapshot = await getDocs(beauticiansQuery);
                setBeauticians(beauticiansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            } catch (error) {
                console.error("Error fetching data:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [showToast]);

    useEffect(() => {
        if (!appointmentDate) return;

        const fetchAppointmentsForDate = async () => {
            const dateStr = format(new Date(appointmentDate), 'yyyy-MM-dd');
            const q = query(
                collection(db, 'appointments'),
                where('date', '==', dateStr),
                where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
            );
            const querySnapshot = await getDocs(q);
            const appointmentsForDay = querySnapshot.docs.map(doc => doc.data());
            
            // คำนวณจำนวนการจองในแต่ละช่วงเวลา
            const counts = {};
            appointmentsForDay.forEach(appt => {
                if (appt.time) {
                    counts[appt.time] = (counts[appt.time] || 0) + 1;
                }
            });
            setSlotCounts(counts);

            // อัปเดตช่างที่ไม่ว่างในช่วงเวลาที่เลือก
            if (appointmentTime) {
                const unavailableIds = new Set(
                    appointmentsForDay
                        .filter(appt => appt.time === appointmentTime && appt.beauticianId)
                        .map(appt => appt.beauticianId)
                );
                setUnavailableBeauticianIds(unavailableIds);

                // ถ้าช่างที่เลือกไว้ไม่ว่าง ให้ยกเลิกการเลือก
                if (selectedBeauticianId && unavailableIds.has(selectedBeauticianId)) {
                    setSelectedBeauticianId('');
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning', 'โปรดเลือกช่างใหม่');
                }
            } else {
                setUnavailableBeauticianIds(new Set());
            }
        };

        fetchAppointmentsForDate();
    }, [appointmentDate, appointmentTime, selectedBeauticianId, showToast]);

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedAddOns = useMemo(() => (selectedService?.addOnServices || []).filter(a => selectedAddOnNames.includes(a.name)), [selectedService, selectedAddOnNames]);
    
    const { basePrice, addOnsTotal, totalPrice, totalDuration } = useMemo(() => {
        if (!selectedService) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, totalDuration: 0 };
        const base = selectedService.price || 0;
        const addOnsPrice = selectedAddOns.reduce((sum, a) => sum + (a.price || 0), 0);
        const duration = (selectedService.duration || 0) + selectedAddOns.reduce((sum, a) => sum + (a.duration || 0), 0);
        return { basePrice: base, addOnsTotal: addOnsPrice, totalPrice: base + addOnsPrice, totalDuration: duration };
    }, [selectedService, selectedAddOns]);

    const checkExistingCustomer = async (phone, lineUserId) => {
        if (!phone && !lineUserId) {
            setExistingCustomer(null);
            return;
        }

        setIsCheckingCustomer(true);
        try {
            if (lineUserId) {
                const customerDoc = await getDoc(doc(db, 'customers', lineUserId));
                if (customerDoc.exists()) {
                    setExistingCustomer({ id: customerDoc.id, ...customerDoc.data() });
                    setIsCheckingCustomer(false);
                    return;
                }
            }
            
            if (phone) {
                const q = query(collection(db, 'customers'), where('phone', '==', phone));
                const snapshot = await getDocs(q);
                
                if (!snapshot.empty) {
                    const customerData = snapshot.docs[0];
                    setExistingCustomer({ id: customerData.id, ...customerData.data() });
                } else {
                    setExistingCustomer(null);
                }
            }
        } catch (error) {
            console.error('Error checking customer:', error);
            setExistingCustomer(null);
        } finally {
            setIsCheckingCustomer(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            checkExistingCustomer(customerInfo.phone, customerInfo.lineUserId);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [customerInfo.phone, customerInfo.lineUserId]);

    // Reset เวลาและช่างเมื่อเปลี่ยนวันที่
    useEffect(() => {
        setAppointmentTime('');
        setSelectedBeauticianId('');
    }, [appointmentDate]);

    const getThaiDateString = (date) => {
        // สร้างวันที่ใหม่ที่ 7:00 น. (เวลาไทย) ของวันนั้น
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0);
        // แปลงเป็น format YYYY-MM-DD
        return format(localDate, 'yyyy-MM-dd');
    };

    const isDateOpen = (date) => {
        const dayOfWeek = date.getDay();
        const daySchedule = bookingSettings.weeklySchedule[dayOfWeek];
        
        // ถ้าไม่มีการตั้งค่าวันทำการหรือวันนั้นถูกตั้งค่าเป็นวันปิด
        if (!daySchedule || !daySchedule.isOpen) {
            return false;
        }
        
        // ตรวจสอบวันหยุดพิเศษ
        const dateStr = getThaiDateString(date);
        const isHoliday = bookingSettings.holidayDates.some(holiday => holiday.date === dateStr);
        
        return !isHoliday;
    };

    const isTimeInBusinessHours = (timeSlot) => {
        if (!appointmentDate) return true;
        const dayOfWeek = new Date(appointmentDate).getDay();
        const daySchedule = bookingSettings.weeklySchedule[dayOfWeek];
        
        if (!daySchedule || !daySchedule.isOpen) return false;
        
        const slotTime = timeSlot.replace(':', '');
        const openTime = daySchedule.openTime?.replace(':', '') || '0900';
        const closeTime = daySchedule.closeTime?.replace(':', '') || '1700';
        
        return slotTime >= openTime && slotTime <= closeTime;
    };

    const isDateDisabled = (date) => {
        return !isDateOpen(date);
    };

    const checkHolidayDate = (date) => {
        // สร้างวันที่ในรูปแบบ YYYY-MM-DD
        const dateString = getThaiDateString(date);
        
        // ตรวจสอบวันหยุดพิเศษ
        const specialHoliday = bookingSettings.holidayDates?.find(h => h.date === dateString);
        
        // ตรวจสอบวันหยุดประจำสัปดาห์ (อาทิตย์=0, เสาร์=6)
        const dayOfWeek = date.getDay();
        const isWeekendHoliday = !bookingSettings.weeklySchedule?.[dayOfWeek]?.isOpen;
        
        return { 
            isHoliday: !!specialHoliday || isWeekendHoliday,
            holidayInfo: specialHoliday || (isWeekendHoliday ? { reason: 'วันหยุดประจำสัปดาห์' } : null)
        };
    };

    const availableTimeSlots = useMemo(() => {
        if (!appointmentDate || !bookingSettings?.timeQueues) {
            console.log('No appointment date or timeQueues:', { appointmentDate, timeQueues: bookingSettings?.timeQueues });
            return [];
        }

        const selectedDate = new Date(appointmentDate);
        const dayOfWeek = selectedDate.getDay();
        const daySchedule = bookingSettings.weeklySchedule?.[dayOfWeek];
        
        console.log('Checking time slots for:', {
            selectedDate,
            dayOfWeek,
            daySchedule,
            timeQueues: bookingSettings.timeQueues,
            weeklySchedule: bookingSettings.weeklySchedule
        });

        // ถ้าวันนี้เป็นวันหยุด ไม่ต้องแสดงช่วงเวลา
        const holiday = checkHolidayDate(selectedDate);
        if (holiday.isHoliday) {
            console.log('Holiday detected:', holiday);
            return [];
        }

        // เช็คว่าวันนี้เปิดทำการหรือไม่
        if (!daySchedule?.isOpen) {
            console.log('Day is not open:', dayOfWeek);
            return [];
        }

        // เช็คเวลาทำการ
        const openTime = daySchedule?.openTime?.replace(':', '') || '0900';
        const closeTime = daySchedule?.closeTime?.replace(':', '') || '1700';

        console.log('Business hours:', { openTime, closeTime, daySchedule });

        // กรองเวลาที่อยู่ในช่วงเวลาทำการ
        const slots = bookingSettings.timeQueues
            .filter(queue => {
                if (!queue?.time) return false;
                const slotTime = queue.time.replace(':', '');
                return slotTime >= openTime && slotTime <= closeTime;
            })
            .map(queue => queue.time)
            .sort();

        console.log('Available time slots:', slots);
        setTimeQueueFull(slots.length === 0);
        return slots;
    }, [appointmentDate, bookingSettings]);


    const handleServiceChange = (e) => {
        setSelectedServiceId(e.target.value);
        setSelectedAddOnNames([]);
    };

    const handleAddOnToggle = (addOnName) => {
        setSelectedAddOnNames(prev =>
            prev.includes(addOnName)
                ? prev.filter(name => name !== addOnName)
                : [...prev, addOnName]
        );
    };

    const handleCustomerInfoChange = (e) => {
        const { name, value } = e.target;
        setCustomerInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedServiceId || (useBeautician && !selectedBeauticianId) || !appointmentDate || !appointmentTime || !customerInfo.fullName || !customerInfo.phone) {
            showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
            return;
        }
        setIsSubmitting(true);

        try {
            const customerResult = await findOrCreateCustomer({
                fullName: customerInfo.fullName,
                phone: customerInfo.phone,
                note: customerInfo.note
            }, customerInfo.lineUserId || null);

            if (!customerResult.success) {
                throw new Error(customerResult.error || 'ไม่สามารถสร้างข้อมูลลูกค้าได้');
            }

            if (customerResult.mergedPoints > 0) {
                showToast(`พบการรวมแต้ม: ${customerResult.mergedPoints} แต้ม`, 'info');
            }

            let beautician = null;
            if (useBeautician && selectedBeauticianId) {
                beautician = beauticians.find(b => b.id === selectedBeauticianId);
            }

            const appointmentData = {
                userId: customerResult.customerId,
                userInfo: { displayName: customerInfo.fullName },
                status: 'confirmed',
                customerInfo: {
                    ...customerInfo,
                    customerId: customerResult.customerId
                },
                serviceInfo: { id: selectedService.id, name: selectedService.serviceName, imageUrl: selectedService.imageUrl || '' },
                date: appointmentDate,
                time: appointmentTime,
                serviceId: selectedService.id,
                beauticianId: useBeautician ? beautician?.id : null,
                appointmentInfo: {
                    beauticianId: useBeautician ? beautician?.id : null,
                    employeeId: useBeautician ? beautician?.id : null,
                    beauticianInfo: useBeautician ? { firstName: beautician?.firstName, lastName: beautician?.lastName } : { firstName: 'ระบบ', lastName: 'จัดสรรช่าง' },
                    dateTime: new Date(`${appointmentDate}T${appointmentTime}`),
                    addOns: selectedAddOns,
                    duration: totalDuration,
                },
                paymentInfo: {
                    basePrice,
                    addOnsTotal,
                    originalPrice: totalPrice,
                    totalPrice: totalPrice,
                    discount: 0,
                    paymentStatus: 'unpaid',
                },
                createdAt: new Date(),
            };

            const result = await createAppointmentWithSlotCheck(appointmentData);
            if (result.success) {
                showToast('สร้างการนัดหมายสำเร็จ!', 'success');
                router.push('/dashboard');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
            console.error("Error creating appointment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || profileLoading) {
        return <div className="text-center p-10">กำลังโหลดข้อมูล...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">สร้างการนัดหมายใหม่</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">1. บริการ</h2>
                        <select
                            value={selectedServiceId}
                            onChange={handleServiceChange}
                            className="w-full p-2 border rounded-md bg-white"
                            required
                        >
                            <option value="">-- เลือกบริการ --</option>
                            {services.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.serviceName} ({s.duration || '-'} นาที | {profile?.currencySymbol}{(s.price ?? s.basePrice ?? 0).toLocaleString()})
                                </option>
                            ))}
                        </select>
                        {selectedService?.addOnServices?.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-md font-medium mb-2">บริการเสริม:</h3>
                                <div className="space-y-2">
                                    {selectedService.addOnServices.map((addOn, idx) => (
                                        <label key={idx} className="flex items-center gap-3 p-2 border rounded-md cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedAddOnNames.includes(addOn.name)}
                                                onChange={() => handleAddOnToggle(addOn.name)}
                                                className="h-4 w-4 rounded"
                                            />
                                            <span className="flex-1">{addOn.name}</span>
                                            <span className="text-sm text-gray-600">+{addOn.duration} นาที / +{addOn.price} {profile.currencySymbol}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">2. ช่างและวันเวลา</h2>
                        <div className={`grid grid-cols-1 ${!useBeautician ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">วันที่</label>
                                <div className="calendar-container bg-white rounded-lg shadow p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const prevMonth = new Date(activeMonth);
                                                prevMonth.setMonth(prevMonth.getMonth() - 1);
                                                setActiveMonth(prevMonth);
                                            }}
                                            className="p-2 hover:bg-gray-100 rounded-full"
                                        >
                                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <span className="text-sm font-medium text-gray-700">
                                            {activeMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextMonth = new Date(activeMonth);
                                                nextMonth.setMonth(nextMonth.getMonth() + 1);
                                                setActiveMonth(nextMonth);
                                            }}
                                            className="p-2 hover:bg-gray-100 rounded-full"
                                        >
                                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                                            <div key={day} className="text-sm font-medium text-gray-500">
                                                {day}
                                            </div>
                                        ))}
                                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {(() => {
                            const currentYear = activeMonth.getFullYear();
                            const currentMonth = activeMonth.getMonth();
                            
                            // สร้างวันที่ใหม่โดยตั้งเวลาเป็นเที่ยงคืนของวันนั้นในโซนเวลาท้องถิ่น
                            const firstDay = new Date(currentYear, currentMonth, 1, 0, 0, 0);
                            const lastDay = new Date(currentYear, currentMonth + 1, 0, 0, 0, 0);
                            const startDate = new Date(firstDay);
                            startDate.setDate(startDate.getDate() - firstDay.getDay()); // เริ่มจากวันอาทิตย์
                            
                            const days = [];
                            
                            console.log('Calendar setup:', {
                                currentYear,
                                currentMonth,
                                firstDay: firstDay.toISOString(),
                                lastDay: lastDay.toISOString(),
                                startDate: startDate.toISOString()
                            });
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);                                            // Add empty cells for days before the first of the month
                                            for (let i = 0; i < firstDay.getDay(); i++) {
                                                days.push(<div key={`empty-${i}`} className="p-2" />);
                                            }
                                            
                                            // Add days of the month
                                            for (let day = 1; day <= lastDay.getDate(); day++) {
                                                const date = new Date(currentYear, currentMonth, day, 7, 0, 0);
                                                const dateString = format(date, 'yyyy-MM-dd');
                                                const isSelected = dateString === appointmentDate;
                                                const isPast = date < today;
                                                const isToday = date.toDateString() === today.toDateString();
                                                const { isHoliday, holidayInfo } = checkHolidayDate(date);
                                                const isDisabled = isPast || isDateDisabled(date);
                                                
                                                days.push(
                                                    <button
                                                        key={day}
                                                        onClick={() => {
                                                            if (isPast) {
                                                                showToast('ไม่สามารถเลือกวันที่ผ่านมาแล้ว', 'error');
                                                                return;
                                                            }
                                                            if (isHoliday) {
                                                                showToast(holidayInfo?.reason ? 
                                                                    `วันหยุด: ${holidayInfo.reason}` : 
                                                                    'วันหยุดพิเศษ ไม่เปิดให้จอง', 'error');
                                                                return;
                                                            }
                                                            if (isDisabled) {
                                                                showToast('วันที่เลือกไม่เปิดทำการ', 'error');
                                                                return;
                                                            }
                                                            setAppointmentDate(dateString);
                                                            setAppointmentTime('');
                                                            setSelectedBeauticianId('');
                                                        }}
                                                        disabled={isDisabled || isHoliday}
                                                        className={`
                                                            w-full p-2 text-center rounded-md transition-colors
                                                            ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-95' : ''}
                                                            ${!isSelected && isPast ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : ''}
                                                            ${!isSelected && isHoliday ? (holidayInfo?.reason === 'วันหยุดประจำสัปดาห์' ? 'weekly-holiday' : 'special-holiday') + ' cursor-not-allowed' : ''}
                                                            ${!isSelected && !isPast && !isHoliday && isDisabled ? 'bg-gray-100 text-gray-400' : ''}
                                                            ${!isSelected && !isPast && !isHoliday && !isDisabled ? 'hover:bg-gray-100' : ''}
                                                            ${date.getMonth() !== activeMonth?.getMonth() ? 'opacity-40' : ''}
                                                            ${isToday ? 'today-date' : ''}
                                                        `}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            }
                                            
                                            return days;
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full max-w-md mx-auto">
                                <h2 className="text-base font-bold mb-2 text-primary">เลือกช่วงเวลา</h2>
                                
                                {appointmentDate && !isDateOpen(new Date(appointmentDate)) ? (
                                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                        {(() => {
                                            const dateStr = getThaiDateString(new Date(appointmentDate));
                                            const holidayInfo = bookingSettings.holidayDates.find(holiday => holiday.date === dateStr);
                                            
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
                                    <div>
                                        {timeQueueFull ? (
                                            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-yellow-600 font-medium">ไม่มีช่วงเวลาว่างในวันที่เลือก</p>
                                                <p className="text-yellow-500 text-sm mt-1">กรุณาเลือกวันอื่น</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-3">
                                                {bookingSettings.timeQueues
                                                    .filter(q => q.time && isTimeInBusinessHours(q.time))
                                                    .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                                                    .map(queue => {
                                                        const slot = queue.time;
                                                        const max = bookingSettings.useBeautician ? beauticians.length : (queue.count || bookingSettings.totalBeauticians);
                                                const booked = slotCounts[slot] || 0;
                                                const isFull = booked >= max;
                                                return (
                                                    <button
                                                        key={slot}
                                                        onClick={() => !isFull && setAppointmentTime(slot)}
                                                        className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors
                                                            ${appointmentTime === slot ? 'bg-primary text-white shadow-lg' : 'bg-white text-primary border border-purple-100 hover:bg-purple-50'}
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
                                )}
                            </div>
                            {bookingSettings.useBeautician ? (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">ช่าง</label>
                                    {!appointmentDate || !appointmentTime ? (
                                        <div className="text-center text-gray-500 py-2 bg-gray-50 rounded-md">
                                            {!appointmentDate ? 'กรุณาเลือกวันที่ก่อน' : 'กรุณาเลือกเวลาก่อน'}
                                        </div>
                                    ) : loading ? (
                                        <div className="text-center py-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                            <p className="mt-2 text-gray-600">กำลังโหลดข้อมูลช่าง...</p>
                                        </div>
                                    ) : beauticians.length === 0 ? (
                                        <div className="text-center text-gray-500 py-2 bg-gray-50 rounded-md">
                                            ไม่พบข้อมูลช่าง
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {beauticians.map(b => (
                                                <BeauticianCard
                                                    key={b.id}
                                                    beautician={b}
                                                    isSelected={selectedBeauticianId === b.id}
                                                    onSelect={(beautician) => setSelectedBeauticianId(beautician.id)}
                                                    isAvailable={!unavailableBeauticianIds.has(b.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span className="text-sm font-medium text-yellow-800">โหมดเลือกช่างถูกปิดการใช้งาน</span>
                                        </div>
                                        <p className="text-xs text-yellow-600 mt-2 ml-7">
                                            ระบบจะจัดสรรช่างให้อัตโนมัติตามการตั้งค่า กรุณาติดต่อผู้ดูแลระบบหากต้องการเปิดใช้งานโหมดเลือกช่าง
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">3. ข้อมูลลูกค้า</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                name="fullName"
                                value={customerInfo.fullName}
                                onChange={handleCustomerInfoChange}
                                placeholder="ชื่อ-นามสกุล"
                                className="w-full p-2 border rounded-md"
                                required
                            />
                            <input
                                type="tel"
                                name="phone"
                                value={customerInfo.phone}
                                onChange={handleCustomerInfoChange}
                                placeholder="เบอร์โทรศัพท์"
                                className="w-full p-2 border rounded-md"
                                required
                            />
                        </div>
                        <div className="mt-4">
                            <input
                                type="text"
                                name="lineUserId"
                                value={customerInfo.lineUserId}
                                onChange={handleCustomerInfoChange}
                                placeholder="LINE User ID (ถ้ามี)"
                                className="w-full p-2 border rounded-md"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                หากระบุ LINE User ID ระบบจะค้นหาลูกค้าจาก LINE ID ก่อน และรวมแต้มจากเบอร์โทรศัพท์เก่า (ถ้ามี)
                            </p>
                        </div>

                        {isCheckingCustomer && (
                            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    <span className="text-sm text-gray-600">กำลังตรวจสอบข้อมูลลูกค้า...</span>
                                </div>
                            </div>
                        )}

                        {existingCustomer && !isCheckingCustomer && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    <span className="text-sm font-medium text-green-800">พบข้อมูลลูกค้าในระบบ</span>
                                </div>
                                <div className="text-xs text-green-700 space-y-1">
                                    <div>ชื่อ: {existingCustomer.fullName}</div>
                                    <div>เบอร์: {existingCustomer.phone}</div>
                                    {existingCustomer.totalPoints > 0 && (
                                        <div>แต้มสะสม: {existingCustomer.totalPoints} แต้ม</div>
                                    )}
                                    <div className="mt-2 text-green-600">
                                        ⚡ ระบบจะอัปเดตข้อมูลลูกค้าและรวมแต้มอัตโนมัติ
                                    </div>
                                </div>
                            </div>
                        )}

                        {customerInfo.phone && !existingCustomer && !isCheckingCustomer && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                    <span className="text-sm font-medium text-blue-800">ลูกค้าใหม่</span>
                                </div>
                                <p className="text-xs text-blue-600 mt-1">
                                    ระบบจะสร้างข้อมูลลูกค้าใหม่ในระบบ
                                </p>
                            </div>
                        )}
                        <textarea
                            name="note"
                            value={customerInfo.note}
                            onChange={handleCustomerInfoChange}
                            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                            rows="2"
                            className="w-full mt-4 p-2 border rounded-md"
                        ></textarea>
                    </div>

                    <div className="p-4 border-t mt-6">
                        {!useBeautician && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className="text-sm font-medium text-blue-800">ระบบจัดสรรช่างอัตโนมัติ</span>
                                </div>
                                <p className="text-xs text-blue-600 mt-1">
                                    ระบบจะจัดสรรช่างให้อัตโนมัติตามการตั้งค่า
                                </p>
                            </div>
                        )}
                        
                        <div className="flex justify-end items-center gap-6 mb-4">
                            <span className="text-gray-600">ยอดรวม:</span>
                            <span className="text-2xl font-bold text-gray-800">{totalPrice.toLocaleString()} {profile.currencySymbol}</span>
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting || (useBeautician && !selectedBeauticianId)}
                            className="w-full bg-indigo-600 text-white p-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                        >
                            {isSubmitting ? 'กำลังบันทึก...' : 'สร้างการนัดหมาย'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}