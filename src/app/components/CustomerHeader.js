"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerHeader({ showBackButton = false, showActionButtons = true }) {
    const { profile, loading, error } = useLiffContext();
    const [customerData, setCustomerData] = useState(null);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe = () => {};
        if (profile?.userId) {
            const customerRef = doc(db, "customers", profile.userId);
            unsubscribe = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) {
                    setCustomerData(doc.data());
                }
            });
        }
        return () => unsubscribe();
    }, [profile]);

    if (loading || error) return null;

    return (
        <div className="p-3">
            <header className="rounded-xl p-3 bg-gradient-to-r from-purple-400 via-violet-400 to-pink-300 text-white shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {showBackButton && (
                        <button 
                            onClick={() => router.back()}
                            className="flex items-center text-white/90 hover:text-white mr-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    {profile?.pictureUrl ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                            <Image src={profile.pictureUrl} width={40} height={40} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-xl bg-white/30 flex-shrink-0" />
                    )}
                    <div>
                        <p className="font-medium text-sm opacity-90">สวัสดี</p>
                        <p className="font-bold text-base">{profile?.displayName ? `${profile.displayName}` : 'ผู้ใช้'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-white/90 rounded-full px-3 py-1 text-purple-600 font-bold text-sm">
                        {customerData?.points ?? 0} <span className="font-normal">พ้อย</span>
                    </div>
                </div>
            </header>
            
            {showActionButtons && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => router.push('/appointment')}
                        className="bg-white text-center text-pink-500 shadow-sm rounded-lg py-3 font-semibold text-sm hover:shadow-md transition-shadow"
                    >
                        จองบริการ
                    </button>
                    <button 
                        onClick={() => router.push('/my-coupons')}
                        className="bg-white text-center text-indigo-500 shadow-sm rounded-lg py-3 font-semibold text-sm hover:shadow-md transition-shadow"
                    >
                        คูปองของฉัน
                    </button>
                </div>
            )}
        </div>
    );
}
