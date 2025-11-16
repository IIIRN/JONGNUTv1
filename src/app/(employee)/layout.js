// src/app/(employee)/layout.js
"use client";

import { LiffProvider } from '@/context/LiffProvider';
import { ToastProvider } from '@/app/components/Toast';
import { ProfileProvider } from '@/context/ProfileProvider';

export default function EmployeeLayout({ children }) {
    const employeeLiffId = process.env.NEXT_PUBLIC_EMPLOYEE_LIFF_ID;
    return (
        <ToastProvider>
            <LiffProvider liffId={employeeLiffId}>
                <ProfileProvider>
                    <div className="bg-gray-50 min-h-screen">
                        <main>
                            {children}
                        </main>
                    </div>
                </ProfileProvider>
            </LiffProvider>
        </ToastProvider>
    );
}

