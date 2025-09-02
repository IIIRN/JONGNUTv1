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
        let unsubscribe = () => { };
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
            <header className="rounded-2xl p-4 bg-gradient-to-r from-[#7F7679] via-[#CAB6BD] to-[#A8999E] text-white shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {profile?.pictureUrl ? (
                        <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                            <Image src={profile.pictureUrl} width={40} height={40} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-white/30 flex-shrink-0" />
                    )}
                    <div>
                        <p className="font-medium text-sm opacity-90">สวัสดี</p>
                        <p className="font-bold text-base">{profile?.displayName ? `${profile.displayName}` : 'ผู้ใช้'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-white/90 rounded-full px-6 py-2 text-primary font-bold text-md">
                        {customerData?.points ?? 0} <span className="font-normal">พ้อย</span>
                    </div>
                </div>
            </header>

            {showActionButtons && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                    <button
                        onClick={() => router.push('/appointment')}
                        className="bg-primary-light text-primary shadow-sm rounded-2xl py-4 font-semibold text-md hover:shadow-md transition-shadow"
                    >
                        จองบริการ
                    </button>
                    <button
                        onClick={() => router.push('/my-coupons')}
                        className="bg-primary-light text-primary shadow-sm rounded-2xl py-4  font-semibold text-md hover:shadow-md transition-shadow"
                    >
                        คูปองของฉัน
                    </button>

                </div>
            )}
        </div>
    );
}
