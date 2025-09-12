"use client";

import { LiffProvider } from '@/context/LiffProvider';

export default function CustomerLayout({ children }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;
    return (
        <LiffProvider liffId={customerLiffId}>
            <div className="bg-primary-light min-h-screen relative bg-fixed">
                <main className='w-full max-w-md mx-auto'>
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}