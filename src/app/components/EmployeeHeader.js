// src/app/components/EmployeeHeader.js
"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

export default function EmployeeHeader() {
    const { profile, loading, error } = useLiffContext();

    if (loading) {
        return (
            <div className="p-4">
                <div className="bg-white p-3 rounded-lg shadow-sm flex items-center space-x-3 animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-gray-300"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="bg-red-100 text-red-700 p-3 rounded-lg">
                    <p><strong>LIFF Error:</strong> {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <header className="bg-white text-gray-800 p-3 shadow-sm flex items-center space-x-3 rounded-lg">
                {profile?.pictureUrl && (
                    <Image src={profile.pictureUrl} width={48} height={48} alt="Profile" className="w-12 h-12 rounded-full"/>
                )}
                <div>
                    <p className="text-sm text-gray-500">พนักงาน</p>
                    <p className="font-semibold text-base">{profile?.displayName}</p>
                </div>
            </header>
        </div>
    );
}