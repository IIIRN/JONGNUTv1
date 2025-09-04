// src/app/(admin)/create-appointment/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';

export default function CreateAppointmentPage() {
    const router = useRouter();
    const { showToast } = useToast();

    // State for form data
    const [customerInfo, setCustomerInfo] = useState({ fullName: '', phone: '', note: '' });
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedAddOnNames, setSelectedAddOnNames] = useState([]);
    const [selectedBeauticianId, setSelectedBeauticianId] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');

    // State for data from Firestore
    const [services, setServices] = useState([]);
    const [beauticians, setBeauticians] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());

    // State for UI
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch services and beauticians on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const servicesQuery = query(collection(db, 'services'), orderBy('serviceName'));
                const beauticiansQuery = query(collection(db, 'beauticians'), where('status', '==', 'available'), orderBy('firstName'));

                const [servicesSnapshot, beauticiansSnapshot] = await Promise.all([
                    getDocs(servicesQuery),
                    getDocs(beauticiansQuery)
                ]);

                setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setBeauticians(beauticiansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showToast]);

    // [!code focus start]
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
    // [!code focus end]

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
        if (!selectedServiceId || !selectedBeauticianId || !appointmentDate || !appointmentTime || !customerInfo.fullName || !customerInfo.phone) {
            showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
            return;
        }
        setIsSubmitting(true);

        const beautician = beauticians.find(b => b.id === selectedBeauticianId);

        const appointmentData = {
            userId: `admin_${Date.now()}`, // Generate a unique ID for admin bookings
            userInfo: { displayName: 'Admin Booking' },
            status: 'confirmed', // Admin bookings are confirmed by default
            customerInfo,
            serviceInfo: { id: selectedService.id, name: selectedService.serviceName, imageUrl: selectedService.imageUrl || '' },
            date: appointmentDate,
            time: appointmentTime,
            serviceId: selectedService.id,
            beauticianId: beautician.id,
            appointmentInfo: {
                beauticianId: beautician.id,
                employeeId: beautician.id,
                beauticianInfo: { firstName: beautician.firstName, lastName: beautician.lastName },
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

        try {
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* [!code focus start] */}
                            <select
                                value={selectedBeauticianId}
                                onChange={e => setSelectedBeauticianId(e.target.value)}
                                className="w-full p-2 border rounded-md bg-white disabled:bg-gray-100"
                                required
                                disabled={!appointmentDate || !appointmentTime}
                            >
                                <option value="">-- เลือกช่าง --</option>
                                {beauticians.map(b => (
                                    <option key={b.id} value={b.id} disabled={unavailableBeauticianIds.has(b.id)}>
                                        {b.firstName} {b.lastName} {unavailableBeauticianIds.has(b.id) ? '(ไม่ว่าง)' : ''}
                                    </option>
                                ))}
                            </select>
                            {/* [!code focus end] */}
                            <input
                                type="date"
                                value={appointmentDate}
                                onChange={e => setAppointmentDate(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                required
                                min={new Date().toISOString().split("T")[0]}
                            />
                            <input
                                type="time"
                                value={appointmentTime}
                                onChange={e => setAppointmentTime(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                required
                            />
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