"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

// The main component logic is moved into its own component
function GeneralInfoContent() {
    const searchParams = useSearchParams();
    const { profile, loading: liffLoading } = useLiffContext();
    const router = useRouter();

    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const beauticianId = searchParams.get('beauticianId');

    const [formData, setFormData] = useState({ fullName: "", phone: "", email: "", note: "" });
    const [service, setService] = useState(null);
    const [beautician, setBeautician] = useState(null);
    const [availableCoupons, setAvailableCoupons] = useState([]);
    const [selectedCouponId, setSelectedCouponId] = useState('');
    const [showCoupon, setShowCoupon] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            if (liffLoading || !profile?.userId || !serviceId || !beauticianId) return;
            try {
                const [customerSnap, serviceSnap, beauticianSnap, couponsSnapshot] = await Promise.all([
                    getDoc(doc(db, "customers", profile.userId)),
                    getDoc(doc(db, 'services', serviceId)),
                    getDoc(doc(db, 'beauticians', beauticianId)),
                    getDocs(query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false)))
                ]);

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.name || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (serviceSnap.exists()) setService(serviceSnap.data());
                if (beauticianSnap.exists()) setBeautician(beauticianSnap.data());
                setAvailableCoupons(couponsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [profile, liffLoading, serviceId, beauticianId]);

    const { totalPrice, discount, finalPrice } = useMemo(() => {
        if (!service) return { totalPrice: 0, discount: 0, finalPrice: 0 };
        const addOnsPrice = (service.addOnServices || []).filter(a => addOns?.split(',').includes(a.name)).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
        const currentTotalPrice = (Number(service.price) || 0) + addOnsPrice;
        let currentDiscount = 0;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);
        if (selectedCoupon?.type === 'percentage_discount') {
            currentDiscount = (currentTotalPrice * selectedCoupon.value) / 100;
        }
        return { totalPrice: currentTotalPrice, discount: currentDiscount, finalPrice: currentTotalPrice - currentDiscount };
    }, [service, addOns, selectedCouponId, availableCoupons]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone) return alert("กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์");
        if (liffLoading || !profile?.userId) return alert('กรุณาเข้าสู่ระบบก่อนทำการจอง');

        setIsSubmitting(true);
        try {
            const appointmentData = {
                userId: profile.userId,
                userInfo: { displayName: profile.displayName || '', pictureUrl: profile.pictureUrl || '' },
                status: 'awaiting_confirmation',
                customerInfo: formData,
                serviceInfo: { id: serviceId, name: service.serviceName, imageUrl: service.imageUrl || '' },
                appointmentInfo: {
                    beauticianId: beauticianId,
                    employeeId: beauticianId, // Keep employeeId for compatibility if needed
                    beauticianInfo: { firstName: beautician.firstName, lastName: beautician.lastName },
                    dateTime: new Date(`${date}T${time}`),
                    addOns: (service.addOnServices || []).filter(a => addOns?.includes(a.name)),
                    duration: (service.duration || 0) + (service.addOnServices || []).filter(a => addOns?.includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0),
                },
                paymentInfo: {
                    totalPrice: finalPrice,
                    originalPrice: totalPrice,
                    discount: discount,
                    couponId: selectedCouponId || null,
                    couponName: availableCoupons.find(c => c.id === selectedCouponId)?.name || null,
                    paymentStatus: 'unpaid',
                },
                createdAt: serverTimestamp(),
            };

            const newAppointment = await addDoc(collection(db, 'appointments'), appointmentData);

            if (selectedCouponId) {
                await updateDoc(doc(db, 'customers', profile.userId, 'coupons', selectedCouponId), {
                    used: true,
                    usedAt: serverTimestamp(),
                    appointmentId: newAppointment.id
                });
            }

            const customerRef = doc(db, 'customers', profile.userId);
            const customerSnap = await getDoc(customerRef);
            const newPoints = (customerSnap.exists() ? customerSnap.data().points : 0) + 1;
            await setDoc(customerRef, { ...formData, points: newPoints, updatedAt: serverTimestamp() }, { merge: true });

            alert('จองสำเร็จ!');
            router.push('/my-appointments');

        } catch (err) {
            alert('เกิดข้อผิดพลาดในการจอง');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center">กำลังโหลดข้อมูล...</div>;
    }

    return (
        <div className="pb-28">
            <form onSubmit={handleSubmit} className="p-4">
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <h2 className="text-xl font-bold mb-4">ยืนยันการนัดหมาย</h2>
                    
                    <div className="space-y-2 text-sm mb-4 border-b pb-4">
                         <div className="flex justify-between"><span className="text-gray-500">บริการ:</span><span className="font-semibold text-right">{service?.serviceName || 'N/A'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">พนักงาน:</span><span className="font-semibold text-right">{beautician ? `${beautician.firstName} ${beautician.lastName}` : 'N/A'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">วัน-เวลา:</span><span className="font-semibold text-right">{date ? `${format(new Date(date), 'dd MMM yyyy', { locale: th })}, ${time}` : 'N/A'}</span></div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block mb-1 text-sm font-medium">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                            <input name="fullName" value={formData.fullName} onChange={handleChange} required className="border rounded-lg px-3 py-2 w-full"/>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                            <input name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="border rounded-lg px-3 py-2 w-full"/>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">หมายเหตุเพิ่มเติม</label>
                            <textarea name="note" value={formData.note} onChange={handleChange} rows={2} className="border rounded-lg px-3 py-2 w-full"/>
                        </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                        {!showCoupon ? (
                            <button type="button" onClick={() => setShowCoupon(true)} className="w-full text-center text-sm font-semibold text-indigo-600 p-2 rounded-lg hover:bg-indigo-50">
                                ใช้คูปองส่วนลด
                            </button>
                        ) : (
                            <div>
                                <label className="block mb-1 text-sm font-medium">เลือกคูปอง</label>
                                <select value={selectedCouponId} onChange={(e) => setSelectedCouponId(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white" disabled={availableCoupons.length === 0}>
                                    <option value="">{availableCoupons.length > 0 ? 'ไม่ใช้คูปอง' : 'ไม่มีคูปองให้เลือก'}</option>
                                    {availableCoupons.map(coupon => <option key={coupon.id} value={coupon.id}>{coupon.name} (-{coupon.value}%)</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg max-w-md mx-auto">
                    <div className="flex justify-between items-center">
                        <button type="button" onClick={() => router.back()} className="text-gray-600 font-semibold py-3 px-4">
                            ย้อนกลับ
                        </button>
                        <div className="text-right">
                            <p className="text-gray-600 text-sm">ยอดชำระ</p>
                            <p className="text-2xl font-bold text-gray-800">฿{finalPrice.toLocaleString()}</p>
                        </div>
                        <button type="submit" className="bg-pink-500 text-white py-3 px-6 rounded-xl font-bold hover:bg-pink-600 disabled:bg-gray-300" disabled={isSubmitting || loading}>
                            {isSubmitting ? '...' : 'ยืนยัน'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

// The default export now wraps the main component in Suspense
export default function GeneralInfoPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">กำลังโหลดหน้า...</div>}>
            <GeneralInfoContent />
        </Suspense>
    );
}