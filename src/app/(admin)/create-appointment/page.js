// src/app/(admin)/create-appointment/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import { findOrCreateCustomer } from '@/app/actions/customerActions';

export default function CreateAppointmentPage() {
    const router = useRouter();
    const { showToast } = useToast();

    // State for form data
    const [customerInfo, setCustomerInfo] = useState({ 
        fullName: '', 
        phone: '', 
        note: '', 
        lineUserId: '' // เพิ่ม LINE User ID
    });
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedAddOnNames, setSelectedAddOnNames] = useState([]);
    const [selectedBeauticianId, setSelectedBeauticianId] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [noBeauticianMode, setNoBeauticianMode] = useState(false); // New state for no beautician mode

    // State for data from Firestore
    const [services, setServices] = useState([]);
    const [beauticians, setBeauticians] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());
    const [bookingSettings, setBookingSettings] = useState({
        weeklySchedule: {},
        holidayDates: [],
        timeQueues: []
    });

    // State for UI
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState(null);
    const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);

    // Add CSS for highlighting disabled dates
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            input[type="date"]::-webkit-calendar-picker-indicator {
                cursor: pointer;
            }
            /* Custom styles for holiday dates - limited support in HTML date input */
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // Fetch services, beauticians, and settings on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const servicesQuery = query(collection(db, 'services'), orderBy('serviceName'));
                const beauticiansQuery = query(collection(db, 'beauticians'), where('status', '==', 'available'), orderBy('firstName'));
                const bookingSettingsRef = doc(db, 'settings', 'booking');

                const [servicesSnapshot, beauticiansSnapshot, bookingSettingsSnap] = await Promise.all([
                    getDocs(servicesQuery),
                    getDocs(beauticiansQuery),
                    getDoc(bookingSettingsRef)
                ]);

                setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setBeauticians(beauticiansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                if (bookingSettingsSnap.exists()) {
                    setBookingSettings(bookingSettingsSnap.data());
                }

            } catch (error) {
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showToast]);

    // Effect to check for unavailable beauticians when date or time changes
    useEffect(() => {
        const checkAvailability = async () => {
            if (!appointmentDate || !appointmentTime) {
                setUnavailableBeauticianIds(new Set());
                return;
            }

            try {
                const q = query(
                    collection(db, 'appointments'),
                    where('date', '==', appointmentDate),
                    where('time', '==', appointmentTime),
                    where('status', 'in', ['confirmed', 'awaiting_confirmation', 'in_progress'])
                );
                const querySnapshot = await getDocs(q);
                const unavailableIds = new Set(querySnapshot.docs.map(doc => doc.data().beauticianId));
                setUnavailableBeauticianIds(unavailableIds);

                // If the currently selected beautician is now unavailable, reset the selection
                if (unavailableIds.has(selectedBeauticianId)) {
                    setSelectedBeauticianId('');
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning');
                }
            } catch (error) {
                console.error("Error checking availability:", error);
                showToast('ไม่สามารถตรวจสอบคิวช่างได้', 'error');
            }
        };

        checkAvailability();
    }, [appointmentDate, appointmentTime, selectedBeauticianId, showToast]);

    // Memoized values for selected service and calculated price
    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedAddOns = useMemo(() => (selectedService?.addOnServices || []).filter(a => selectedAddOnNames.includes(a.name)), [selectedService, selectedAddOnNames]);
    
    const { basePrice, addOnsTotal, totalPrice, totalDuration } = useMemo(() => {
        if (!selectedService) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, totalDuration: 0 };
        const base = selectedService.price || 0;
        const addOnsPrice = selectedAddOns.reduce((sum, a) => sum + (a.price || 0), 0);
        const duration = (selectedService.duration || 0) + selectedAddOns.reduce((sum, a) => sum + (a.duration || 0), 0);
        return { basePrice: base, addOnsTotal: addOnsPrice, totalPrice: base + addOnsPrice, totalDuration: duration };
    }, [selectedService, selectedAddOns]);

    // Function to check existing customer
    const checkExistingCustomer = async (phone, lineUserId) => {
        if (!phone && !lineUserId) {
            setExistingCustomer(null);
            return;
        }

        setIsCheckingCustomer(true);
        try {
            if (lineUserId) {
                // Check by LINE User ID first
                const customerDoc = await getDoc(doc(db, 'customers', lineUserId));
                if (customerDoc.exists()) {
                    setExistingCustomer({ id: customerDoc.id, ...customerDoc.data() });
                    setIsCheckingCustomer(false);
                    return;
                }
            }
            
            if (phone) {
                // Check by phone number
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

    // Debounced customer check
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            checkExistingCustomer(customerInfo.phone, customerInfo.lineUserId);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [customerInfo.phone, customerInfo.lineUserId]);

    const isDateDisabled = (date) => {
        const day = date.getDay();
        const dateString = date.toISOString().split('T')[0];
        const weeklyDaySetting = bookingSettings.weeklySchedule?.[day];

        // Check if it's a holiday
        if (bookingSettings.holidayDates?.some(holiday => holiday.date === dateString)) {
            return true;
        }

        // Check if the day is closed in weekly schedule
        if (!weeklyDaySetting || !weeklyDaySetting.isOpen) {
            return true;
        }

        return false;
    };

    const availableTimeSlots = useMemo(() => {
        if (!appointmentDate) return [];

        const selectedDate = new Date(appointmentDate);
        const dayOfWeek = selectedDate.getDay();
        const daySchedule = bookingSettings.weeklySchedule[dayOfWeek];

        if (!daySchedule || !daySchedule.isOpen) return [];

        if (bookingSettings.timeQueues && bookingSettings.timeQueues.length > 0) {
            return bookingSettings.timeQueues.map(queue => queue.time).sort();
        }

        // Generate 30-minute slots if no time queues are defined
        const slots = [];
        const [startHour, startMinute] = daySchedule.openTime.split(':').map(Number);
        const [endHour, endMinute] = daySchedule.closeTime.split(':').map(Number);

        let currentHour = startHour;
        let currentMinute = startMinute;

        while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
            slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
            currentMinute += 30;
            if (currentMinute >= 60) {
                currentHour++;
                currentMinute -= 60;
            }
        }

        return slots;
    }, [appointmentDate, bookingSettings]);


    const handleServiceChange = (e) => {
        setSelectedServiceId(e.target.value);
        setSelectedAddOnNames([]); // Reset add-ons when service changes
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
        
        // Validation - beautician is not required in no-beautician mode
        const isBeauticianRequired = !noBeauticianMode;
        if (!selectedServiceId || (isBeauticianRequired && !selectedBeauticianId) || !appointmentDate || !appointmentTime || !customerInfo.fullName || !customerInfo.phone) {
            showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
            return;
        }
        setIsSubmitting(true);

        try {
            // Step 1: Find or create customer with automatic phone/LINE ID merging
            const customerResult = await findOrCreateCustomer({
                fullName: customerInfo.fullName,
                phone: customerInfo.phone,
                note: customerInfo.note
            }, customerInfo.lineUserId || null);

            if (!customerResult.success) {
                throw new Error(customerResult.error || 'ไม่สามารถสร้างข้อมูลลูกค้าได้');
            }

            // Show message if points were merged
            if (customerResult.mergedPoints > 0) {
                showToast(`พบการรวมแต้ม: ${customerResult.mergedPoints} แต้ม`, 'info');
            }

            // Handle beautician data - use default values for no-beautician mode
            let beautician = null;
            if (!noBeauticianMode && selectedBeauticianId) {
                beautician = beauticians.find(b => b.id === selectedBeauticianId);
            }

            // Step 2: Create appointment data with customer ID
            const appointmentData = {
                userId: customerResult.customerId, // Use the customer ID from findOrCreateCustomer
                userInfo: { displayName: customerInfo.fullName },
                status: 'confirmed',
                customerInfo: {
                    ...customerInfo,
                    customerId: customerResult.customerId // Add customer ID reference
                },
                serviceInfo: { id: selectedService.id, name: selectedService.serviceName, imageUrl: selectedService.imageUrl || '' },
                date: appointmentDate,
                time: appointmentTime,
                serviceId: selectedService.id,
                beauticianId: noBeauticianMode ? null : beautician?.id,
                appointmentInfo: {
                    beauticianId: noBeauticianMode ? null : beautician?.id,
                    employeeId: noBeauticianMode ? null : beautician?.id,
                    beauticianInfo: noBeauticianMode ? { firstName: 'ไม่ระบุ', lastName: 'ช่าง' } : { firstName: beautician?.firstName, lastName: beautician?.lastName },
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

            // Step 3: Create appointment
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

    if (loading) {
        return <div className="text-center p-10">กำลังโหลดข้อมูล...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">สร้างการนัดหมายใหม่</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Service and Add-ons */}
                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">1. บริการ</h2>
                        <select
                            value={selectedServiceId}
                            onChange={handleServiceChange}
                            className="w-full p-2 border rounded-md bg-white"
                            required
                        >
                            <option value="">-- เลือกบริการ --</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.serviceName} ({s.price} บาท)</option>)}
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
                                            <span className="text-sm text-gray-600">+{addOn.duration} นาที / +{addOn.price} บาท</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Beautician, Date, Time */}
                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">2. ช่างและวันเวลา</h2>
                        
                        {/* No Beautician Mode Toggle */}
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={noBeauticianMode}
                                    onChange={(e) => {
                                        setNoBeauticianMode(e.target.checked);
                                        if (e.target.checked) {
                                            setSelectedBeauticianId('');
                                        }
                                    }}
                                    className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-blue-800">โหมดปิด - ไม่ระบุช่าง</span>
                                    <p className="text-xs text-blue-600 mt-1">เหมาะสำหรับการจองล่วงหน้าหรือเมื่อยังไม่ทราบว่าช่างคนไหนจะดูแล</p>
                                </div>
                            </label>
                        </div>
                        
                        {/* Holiday Notice */}
                        {bookingSettings.holidayDates && bookingSettings.holidayDates.length > 0 && (
                            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                <h3 className="text-sm font-medium text-yellow-800 mb-2">วันหยุดที่กำหนด:</h3>
                                <div className="text-xs text-yellow-700 space-y-1">
                                    {bookingSettings.holidayDates.map((holiday, idx) => (
                                        <div key={idx}>
                                            • {new Date(holiday.date).toLocaleDateString('th-TH', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })} {holiday.reason && `- ${holiday.reason}`}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className={`grid grid-cols-1 ${noBeauticianMode ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">วันที่</label>
                                <input
                                    type="date"
                                    value={appointmentDate}
                                    onChange={e => {
                                        const selectedDate = e.target.value;
                                        const date = new Date(selectedDate);
                                        
                                        if (isDateDisabled(date)) {
                                            const isHoliday = bookingSettings.holidayDates?.some(h => h.date === selectedDate);
                                            const holidayInfo = bookingSettings.holidayDates?.find(h => h.date === selectedDate);
                                            
                                            if (isHoliday) {
                                                showToast(`วันที่เลือกเป็นวันหยุด${holidayInfo?.reason ? ` (${holidayInfo.reason})` : ''}`, 'error');
                                            } else {
                                                showToast('วันที่เลือกไม่เปิดทำการ', 'error');
                                            }
                                            setAppointmentDate('');
                                        } else {
                                            setAppointmentDate(selectedDate);
                                        }
                                        setAppointmentTime('');
                                        setSelectedBeauticianId(''); // Reset beautician when date changes
                                    }}
                                    className="w-full p-2 border rounded-md"
                                    required
                                    min={new Date().toISOString().split("T")[0]}
                                    style={{
                                        backgroundImage: `linear-gradient(to right, ${
                                            bookingSettings.holidayDates?.some(h => h.date === appointmentDate) ? '#fef2f2' : '#ffffff'
                                        }, ${
                                            bookingSettings.holidayDates?.some(h => h.date === appointmentDate) ? '#fef2f2' : '#ffffff'
                                        })`
                                    }}
                                />
                                {appointmentDate && bookingSettings.holidayDates?.some(h => h.date === appointmentDate) && (
                                    <p className="text-xs text-red-600">
                                        วันหยุด: {bookingSettings.holidayDates.find(h => h.date === appointmentDate)?.reason || 'วันหยุดพิเศษ'}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">เวลา</label>
                                <select
                                    value={appointmentTime}
                                    onChange={e => {
                                        setAppointmentTime(e.target.value);
                                        setSelectedBeauticianId(''); // Reset beautician when time changes
                                    }}
                                    className="w-full p-2 border rounded-md bg-white disabled:bg-gray-100"
                                    required
                                    disabled={!appointmentDate}
                                >
                                    <option value="">
                                        {!appointmentDate ? '-- เลือกวันที่ก่อน --' : '-- เลือกเวลา --'}
                                    </option>
                                    {availableTimeSlots.map(time => (
                                        <option key={time} value={time}>{time}</option>
                                    ))}
                                </select>
                            </div>
                            {!noBeauticianMode && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">ช่าง</label>
                                    <select
                                        value={selectedBeauticianId}
                                        onChange={e => setSelectedBeauticianId(e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white disabled:bg-gray-100"
                                        required={!noBeauticianMode}
                                        disabled={loading || !appointmentDate || !appointmentTime}
                                    >
                                        <option value="">
                                            {loading ? '-- กำลังโหลด... --' : 
                                             !appointmentDate ? '-- เลือกวันที่ก่อน --' :
                                             !appointmentTime ? '-- เลือกเวลาก่อน --' :
                                             '-- เลือกช่าง --'}
                                        </option>
                                        {!loading && beauticians.map(b => (
                                            <option key={b.id} value={b.id} disabled={unavailableBeauticianIds.has(b.id)}>
                                                {b.firstName} {b.lastName} {unavailableBeauticianIds.has(b.id) ? '(ไม่ว่าง)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {noBeauticianMode && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-500">ช่าง</label>
                                    <div className="w-full p-2 border rounded-md bg-gray-50 text-gray-500 text-center">
                                        ไม่ระบุช่าง (โหมดปิด)
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        ในโหมดนี้ ระบบจะไม่ตรวจสอบความว่างของช่าง
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customer Info */}
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

                        {/* Existing Customer Info Display */}
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

                    {/* Summary and Submit */}
                    <div className="p-4 border-t mt-6">
                        {/* Mode indicator */}
                        {noBeauticianMode && (
                            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                                    <span className="text-sm font-medium text-orange-800">โหมดปิด - ไม่ระบุช่าง</span>
                                </div>
                                <p className="text-xs text-orange-600 mt-1">
                                    การนัดหมายนี้จะไม่มีการตรวจสอบความว่างของช่าง
                                </p>
                            </div>
                        )}
                        
                        <div className="flex justify-end items-center gap-6 mb-4">
                            <span className="text-gray-600">ยอดรวม:</span>
                            <span className="text-2xl font-bold text-gray-800">{totalPrice.toLocaleString()} บาท</span>
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
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
