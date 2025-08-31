"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function AppointmentPage() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const router = useRouter();

    const fetchServices = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const servicesRef = collection(db, 'services');
            // Try ordering by serviceName first, as it's more logical for display
            const q = query(servicesRef, orderBy('serviceName'));
            const querySnapshot = await getDocs(q);
            
            let items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Fallback if the ordered query fails or returns nothing
            if (items.length === 0) {
                const fallbackSnapshot = await getDocs(servicesRef);
                items = fallbackSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // Client-side sort as a last resort
                items.sort((a, b) => (a.serviceName || '').localeCompare(b.serviceName || ''));
            }

            setServices(items);
        } catch (e) {
            console.error('Failed fetching services', e);
            setErrorMsg('ไม่สามารถโหลดรายการบริการได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleSelectService = (service) => {
        router.push(`/appointment/service-detail?id=${service.id}`);
    };

    if (loading) return <div className="p-4 text-center">กำลังโหลดบริการ...</div>;
    if (errorMsg) return <div className="p-4 text-center text-red-600">{errorMsg}</div>;
    if (!loading && services.length === 0) {
        return (
            <div className="p-6 text-center bg-white rounded-xl">
                <p className="mb-4 text-gray-700">ขออภัย ขณะนี้ยังไม่มีบริการให้เลือก</p>
                <button onClick={fetchServices} className="px-4 py-2 bg-pink-500 text-white rounded-xl font-semibold">ลองอีกครั้ง</button>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
                {services.map(service => (
                    <div
                        key={service.id}
                        onClick={() => handleSelectService(service)}
                        className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200"
                    >
                        <div className="relative w-full h-28">
                            <Image
                                src={service.imageUrl || 'https://via.placeholder.com/300'}
                                alt={service.serviceName}
                                fill
                                style={{ objectFit: 'cover' }}
                            />
                        </div>
                        <div className="p-3">
                            <h3 className="font-bold text-gray-800 truncate">{service.serviceName}</h3>
                            <p className="text-sm text-gray-500">{service.duration || '-'} นาที</p>
                            <p className="text-md font-semibold text-pink-500 mt-1">
                                ฿{(service.price ?? service.basePrice ?? 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}