// src/app/review/page.js
"use client";

// This page acts as a loading/entry point for the LIFF redirect.
export default function ReviewLoadingPage() {
    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดหน้ารีวิว...</p>
            </div>
        </div>
    );
}