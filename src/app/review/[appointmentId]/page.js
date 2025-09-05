"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { submitReview } from '@/app/actions/reviewActions';
import { createReviewThankYouFlexTemplate } from '@/app/actions/flexTemplateActions';
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
                    className="focus:outline-none transition-transform hover:scale-110"
                >
                   <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`w-12 h-12 transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
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
    const { liff, profile, loading: liffLoading } = useLiffContext();
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
                try {
                    const appointmentRef = doc(db, 'appointments', id);
                    const appointmentSnap = await getDoc(appointmentRef);
                    if (appointmentSnap.exists()) {
                        setAppointment({id, ...appointmentSnap.data()});
                    } else {
                        setError('ไม่พบข้อมูลการนัดหมาย');
                    }
                } catch (err) {
                    console.error('Error fetching appointment:', err);
                    setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
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

        if (!liff) {
            setError('ไม่สามารถเชื่อมต่อ LINE ได้');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const reviewData = {
                appointmentId: appointment.id,
                userId: profile.userId,
                userName: profile.displayName,
                userPicture: profile.pictureUrl,
                rating,
                comment: comment.trim(),
                serviceId: appointment.serviceId,
                beauticianId: appointment.beauticianId,
                createdAt: new Date().toISOString()
            };

            const result = await submitReview(reviewData);
            
            if (result.success) {
                setSuccess(true);
                
                // ส่งข้อความกลับ LINE OA
                if (liff.isInClient()) {
                    try {
                        // สร้าง Flex Message สำหรับขอบคุณหลังรีวิว
                        const reviewThankYouFlex = createReviewThankYouFlexTemplate({
                            rating,
                            comment: comment.trim(),
                            appointmentId: appointment.id
                        });
                        
                        await liff.sendMessages([reviewThankYouFlex]);
                    } catch (msgError) {
                        console.warn('ไม่สามารถส่งข้อความได้:', msgError);
                    }
                }
                
                // ปิด LIFF หลังจากสำเร็จ
                setTimeout(() => {
                    if (liff && liff.closeWindow) {
                        liff.closeWindow();
                    }
                }, 3000);
            } else {
                throw new Error(result.error || 'ไม่สามารถส่งรีวิวได้');
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการส่งรีวิว');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (liff && liff.closeWindow) {
            liff.closeWindow();
        }
    };

    if (liffLoading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p>กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    if (error && !appointment) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <div className="text-red-600 text-lg font-semibold mb-2">เกิดข้อผิดพลาด</div>
                <p className="text-red-500 mb-4">{error}</p>
                <button 
                    onClick={handleCancel}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                    ปิดหน้าต่าง
                </button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-green-600 text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">ขอบคุณสำหรับรีวิว!</h2>
                <div className="text-yellow-400 text-2xl mb-2">
                    {'⭐'.repeat(rating)}
                </div>
                <p className="text-green-700 mb-4">
                    ความคิดเห็นของคุณมีค่ามากสำหรับเรา
                </p>
                <button 
                    onClick={handleCancel}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                >
                    ปิดหน้าต่าง
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Appointment Info */}
            {appointment && (
                <div className="bg-white rounded-lg shadow-md p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">ข้อมูลการนัดหมาย</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>บริการ:</span>
                            <span>{appointment.serviceInfo?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>ช่าง:</span>
                            <span>{appointment.appointmentInfo?.beauticianInfo?.firstName} {appointment.appointmentInfo?.beauticianInfo?.lastName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>วันที่:</span>
                            <span>{new Date(appointment.date).toLocaleDateString('th-TH')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>เวลา:</span>
                            <span>{appointment.time}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-center text-gray-800 mb-6">รีวิวบริการ</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Star Rating */}
                    <div className="text-center">
                        <label className="block text-sm font-medium text-gray-700 mb-4">
                            ให้คะแนนบริการ
                        </label>
                        <StarRating rating={rating} setRating={setRating} />
                        <p className="text-sm text-gray-500 mt-2">
                            {rating > 0 ? `${rating} ดาว` : 'กรุณาให้คะแนน'}
                        </p>
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            ความคิดเห็นเพิ่มเติม (ไม่บังคับ)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            rows="4"
                            placeholder="แบ่งปันประสบการณ์ของคุณกับเรา..."
                            maxLength={500}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {comment.length}/500 ตัวอักษร
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Submit Buttons */}
                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={isSubmitting || rating === 0}
                            className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'กำลังส่งรีวิว...' : '🌟 ส่งรีวิว'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCancel}
                            className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600"
                        >
                            ยกเลิก
                        </button>
                    </div>
                </form>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                    💡 <strong>ขอบคุณที่ใช้บริการ!</strong> รีวิวของคุณจะช่วยให้เราปรับปรุงบริการให้ดียิ่งขึ้น
                </p>
            </div>
        </div>
    );
}

// Main component that wraps ReviewContent with Suspense
export default function ReviewPage() {
    return (
        <Suspense fallback={
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p>กำลังโหลด...</p>
            </div>
        }>
            <ReviewContent />
        </Suspense>
    );
}