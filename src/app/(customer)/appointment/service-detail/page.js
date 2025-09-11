"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';

// --- Add-on Card Component ---
const AddOnCard = ({ addOn, isSelected, onToggle }) => (
    <div
        onClick={() => onToggle(addOn)}
        className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-all text-sm ${isSelected ? 'bg-pink-50 border-pink-500 ring-2 ring-pink-200' : 'bg-white'}`}
    >
        <div className="flex items-center w-full">
            <span className="font-semibold text-gray-800 flex-1">{addOn.name}</span>
            <span className="text-xs text-gray-700 ml-2 whitespace-nowrap">{addOn.duration} นาที | {addOn.price?.toLocaleString()}</span>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ml-2 ${isSelected ? 'bg-pink-500' : 'border'}`}> 
                {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                )}
            </div>
        </div>
    </div>
);

function ServiceDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('id');
    const [service, setService] = useState(null);
    const [selectedAddOns, setSelectedAddOns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!serviceId) {
            router.push('/appointment');
            return;
        }
        const fetchService = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'services', serviceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setService({ id: docSnap.id, ...docSnap.data() });
                } else {
                    // Handle service not found
                    router.push('/appointment');
                }
            } catch (error) {
                console.error("Error fetching service:", error);
                router.push('/appointment');
            } finally {
                setLoading(false);
            }
        };
        fetchService();
    }, [serviceId, router]);

    const toggleAddOn = (addOn) => {
        setSelectedAddOns(prev => {
            const isAlreadySelected = prev.some(item => item.name === addOn.name);
            if (isAlreadySelected) {
                return prev.filter(item => item.name !== addOn.name);
            } else {
                return [...prev, addOn];
            }
        });
    };
    
    const totalPrice = useMemo(() => {
        const basePrice = service?.price || 0;
        const addOnsPrice = selectedAddOns.reduce((total, addOn) => total + (addOn.price || 0), 0);
        return basePrice + addOnsPrice;
    }, [service, selectedAddOns]);


    const handleConfirm = () => {
        const params = new URLSearchParams();
        params.set('serviceId', service.id);
        if (selectedAddOns.length > 0) {
            params.set('addOns', selectedAddOns.map(a => a.name).join(','));
        }
        router.push(`/appointment/select-date-time?${params.toString()}`);
    };

    if (loading) return <div className="p-4 text-center">กำลังโหลด...</div>;
    if (!service) return null;

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            
            <div className="px-4 pb-24">
            {/* รูปภาพบริการ */}
            <div className="relative w-full h-48 rounded-2xl overflow-hidden mb-4">
                <Image
                    src={service.imageUrl || 'https://via.placeholder.com/400x200'}
                    alt={service.serviceName}
                    fill
                    style={{ objectFit: 'cover' }}
                    className="rounded-2xl"
                    priority
                />
            </div>

            {/* ชื่อและราคาบริการ */}
            <div className="mb-2">
                <h1 className="text-xl font-bold text-gray-800 mb-2">{service.serviceName}</h1>
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">ระยะเวลา</span>
                    <span className="font-semibold text-gray-800">{service.duration} นาที</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">ราคา</span>
                    <span className="font-bold text-lg text-gray-800">฿{service.price?.toLocaleString()}</span>
                </div>
            </div>

            {/* รายละเอียดบริการ */}
            <div className="py-2">
                <p className="text-gray-600 text-sm mt-2">{service.details}</p>
            </div>

            {/* Add-on Services */}
            {(service.addOnServices && service.addOnServices.length > 0) && (
                <div className="py2">
                    <h2 className="text-sm font-bold mb-1">รายการเสริม</h2>
                    <div className="space-y-2">
                        {service.addOnServices.map((addOn, idx) => (
                            <AddOnCard
                                key={idx}
                                addOn={addOn}
                                isSelected={selectedAddOns.some(item => item.name === addOn.name)}
                                onToggle={toggleAddOn}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Footer ปกติ ไม่ fixed */}
            <div className="py-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 text-sm">ราคารวม</span>
                    <span className="text-xl font-bold text-gray-800">฿{totalPrice.toLocaleString()}</span>
                </div>
                <button
                    onClick={handleConfirm}
                    className="w-full bg-primary hover:bg-primary text-white py-4 rounded-2xl font-bold text-base transition-colors"
                >
                    ยืนยัน
                </button>
            </div>
            </div>
        </div>
    );
}

export default function ServiceDetailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ServiceDetailContent />
        </Suspense>
    );
}
