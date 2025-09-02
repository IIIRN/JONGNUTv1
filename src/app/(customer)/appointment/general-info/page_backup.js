"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';

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
            if (liffLoading || !profile?.userId || !serviceId) return;
            try {
                const promises = [
                    getDoc(doc(db, "customers", profile.userId)),
                    getDoc(doc(db, 'services', serviceId)),
                    getDocs(query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false)))
                ];
                
                // เพิ่ม beautician fetch เฉพาะเมื่อไม่ใช่ auto-assign
                if (beauticianId && beauticianId !== 'auto-assign') {
                    promises.push(getDoc(doc(db, 'beauticians', beauticianId)));
                }

                const results = await Promise.all(promises);
                const [customerSnap, serviceSnap, couponsSnapshot, beauticianSnap] = results;

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.name || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (serviceSnap.exists()) setService(serviceSnap.data());
                
                // ตั้งค่า beautician
                if (beauticianId === 'auto-assign') {
                    setBeautician({ firstName: 'ระบบจัดให้', lastName: '', id: 'auto-assign' });
                } else if (beauticianSnap && beauticianSnap.exists()) {
                    setBeautician(beauticianSnap.data());
                }
                
                setAvailableCoupons(couponsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [liffLoading, profile?.userId, serviceId, beauticianId]);

    const { basePrice, addOnsTotal, totalPrice, finalPrice, discount } = useMemo(() => {
        if (!service) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, finalPrice: 0, discount: 0 };
        const base = service.price || 0;
        const addOns = (service.addOnServices || []).filter(a => addOns?.includes(a.name)).reduce((sum, a) => sum + (a.price || 0), 0);
        const total = base + addOns;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);
        const discountAmount = selectedCoupon ? (selectedCoupon.discountType === 'percentage' ? total * (selectedCoupon.discountValue / 100) : selectedCoupon.discountValue) : 0;
        return { basePrice: base, addOnsTotal: addOns, totalPrice: total, finalPrice: total - discountAmount, discount: discountAmount };
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
                date: date,
                time: time,
                serviceId: serviceId,
                beauticianId: beauticianId,
                appointmentInfo: {
                    beauticianId: beauticianId,
                    employeeId: beauticianId, // Keep employeeId for compatibility if needed
                    beauticianInfo: { firstName: beautician.firstName, lastName: beautician.lastName },
                    dateTime: new Date(`${date}T${time}`),
                    addOns: (service.addOnServices || []).filter(a => addOns?.includes(a.name)),
                    duration: (service.duration || 0) + (service.addOnServices || []).filter(a => addOns?.includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0),
                },
                paymentInfo: {
                    basePrice,
                    addOnsTotal,
                    originalPrice: totalPrice,
                    totalPrice: finalPrice,
                    discount: discount,
                    couponId: selectedCouponId || null,
                    couponName: availableCoupons.find(c => c.id === selectedCouponId)?.name || null,
                    paymentStatus: 'unpaid',
                },
                createdAt: serverTimestamp(),
            };

            // ใช้ฟังก์ชันที่มีการตรวจสอบคิวสูงสุด
            const result = await createAppointmentWithSlotCheck(appointmentData);
            
            if (!result.success) {
                alert(result.error);
                return;
            }

            const newAppointmentId = result.id;

            if (selectedCouponId) {
                await updateDoc(doc(db, 'customers', profile.userId, 'coupons', selectedCouponId), {
                    used: true,
                    usedAt: serverTimestamp(),
                    appointmentId: newAppointmentId
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
        <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-white p-4">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-pink-400 to-purple-500 p-6 text-white">
                    <h1 className="text-xl font-bold text-center">ข้อมูลการจอง</h1>
                    <div className="mt-4 space-y-2 text-sm">
                        <div>📅 วันที่: {format(new Date(date), 'dd MMMM yyyy', { locale: th })}</div>
                        <div>🕐 เวลา: {time}</div>
                        <div>💅 บริการ: {service?.serviceName}</div>
                        <div>👩‍💼 ช่าง: {beautician?.firstName} {beautician?.lastName}</div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">ชื่อ-นามสกุล *</label>
                        <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="กรอกชื่อ-นามสกุล"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">เบอร์โทรศัพท์ *</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="กรอกเบอร์โทรศัพท์"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">อีเมล</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="กรอกอีเมล (ไม่บังคับ)"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเหตุ</label>
                        <textarea
                            name="note"
                            value={formData.note}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                        />
                    </div>

                    {/* Coupon Section */}
                    {availableCoupons.length > 0 && (
                        <div className="border-t pt-4">
                            <button
                                type="button"
                                onClick={() => setShowCoupon(!showCoupon)}
                                className="flex items-center justify-between w-full text-left text-pink-600 font-semibold"
                            >
                                <span>🎫 ใช้คูปอง ({availableCoupons.length} ใบ)</span>
                                <span>{showCoupon ? '▼' : '▶'}</span>
                            </button>
                            
                            {showCoupon && (
                                <div className="mt-3 space-y-2">
                                    <div>
                                        <input
                                            type="radio"
                                            id="no-coupon"
                                            name="coupon"
                                            value=""
                                            checked={selectedCouponId === ''}
                                            onChange={(e) => setSelectedCouponId(e.target.value)}
                                            className="mr-2"
                                        />
                                        <label htmlFor="no-coupon" className="text-sm">ไม่ใช้คูปอง</label>
                                    </div>
                                    {availableCoupons.map(coupon => (
                                        <div key={coupon.id} className="border rounded-lg p-3">
                                            <input
                                                type="radio"
                                                id={coupon.id}
                                                name="coupon"
                                                value={coupon.id}
                                                checked={selectedCouponId === coupon.id}
                                                onChange={(e) => setSelectedCouponId(e.target.value)}
                                                className="mr-2"
                                            />
                                            <label htmlFor={coupon.id} className="text-sm">
                                                <div className="font-semibold">{coupon.name}</div>
                                                <div className="text-gray-600">
                                                    ลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue}฿`}
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price Summary */}
                    <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between">
                            <span>ราคาบริการ:</span>
                            <span>{basePrice.toLocaleString()}฿</span>
                        </div>
                        {addOnsTotal > 0 && (
                            <div className="flex justify-between">
                                <span>บริการเสริม:</span>
                                <span>{addOnsTotal.toLocaleString()}฿</span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>ส่วนลด:</span>
                                <span>-{discount.toLocaleString()}฿</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>ยอดรวม:</span>
                            <span>{finalPrice.toLocaleString()}฿</span>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-pink-400 to-purple-500 text-white py-4 rounded-lg font-bold text-lg shadow-lg hover:from-pink-500 hover:to-purple-600 disabled:bg-gray-400"
                    >
                        {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการจอง'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function GeneralInfoPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">กำลังโหลด...</div>}>
            <GeneralInfoContent />
        </Suspense>
    );
}
