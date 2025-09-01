"use client";

import { useState, useEffect, Suspense } from 'react'; // Import Suspense
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
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
    // สัปดาห์ปัจจุบัน (เริ่มที่วันอาทิตย์)
    const getStartOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0,0,0,0);
        return date;
    };
    const [activeStartDate, setActiveStartDate] = useState(getStartOfWeek(new Date()));
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
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-white flex flex-col items-center pt-4 px-2">
            {/* Calendar */}
            <div className="w-full max-w-md mx-auto flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-2">
                    <button
                        onClick={() => setActiveStartDate(prev => {
                            const d = new Date(prev);
                            d.setDate(d.getDate() - 7);
                            return d;
                        })}
                        className="px-2 py-1 text-xl text-purple-400 hover:text-pink-500"
                    >&#60;</button>
                    <span className="font-bold text-base text-purple-700">
                        {activeStartDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={() => setActiveStartDate(prev => {
                            const d = new Date(prev);
                            d.setDate(d.getDate() + 7);
                            return d;
                        })}
                        className="px-2 py-1 text-xl text-purple-400 hover:text-pink-500"
                    >&#62;</button>
                </div>
                <div className="w-full">
                    <div className="grid grid-cols-7 gap-2 justify-items-center">
                        {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((d, i) => (
                            <div key={i} className="text-xs text-purple-400 text-center font-semibold">{d}</div>
                        ))}
                        {Array.from({ length: 7 }).map((_, i) => {
                            const d = new Date(activeStartDate);
                            d.setDate(d.getDate() + i);
                            const isToday = (new Date()).toDateString() === d.toDateString();
                            const isSelected = date && d.toDateString() === date.toDateString();
                            const isPast = d < new Date(new Date().setHours(0,0,0,0));
                            return (
                                <button
                                    key={i}
                                    onClick={() => !isPast && setDate(d)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-semibold transition-colors
                                        ${isSelected ? 'bg-gradient-to-tr from-pink-400 to-purple-500 text-white shadow-lg' : isToday ? 'border-2 border-pink-400 text-pink-500 bg-white' : 'bg-white text-purple-700'}
                                        ${isPast ? 'opacity-40 cursor-not-allowed' : 'hover:bg-pink-100'}
                                    `}
                                    disabled={isPast}
                                >
                                    {d.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Available Time */}
            <div className="w-full max-w-md mx-auto mt-6">
                <h2 className="text-base font-bold mb-2 text-purple-700">AVAILABLE TIME</h2>
                <div className="grid grid-cols-3 gap-3">
                    {timeSlots.map(slot => (
                        <button
                            key={slot}
                            onClick={() => setTime(slot)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors
                                ${time === slot ? 'bg-gradient-to-tr from-pink-400 to-purple-500 text-white shadow-lg' : 'bg-white text-purple-700 border border-purple-100 hover:bg-purple-50'}`}
                        >
                            {slot}
                        </button>
                    ))}
                </div>
            </div>

            {/* Beautician Selection (optional, can be hidden for minimal UI) */}
            <div className="w-full max-w-md mx-auto mt-6">
                <h2 className="text-base font-bold mb-2 text-purple-700">เลือกช่างเสริมสวย</h2>
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

            {/* Confirm Button */}
            <div className="w-full max-w-md mx-auto mt-8 mb-8">
                <button
                    onClick={handleConfirm}
                    disabled={!date || !time || !selectedBeautician}
                    className="w-full bg-gradient-to-tr from-pink-400 to-purple-500 text-white py-3 rounded-xl font-bold text-base shadow-lg hover:from-pink-500 hover:to-purple-600 disabled:bg-gray-300 disabled:text-gray-400"
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