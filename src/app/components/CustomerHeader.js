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
        <div className="p-4 bg-primary">
            <header className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {profile?.pictureUrl ? (
                        <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                            <Image src={profile.pictureUrl} width={56} height={56} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-gray-800 flex-shrink-0" />
                    )}
                    <div>
                        <p className="text-sm text-primary-dark">สวัสดี</p>
                        <p className="font-semibold text-primary-dark">{profile?.displayName ? `${profile.displayName}` : 'ผู้ใช้'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-primary-light rounded-full px-7 py-3 text-primary font-medium text-md">
                        {customerData?.points ?? 0} พ้อย
                    </div>
                </div>
            </header>

            {showActionButtons && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                        onClick={() => router.push('/appointment')}
                        className="bg-white text-gray-800 rounded-2xl py-3 font-medium text-base hover:shadow-md transition-shadow border border-gray-200"
                    >
                        จองบริการ
                    </button>
                    <button
                        onClick={() => router.push('/my-coupons')}
                        className="bg-white text-gray-800 rounded-2xl py-3 font-medium text-base hover:shadow-md transition-shadow border border-gray-200"
                    >
                        คูปองของฉัน
                    </button>
                </div>
            )}
        </div>
    );
}

