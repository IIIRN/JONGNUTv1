"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { updateAppointmentByAdmin } from '@/app/actions/appointmentActions';

export default function EditAppointmentPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const { showToast } = useToast();

    const [formData, setFormData] = useState(null);
    const [services, setServices] = useState([]);
    const [beauticians, setBeauticians] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());
    
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch initial appointment data and static lists
    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                // Fetch appointment, services, and beauticians in parallel
                const appointmentRef = doc(db, 'appointments', id);
                const servicesQuery = query(collection(db, 'services'), orderBy('serviceName'));
                const beauticiansQuery = query(collection(db, 'beauticians'), where('status', '==', 'available'), orderBy('firstName'));

                const [appointmentSnap, servicesSnapshot, beauticiansSnapshot] = await Promise.all([
                    getDoc(appointmentRef),
                    getDocs(servicesQuery),
                    getDocs(beauticiansQuery)
                ]);

                if (!appointmentSnap.exists()) {
                    showToast('ไม่พบข้อมูลการนัดหมาย', 'error');
                    router.push('/dashboard');
                    return;
                }

                const appointmentData = appointmentSnap.data();
                setFormData({
                    customerInfo: appointmentData.customerInfo,
                    serviceId: appointmentData.serviceId,
                    addOnNames: (appointmentData.appointmentInfo.addOns || []).map(a => a.name),
                    beauticianId: appointmentData.beauticianId,
                    date: appointmentData.date,
                    time: appointmentData.time,
                });

                setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setBeauticians(beauticiansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            } catch (error) {
                console.error("Error fetching data:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, router, showToast]);

    // Check beautician availability when date/time changes
    useEffect(() => {
        const checkAvailability = async () => {
            if (!formData?.date || !formData?.time) {
                setUnavailableBeauticianIds(new Set());
                return;
            }
            try {
                const q = query(
                    collection(db, 'appointments'),
                    where('date', '==', formData.date),
                    where('time', '==', formData.time),
                    where('status', 'in', ['confirmed', 'awaiting_confirmation', 'in_progress'])
                );
                const querySnapshot = await getDocs(q);
                // Exclude the current appointment being edited from the check
                const unavailableIds = new Set(
                    querySnapshot.docs
                        .filter(doc => doc.id !== id) 
                        .map(doc => doc.data().beauticianId)
                );
                setUnavailableBeauticianIds(unavailableIds);
            } catch (error) {
                console.error("Error checking availability:", error);
            }
        };
        checkAvailability();
    }, [formData?.date, formData?.time, id]);
    
    const selectedService = useMemo(() => services.find(s => s.id === formData?.serviceId), [services, formData?.serviceId]);
    const { totalPrice } = useMemo(() => {
        if (!selectedService) return { totalPrice: 0 };
        const base = selectedService.price || 0;
        const addOnsPrice = (selectedService.addOnServices || [])
            .filter(a => formData?.addOnNames.includes(a.name))
            .reduce((sum, a) => sum + (a.price || 0), 0);
        return { totalPrice: base + addOnsPrice };
    }, [selectedService, formData?.addOnNames]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("customerInfo.")) {
            const field = name.split('.')[1];
            setFormData(prev => ({ ...prev, customerInfo: { ...prev.customerInfo, [field]: value } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleAddOnToggle = (addOnName) => {
        setFormData(prev => ({
            ...prev,
            addOnNames: prev.addOnNames.includes(addOnName)
                ? prev.addOnNames.filter(name => name !== addOnName)
                : [...prev.addOnNames, addOnName]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const result = await updateAppointmentByAdmin(id, formData);
            if (result.success) {
                showToast('อัปเดตการนัดหมายสำเร็จ!', 'success');
                router.push(`/appointments/${id}`);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !formData) return <div className="text-center p-10">กำลังโหลดข้อมูลการจอง...</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6">แก้ไขการนัดหมาย #{id.substring(0, 6).toUpperCase()}</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Service and Add-ons */}
                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">1. บริการ</h2>
                        <select
                            name="serviceId"
                            value={formData.serviceId}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-md bg-white"
                        >
                            {services.map(s => <option key={s.id} value={s.id}>{s.serviceName} ({s.price} บาท)</option>)}
                        </select>
                        {selectedService?.addOnServices?.length > 0 && (
                            <div className="mt-4">
                                {selectedService.addOnServices.map((addOn, idx) => (
                                    <label key={idx} className="flex items-center gap-3 p-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.addOnNames.includes(addOn.name)}
                                            onChange={() => handleAddOnToggle(addOn.name)}
                                        />
                                        <span>{addOn.name} (+{addOn.price} บาท)</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                     {/* Beautician, Date, Time */}
                    <div className="p-4 border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">2. ช่างและวันเวลา</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <select
                                name="beauticianId"
                                value={formData.beauticianId}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-md bg-white"
                            >
                                {beauticians.map(b => (
                                    <option key={b.id} value={b.id} disabled={unavailableBeauticianIds.has(b.id)}>
                                        {b.firstName} {unavailableBeauticianIds.has(b.id) ? '(ไม่ว่าง)' : ''}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-md"
                            />
                            <input
                                type="time"
                                name="time"
                                value={formData.time}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="p-4 border rounded-lg">
                         <h2 className="text-lg font-semibold mb-3">3. ข้อมูลลูกค้า</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                name="customerInfo.fullName"
                                value={formData.customerInfo.fullName}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-md"
                            />
                            <input
                                type="tel"
                                name="customerInfo.phone"
                                value={formData.customerInfo.phone}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                         <textarea
                            name="customerInfo.note"
                            value={formData.customerInfo.note}
                            onChange={handleInputChange}
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
                            className="w-full bg-indigo-600 text-white p-3 rounded-lg font-semibold"
                        >
                            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}