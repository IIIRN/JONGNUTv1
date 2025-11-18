// src/app/(customer)/appointment/service-detail/page.js
"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';

// --- Add-on Card Component ---
const AddOnCard = ({ addOn, isSelected, onToggle }) => {
    const { profile } = useProfile();
    return (
        <div
            onClick={() => onToggle(addOn)}
            className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-all text-sm ${isSelected ? 'bg-green-50 border-green-500 ring-2 ring-green-200' : 'bg-white'}`}
        >
            <div className="flex items-center w-full">
                <span className="font-semibold text-gray-800 flex-1">{addOn.name}</span>
                <span className="text-xs text-gray-700 ml-2 whitespace-nowrap">{addOn.duration} นาที | {profile.currency}{addOn.price?.toLocaleString()}</span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ml-2 ${isSelected ? 'bg-green-500' : 'border'}`}>
                    {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};

function ServiceDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('id');
    const [service, setService] = useState(null);
    const [selectedAddOns, setSelectedAddOns] = useState([]);
    const [selectedAreaIndex, setSelectedAreaIndex] = useState(null);
    const [selectedPackageIndex, setSelectedPackageIndex] = useState(null);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();

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
        let basePrice = 0;
        
        if (service?.serviceType === 'multi-area') {
            // สำหรับ multi-area service
            if (selectedAreaIndex !== null && selectedPackageIndex !== null && service.areas?.[selectedAreaIndex]?.packages?.[selectedPackageIndex]) {
                const selectedPackage = service.areas[selectedAreaIndex].packages[selectedPackageIndex];
                basePrice = selectedPackage.price;
            }
        } else {
            // สำหรับ single service
            basePrice = service?.price || 0;
        }
        
        const addOnsPrice = selectedAddOns.reduce((total, addOn) => total + (addOn.price || 0), 0);
        return basePrice + addOnsPrice;
    }, [service, selectedAddOns, selectedAreaIndex, selectedPackageIndex]);

    const totalDuration = useMemo(() => {
        let baseDuration = 0;
        
        if (service?.serviceType === 'multi-area') {
            // สำหรับ multi-area service
            if (selectedAreaIndex !== null && selectedPackageIndex !== null && service.areas?.[selectedAreaIndex]?.packages?.[selectedPackageIndex]) {
                const selectedPackage = service.areas[selectedAreaIndex].packages[selectedPackageIndex];
                baseDuration = selectedPackage.duration;
            }
        } else {
            // สำหรับ single service
            baseDuration = service?.duration || 0;
        }
        
        const addOnsDuration = selectedAddOns.reduce((total, addOn) => total + (addOn.duration || 0), 0);
        return baseDuration + addOnsDuration;
    }, [service, selectedAddOns, selectedAreaIndex, selectedPackageIndex]);


    const handleConfirm = () => {
        const params = new URLSearchParams();
        params.set('serviceId', service.id);
        
        // สำหรับ multi-area service
        if (service.serviceType === 'multi-area') {
            if (selectedAreaIndex === null || selectedPackageIndex === null) {
                alert('กรุณาเลือกพื้นที่และแพ็คเกจบริการ');
                return;
            }
            params.set('areaIndex', selectedAreaIndex.toString());
            params.set('packageIndex', selectedPackageIndex.toString());
        }
        
        if (selectedAddOns.length > 0) {
            params.set('addOns', selectedAddOns.map(a => a.name).join(','));
        }
        router.push(`/appointment/select-date-time?${params.toString()}`);
    };

    if (loading || profileLoading) return <div className="p-4 text-center">กำลังโหลด...</div>;
    if (!service) return null;

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} />

            <div className="p-4">
                {/* รูปภาพและชื่อบริการ */}
                <div className="flex gap-3 mb-4">
                    <div className="relative w-1/3 aspect-square rounded-xl overflow-hidden flex-shrink-0">
                        <Image
                            src={service.imageUrl || 'https://via.placeholder.com/400x200'}
                            alt={service.serviceName}
                            fill
                            style={{ objectFit: 'cover' }}
                            className="rounded-xl"
                            priority
                        />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                        <h1 className="text-md font-bold text-gray-800 leading-tight">{service.serviceName}</h1>
                         {/* แสดงราคาและระยะเวลาของบริการหลักเฉพาะเมื่อมีบริการเสริม */}
                    {service.serviceType !== 'multi-area' && (service.addOnServices && service.addOnServices.length > 0) && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">บริการหลัก</div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">ระยะเวลา</span>
                                <span className="text-sm text-gray-800">{service.duration} นาที</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">ราคา</span>
                                <span className="text-sm text-gray-800">{profile.currency}{service.price?.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                    </div>
                </div>

                {/* ชื่อและราคาบริการ */}
                <div className="mb-2">
                    
                    {service.serviceType === 'multi-area' ? (
                        <div className="mb-4">
                            <h2 className="text-sm font-semibold mb-2 text-gray-700">เลือกพื้นที่บริการ</h2>
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                {service.areas?.map((area, areaIdx) => (
                                    <button
                                        key={areaIdx}
                                        onClick={() => {
                                            setSelectedAreaIndex(areaIdx);
                                            setSelectedPackageIndex(null);
                                        }}
                                        className={`px-4 py-2 border rounded-full whitespace-nowrap text-sm font-medium transition-all flex-shrink-0 ${
                                            selectedAreaIndex === areaIdx 
                                                ? 'bg-primary text-white border-primary shadow-md' 
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {area.name}
                                    </button>
                                ))}
                            </div>
                            
                            {selectedAreaIndex !== null && service.areas[selectedAreaIndex]?.packages && (
                                <div className="mb-3">
                                    <h3 className="text-sm font-semibold mb-2 text-gray-700">เลือกแพ็คเกจ</h3>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {service.areas[selectedAreaIndex].packages.map((pkg, pkgIdx) => (
                                            <button
                                                key={pkgIdx}
                                                onClick={() => setSelectedPackageIndex(pkgIdx)}
                                                className={`px-4 py-2.5 border rounded-lg whitespace-nowrap text-sm font-medium transition-all flex-shrink-0 ${
                                                    selectedPackageIndex === pkgIdx
                                                        ? 'bg-primary text-white border-primary shadow-md'
                                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="font-medium">{pkg.duration} นาที</div>
                                                <div className="text-xs opacity-90">{pkg.price.toLocaleString()} {profile.currency}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                   
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-600 pr-4">ระยะเวลารวม</span>
                                <span className="text-sm font-bold text-gray-800">{totalDuration} นาที</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-600 pr-4">ราคารวม</span>
                                <span className="text-sm font-bold text-gray-800">{profile.currency}{totalPrice.toLocaleString()}</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleConfirm} 
                            className="w-1/3 bg-primary-dark hover:bg-primary text-white py-3 rounded-full font-bold text-base transition-colors"
                            disabled={service.serviceType === 'multi-area' && (selectedAreaIndex === null || selectedPackageIndex === null)}
                        >
                            จองบริการ
                        </button>
                    </div>
                </div>

                {/* Add-on Services */}
                {(service.addOnServices && service.addOnServices.length > 0) && (
                    <div className="py-2">
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

                {/* รายละเอียดบริการ */}
                {service.details && (
                    <div className="py-2 mt-4">
                        <h2 className="text-sm font-bold mb-2">รายละเอียดบริการ</h2>
                        <p className="text-gray-600 text-sm" style={{ whiteSpace: 'pre-line' }}>
                            {service.details}
                        </p>
                    </div>
                )}

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

