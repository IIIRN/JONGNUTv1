"use client";

import { useState, useEffect, Suspense } from 'react'; // Import Suspense
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';

// --- Beautician Card Component ---
const BeauticianCard = ({ beautician, isSelected, onSelect }) => (
    <div
        onClick={() => onSelect(beautician)}
        className={`rounded-lg p-3 flex flex-col items-center border-2 transition-all cursor-pointer ${isSelected ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}
    >
        <div className="relative w-20 h-20 rounded-full overflow-hidden">
            <Image
                src={beautician.imageUrl || 'https://via.placeholder.com/150'}
                alt={beautician.firstName}
                fill
                style={{ objectFit: 'cover' }}
            />
        </div>
        <p className="font-bold mt-2 text-gray-800">{beautician.firstName}</p>
        <p className={`mt-1 text-xs px-2 py-0.5 rounded-full ${beautician.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {beautician.status === 'available' ? 'ว่าง' : 'ไม่ว่าง'}
        </p>
    </div>
);

// --- Time Slot Component ---
const TimeSlot = ({ time, isSelected, onSelect }) => (
    <button
        onClick={() => onSelect(time)}
        className={`rounded-lg px-4 py-2 transition-colors text-sm font-semibold ${isSelected ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
        {time}
    </button>
);


function SelectDateTimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');

    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState('');
    const [beauticians, setBeauticians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBeautician, setSelectedBeautician] = useState(null);

    // Example time slots
    const timeSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    useEffect(() => {
        const fetchBeauticians = async () => {
            setLoading(true);
            try {
                // Fetch only available beauticians
                const q = query(
                    collection(db, 'beauticians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const querySnapshot = await getDocs(q);
                setBeauticians(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (e) {
                console.error("Error fetching beauticians:", e);
            }
            setLoading(false);
        };
        fetchBeauticians();
    }, []);

    const handleConfirm = () => {
        if (!date || !time || !selectedBeautician) {
            alert('กรุณาเลือกวัน, เวลา และช่างเสริมสวย');
            return;
        }
        const params = new URLSearchParams();
        if (serviceId) params.set('serviceId', serviceId);
        if (addOns) params.set('addOns', addOns);
        params.set('date', format(date, 'yyyy-MM-dd'));
        params.set('time', time);
        params.set('beauticianId', selectedBeautician.id);
        router.push(`/appointment/general-info?${params.toString()}`);
    };

    return (
        <div className="pb-28">
             <div className="p-4">
                <button onClick={() => router.back()} className="flex items-center text-gray-600">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    ย้อนกลับ
                </button>
            </div>
            
            <div className="p-4">
                <h2 className="text-lg font-bold mb-3">1. เลือกวันที่</h2>
                <div className="flex justify-center bg-white p-2 rounded-lg shadow-sm">
                    <DayPicker
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        locale={th}
                        modifiers={{ disabled: { before: new Date() } }}
                    />
                </div>
            </div>

            <div className="p-4">
                 <h2 className="text-lg font-bold mb-3">2. เลือกเวลา</h2>
                 <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map(slot => (
                        <TimeSlot key={slot} time={slot} isSelected={time === slot} onSelect={setTime} />
                    ))}
                 </div>
            </div>

            <div className="p-4">
                <h2 className="text-lg font-bold mb-3">3. เลือกช่างเสริมสวย</h2>
                {loading ? (
                    <div className="text-center">กำลังโหลดรายชื่อช่าง...</div>
                ) : beauticians.length === 0 ? (
                    <div className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">ขออภัย ไม่มีช่างที่พร้อมให้บริการในขณะนี้</div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {beauticians.map(beautician => (
                            <BeauticianCard
                                key={beautician.id}
                                beautician={beautician}
                                isSelected={selectedBeautician?.id === beautician.id}
                                onSelect={setSelectedBeautician}
                            />
                        ))}
                    </div>
                )}
            </div>

             {/* --- Fixed Footer --- */}
             <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg max-w-md mx-auto">
                 <div className="flex justify-between items-center mb-3 text-sm">
                    <div>
                        <p className="text-gray-500">วันที่เลือก</p>
                        <p className="font-bold">{date ? format(date, 'dd MMM yyyy', { locale: th }) : 'ยังไม่ได้เลือก'}</p>
                    </div>
                     <div>
                        <p className="text-gray-500">เวลา</p>
                        <p className="font-bold">{time || 'ยังไม่ได้เลือก'}</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleConfirm} 
                    disabled={!date || !time || !selectedBeautician}
                    className="w-full bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600 disabled:bg-gray-300"
                >
                    ถัดไป
                </button>
            </div>
        </div>
    );
}

export default function SelectDateTimePage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">กำลังโหลด...</div>}>
            <SelectDateTimeContent />
        </Suspense>
    );
}