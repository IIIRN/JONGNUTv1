"use client";

import { LiffProvider } from '@/context/LiffProvider';

export default function CustomerLayout({ children }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;
    return (
        <LiffProvider liffId={customerLiffId}>
            <div className="bg-gray-50 min-h-screen relative bg-fixed">
                <main>
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}