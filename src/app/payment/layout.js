// src/app/payment/layout.js
"use client";

import { LiffProvider, useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

function PaymentHeader() {
    const { profile, loading, error } = useLiffContext();

    if (loading) {
        return (
            <div className="p-4">
                <div className="bg-white shadow-sm rounded-2xl p-4 flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gray-300 animate-pulse flex-shrink-0"></div>
                    <div className="flex-grow space-y-2">
                        <div className="h-3 bg-gray-300 rounded w-1/4 animate-pulse"></div>
                        <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-red-600 text-sm">เกิดข้อผิดพลาดในการเชื่อมต่อ LINE</p>
                    <p className="text-red-500 text-xs mt-1">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <header className="bg-gradient-to-r from-green-400 to-green-600 shadow-sm rounded-2xl p-4 flex items-center space-x-4 text-white">
                {profile?.pictureUrl && (
                    <Image 
                        src={profile.pictureUrl} 
                        width={48} 
                        height={48} 
                        alt="Profile" 
                        className="w-12 h-12 rounded-full border-2 border-white"
                    />
                )}
                <div>
                    <p className="text-green-100 text-sm">ชำระเงิน</p>
                    <p className="font-semibold text-base">คุณ{profile?.displayName || 'ลูกค้า'}</p>
                </div>
            </header>
        </div>
    );
}

export default function PaymentLayout({ children }) {
    // ใช้ PAYMENT_LIFF_ID สำหรับหน้าชำระเงินโดยเฉพาะ
    const paymentLiffId = process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID;
    
    console.log('Payment LIFF ID:', paymentLiffId); // Debug log
    
    if (!paymentLiffId) {
        return (
            <div className="max-w-md mx-auto bg-gray-100 min-h-screen flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-red-600">ไม่พบการตั้งค่า LIFF สำหรับการชำระเงิน</p>
                    <p className="text-red-500 text-sm mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
                </div>
            </div>
        );
    }
    
    return (
        <LiffProvider liffId={paymentLiffId}>
            <div className="max-w-md mx-auto bg-gray-100 min-h-screen">
                <PaymentHeader />
                <main className="p-4">
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}
