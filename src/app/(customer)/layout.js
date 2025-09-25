// src/app/(customer)/layout.js
"use client";

import { LiffProvider } from '@/context/LiffProvider';
import { ToastProvider } from '@/app/components/Toast'; // --- IMPORT ToastProvider ---
import { ProfileProvider } from '@/context/ProfileProvider'; // --- IMPORT ProfileProvider ---

export default function CustomerLayout({ children }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;
    return (
        <ToastProvider>
            <LiffProvider liffId={customerLiffId}>
                <ProfileProvider>
                    <div className="bg-gradient-to-b from-[#f1ebe9] to-[#ffffff] min-h-screen relative bg-fixed">
                        <main className='w-full max-w-md mx-auto'>
                            {children}
                        </main>
                    </div>
                </ProfileProvider>
            </LiffProvider>
        </ToastProvider>
    );
}