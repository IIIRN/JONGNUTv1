"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { submitReview } from '@/app/actions/reviewActions';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Star Rating Component
const StarRating = ({ rating, setRating }) => {
    return (
        <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                >
                   <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`w-10 h-10 transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    >
                    <path
                        fillRule="evenodd"
                        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0L7.07 7.56l-5.056.367c-.83.06-1.171 1.106-.536 
                        1.651l3.847 3.292-1.148 4.873c-.19.806.676 
                        1.44 1.374.995L10 15.347l4.45 2.39c.698.445 
                        1.563-.189 1.374-.995l-1.149-4.873 
                        3.847-3.292c.635-.545.294-1.591-.536-1.651L12.93 
                        7.56l-2.062-4.676z"
                        clipRule="evenodd"
                    />
                    </svg>

                </button>
            ))}
        </div>
    );
};

function ReviewContent() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [appointment, setAppointment] = useState(null); 

    const params = useParams();
    const searchParams = useSearchParams();
    const appointmentId = params.appointmentId;

    useEffect(() => {
        const getAppointmentId = () => {
            if (appointmentId) {
                return appointmentId;
            }
            const liffState = searchParams.get('liff.state');
            if (liffState) {
                const parts = liffState.split('/');
                if (parts.length > 2 && parts[1] === 'review') {
                    return parts[2];
                }
            }
            return null;
        };

        const id = getAppointmentId();
        if (id) {
            const fetchAppointment = async () => {
                const appointmentRef = doc(db, 'appointments', id);
                const appointmentSnap = await getDoc(appointmentRef);
                if (appointmentSnap.exists()) {
                    setAppointment({id, ...appointmentSnap.data()});
                } else {
                    setError('ไม่พบข้อมูลการนัดหมาย');
                }
            };
            fetchAppointment();
        } else if (!liffLoading) {
            setError('ไม่พบ Appointment ID');
        }
    }, [appointmentId, searchParams, liffLoading]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            setError('กรุณาให้คะแนนอย่างน้อย 1 ดาว');
            return;
        }
        if (!profile?.userId || !appointment) { 
            setError('ไม่สามารถระบุตัวตนหรือข้อมูลการนัดหมายได้');
            return;
        }
        setIsSubmitting(true);
        setError('');

        const reviewData = {
            appointmentId: appointment.id,
            userId: profile.userId,
            beauticianId: appointment.beauticianId || null,
            rating: rating,
            comment: comment,
        };

        const result = await submitReview(reviewData);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.error);
        }
        setIsSubmitting(false);
    };
    
    if (liffLoading) {
        return <div className="p-4 text-center">กำลังโหลด...</div>
    }

    if (error && !appointmentId) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-2">เกิดข้อผิดพลาด</h1>
                <p className="text-gray-600">{error}</p>
            </div>
        )
    }

    if (!appointmentId) {
        return <div className="p-4 text-center">กำลังค้นหาข้อมูลการนัดหมาย...</div>
    }

    if (success) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                <h1 className="text-2xl font-bold text-green-600 mb-2">ขอบคุณสำหรับรีวิว!</h1>
                <p className="text-gray-600">ความคิดเห็นของคุณมีความสำคัญต่อการพัฒนาบริการของเรา</p>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-center mb-2">รีวิวบริการ</h1>
            <p className="text-center text-gray-500 mb-6">Appointment ID: {appointmentId.substring(0, 6).toUpperCase()}</p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-center text-lg font-medium text-gray-700 mb-3">
                        ให้คะแนนความพึงพอใจ
                    </label>
                    <StarRating rating={rating} setRating={setRating} />
                </div>

                <div>
                    <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                        ความคิดเห็นเพิ่มเติม (ถ้ามี)
                    </label>
                    <textarea
                        id="comment"
                        rows="4"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-md"
                        placeholder="เล่าประสบการณ์ของคุณ..."
                    ></textarea>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-800 text-white p-3 rounded-lg font-bold text-lg hover:bg-slate-700 disabled:bg-gray-400"
                >
                    {isSubmitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
                </button>
            </form>
        </div>
    );
}

export default function ReviewPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">กำลังโหลดหน้า...</div>}>
            <ReviewContent />
        </Suspense>
    );
}