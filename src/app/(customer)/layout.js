// src/app/(customer)/layout.js
"use client";

import { LiffProvider } from '@/context/LiffProvider';
import { ToastProvider } from '@/app/components/Toast'; // --- IMPORT ToastProvider ---
import { ProfileProvider } from '@/context/ProfileProvider'; // --- IMPORT ProfileProvider ---

export default function CustomerLayout({ children }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;
    return (
        // --- WRAP with ToastProvider ---
        <ToastProvider>
            <LiffProvider liffId={customerLiffId}>
                {/* --- WRAP with ProfileProvider --- */}
                <ProfileProvider>
                    <div className="bg-primary-light min-h-screen relative bg-fixed">
                        <main className='w-full max-w-md mx-auto'>
                            {children}
                        </main>
                    </div>
                </ProfileProvider>
            </LiffProvider>
        </ToastProvider>
    );
}