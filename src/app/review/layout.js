"use client";

import { LiffProvider, useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

function ReviewHeader() {
    const { profile, loading, error } = useLiffContext();

    if (loading || error) {
        return (
            <div className="p-4">
                <div className="rounded-2xl p-4 bg-gradient-to-r from-[#7F7679] via-[#CAB6BD] to-[#A8999E] text-white shadow-md flex items-center justify-between">
                    <div className="w-12 h-12 rounded-full bg-gray-500 flex-shrink-0"></div>
                    <div className="flex-grow space-y-2">
                        <div className="h-2 bg-gray-500 rounded w-1/4"></div>
                        <div className="h-3 bg-gray-500 rounded w-3/4"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <header className="rounded-2xl p-4 bg-gradient-to-r from-[#7F7679] via-[#CAB6BD] to-[#A8999E] text-white shadow-md flex items-center justify-between">
                {profile?.pictureUrl && (
                    <Image src={profile.pictureUrl} width={48} height={48} alt="Profile" className="w-12 h-12 rounded-full"/>
                )}
                <div>
                    <p className="text-sm text-orange-400">รีวิวการเดินทาง</p>
                    <p className="font-semibold text-base">คุณ{profile?.displayName}</p>
                </div>
            </header>
        </div>
    );
}

export default function ReviewLayout({ children }) {
    const reviewLiffId = process.env.NEXT_PUBLIC_REVIEW_LIFF_ID;
    console.log('Review LIFF ID:', reviewLiffId);
    return (
        <LiffProvider liffId={reviewLiffId}>
            <div className="max-w-md mx-auto bg-gray-100 min-h-screen">
                <ReviewHeader />
                <main className="px-4 pb-4">
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}
