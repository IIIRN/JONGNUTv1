"use client";

import { LiffProvider, useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

function EmployeeHeader() { // Reverted to Employee
    const { profile, loading, error } = useLiffContext();

    if (loading || error) {
        return (
            <header className="bg-white p-4 shadow-sm flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse"></div>
                <div>
                    <p className="font-semibold text-lg">พนักงาน</p>
                    <p className="text-sm text-gray-400">{error ? 'เกิดข้อผิดพลาด' : 'กำลังโหลด...'}</p>
                </div>
            </header>
        );
    }

    return (
        <header className="bg-white p-4 shadow-sm flex items-center space-x-4">
            {profile?.pictureUrl && (
                <Image src={profile.pictureUrl} width={48} height={48} alt="Employee Profile" className="w-12 h-12 rounded-full"/>
            )}
            <div>
                <p className="font-semibold text-lg">พนักงาน</p>
                <p className="text-sm text-gray-500">{profile?.displayName}</p>
            </div>
        </header>
    );
}

export default function EmployeeLayout({ children }) { // Reverted to Employee
    const employeeLiffId = process.env.NEXT_PUBLIC_DRIVER_LIFF_ID; // Using original env var

    return (
        <LiffProvider liffId={employeeLiffId}>
            <div className="max-w-md mx-auto min-h-screen bg-gray-50">
                <EmployeeHeader />
                <main className="px-4 pb-4 mt-4">
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}