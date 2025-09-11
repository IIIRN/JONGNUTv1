// src/app/(employee)/layout.js
"use client";

import { LiffProvider } from '@/context/LiffProvider';

export default function EmployeeLayout({ children }) {
    const employeeLiffId = process.env.NEXT_PUBLIC_EMPLOYEE_LIFF_ID;
    return (
        <LiffProvider liffId={employeeLiffId}>
            <div className="bg-gray-50 min-h-screen">
                <main>
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}