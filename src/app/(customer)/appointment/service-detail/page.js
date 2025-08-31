"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';

// --- Add-on Card Component ---
const AddOnCard = ({ addOn, isSelected, onToggle }) => (
    <div
        onClick={() => onToggle(addOn)}
        className={`p-4 border rounded-lg flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'bg-pink-50 border-pink-500 ring-2 ring-pink-200' : 'bg-white'}`}
    >
        <div>
            <p className="font-semibold text-gray-800">{addOn.name}</p>
            <p className="text-sm text-gray-500">{addOn.duration} นาที</p>
        </div>
        <div className="flex items-center space-x-4">
            <p className="font-semibold text-gray-700">+{addOn.price?.toLocaleString()} ฿</p>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-pink-500' : 'border'}`}>
                {isSelected && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="pb-24"> {/* Add padding to bottom to avoid content being hidden by the fixed footer */}
            <div className="relative h-48 w-full">
                <Image
                    src={service.imageUrl || 'https://via.placeholder.com/400x200'}
                    alt={service.serviceName}
                    fill
                    style={{ objectFit: 'cover' }}
                    priority
                />
                <button onClick={() => router.back()} className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm rounded-full p-2">
                     <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
            </div>
            
            <div className="p-4">
                <h1 className="text-2xl font-bold text-gray-800">{service.serviceName}</h1>
                <div className="flex items-center text-gray-500 mt-1">
                    <span>{service.duration} นาที</span>
                    <span className="mx-2">·</span>
                    <span className="font-semibold text-pink-500">฿{service.price?.toLocaleString()}</span>
                </div>
                <p className="text-gray-600 mt-3">{service.details}</p>
            </div>

            {(service.addOnServices && service.addOnServices.length > 0) && (
                 <div className="p-4">
                    <h2 className="text-lg font-bold mb-3">บริการเสริม</h2>
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
            
            {/* --- Fixed Footer --- */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg max-w-md mx-auto">
                 <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-600">ราคารวม</span>
                    <span className="text-2xl font-bold text-gray-800">฿{totalPrice.toLocaleString()}</span>
                 </div>
                 <button 
                    onClick={handleConfirm} 
                    className="w-full bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600"
                >
                    เลือกวันและเวลา
                </button>
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
