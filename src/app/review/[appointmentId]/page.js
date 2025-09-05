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
                        className={`w-10 h-10 transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >    <path d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z" stroke="#141B34" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
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
                    setAppointment({ id, ...appointmentSnap.data() });
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