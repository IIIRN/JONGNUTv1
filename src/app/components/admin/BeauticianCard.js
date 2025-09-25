"use client";

import Image from 'next/image';

export default function BeauticianCard({ beautician, isSelected, onSelect, isAvailable }) {
    return (
        <div
            onClick={() => isAvailable && onSelect(beautician)}
            className={`rounded-lg p-4 flex items-center space-x-4 border-2 transition-all w-full ${
                !isAvailable 
                    ? 'bg-gray-200 opacity-60 cursor-not-allowed' 
                    : isSelected 
                        ? 'border-indigo-500 bg-indigo-50 cursor-pointer' 
                        : 'border-gray-200 bg-white cursor-pointer hover:border-indigo-200'
            }`}
        >
            <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                <Image
                    src={beautician.imageUrl || 'https://via.placeholder.com/150'}
                    alt={beautician.firstName}
                    fill
                    style={{ objectFit: 'cover' }}
                />
            </div>
            <div className="flex-1">
                <p className="font-bold text-lg text-gray-800">{beautician.firstName} {beautician.lastName}</p>
            </div>
            <div className="flex items-center space-x-3">
                <p className={`text-sm px-3 py-1 rounded-full ${
                    isAvailable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                }`}>
                    {isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
                </p>
                {isSelected && isAvailable && (
                    <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
}