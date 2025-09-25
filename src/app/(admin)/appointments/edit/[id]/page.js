"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { updateAppointmentByAdmin } from '@/app/actions/appointmentActions';
import { useProfile } from '@/context/ProfileProvider';

export default function EditAppointmentPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const [formData, setFormData] = useState(null);
    const [services, setServices] = useState([]);
    const [beauticians, setBeauticians] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());
    
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch initial appointment data and static lists
    useEffect(() => {
        if (!id || typeof id !== 'string' || id.trim() === '') {
            showToast('ไม่พบรหัสการนัดหมาย', 'error');
            router.push('/dashboard');
            return;
        }
        const fetchData = async () => {
            try {
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
        if (!id || typeof id !== 'string' || id.trim() === '') {
            showToast('ไม่พบรหัสการนัดหมาย (id ไม่ถูกต้อง)', 'error');
            console.error('Appointment Edit: Invalid id', id);
            return;
        }
        setIsSubmitting(true);
        try {
            console.log('Appointment Edit: Submitting with id', id);
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

    if (loading || profileLoading) return <div className="text-center p-10">กำลังโหลดข้อมูลการจอง...</div>;

    // ซ่อนฟอร์มแก้ไขและแจ้งผู้ใช้ให้ใช้ฟังก์ชันยกเลิกแล้วจองใหม่แทน
    return (
        <div className="container mx-auto p-8">
            <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold mb-4 text-red-600">ไม่สามารถแก้ไขการจองได้</h1>
                <p className="mb-6 text-gray-700">หากต้องการเปลี่ยนแปลงข้อมูล กรุณายกเลิกการจองเดิม แล้วสร้างการจองใหม่</p>
                <a href="/dashboard" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">กลับสู่หน้าหลัก</a>
            </div>
        </div>
    );
}
