"use client";

import { LiffProvider, useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function CustomerHeader() {
    const { profile, loading, error } = useLiffContext();
    const [customerData, setCustomerData] = useState(null);

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
        <div className="p-4">
            <header className="rounded-2xl p-3 bg-gradient-to-r from-purple-400 via-violet-400 to-pink-300 text-white shadow flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {profile?.pictureUrl ? (
                        <Image src={profile.pictureUrl} width={56} height={56} alt="Profile" className="rounded-md object-cover" />
                    ) : (
                        <div className="w-14 h-14 rounded-md bg-white/30 flex-shrink-0" />
                    )}
                    <div>
                        <p className="font-semibold text-base">{profile?.displayName ? `คุณ${profile.displayName}` : 'ผู้ใช้'}</p>
                        {profile?.userId && <p className="text-xs opacity-80">id {profile.userId}</p>}
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="bg-white rounded-full px-4 py-1 text-purple-600 font-bold">{customerData?.points ?? 0}</div>
                    <div className="text-xs opacity-90">points</div>
                </div>
            </header>
            
            <div className="mt-4 grid grid-cols-2 gap-3">
                 <Link href="/appointment" className="bg-white text-center text-pink-500 shadow rounded-lg py-3 font-semibold text-sm">
                    จองบริการ
                </Link>
                 <Link href="/my-coupons" className="bg-white text-center text-indigo-500 shadow rounded-lg py-3 font-semibold text-sm">
                    คูปองของฉัน
                </Link>
            </div>
        </div>
    );
}

export default function CustomerLayout({ children }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;
    return (
        <LiffProvider liffId={customerLiffId}>
            <div className="bg-gray-50 min-h-screen relative bg-fixed ">
                <CustomerHeader />
                <main className="px-4 pb-4">
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}