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

    const { basePrice, addOnsTotal, totalPrice, discount, finalPrice } = useMemo(() => {
        if (!service) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, discount: 0, finalPrice: 0 };
        const basePrice = Number(service.price) || 0;
        const addOnsTotal = (service.addOnServices || []).filter(a => addOns?.split(',').includes(a.name)).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
        const currentTotalPrice = basePrice + addOnsTotal;
        let currentDiscount = 0;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);
        if (selectedCoupon?.type === 'percentage_discount') {
            currentDiscount = (currentTotalPrice * selectedCoupon.value) / 100;
        }
        return {
            basePrice,
            addOnsTotal,
            totalPrice: currentTotalPrice,
            discount: currentDiscount,
            finalPrice: currentTotalPrice - currentDiscount
        };
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
        <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto flex flex-col justify-between">
            <div className="bg-white/90 rounded-2xl shadow-lg p-5 mb-4 space-y-3">
                <div className="flex items-center justify-between text-[15px] text-purple-700 font-semibold">
                    <span>วันที่</span>
                    <span className="font-bold text-[16px]">{date ? format(new Date(date), 'd/M/yyyy', { locale: th }) : '-'}</span>
                    <span>เวลา</span>
                    <span className="font-bold text-[16px]">{time ? `${time} น.` : '-'}</span>
                </div>
                <div className="border-b border-purple-100 my-2" />
                <div className="grid grid-cols-2 gap-y-1 text-[15px]">
                    <span className="text-gray-500">บริการ</span>
                    <span className="text-right text-purple-700 font-semibold">{service?.serviceName || '-'}</span>
                    <span className="text-gray-500">ระยะเวลา</span>
                    <span className="text-right">{service?.duration || '-'} นาที</span>
                    <span className="text-gray-500">ราคา</span>
                    <span className="text-right">{service?.price?.toLocaleString() || '-'}</span>
                </div>
                {addOns && service?.addOnServices && service.addOnServices.filter(a => addOns.split(',').includes(a.name)).length > 0 && (
                    <div className="mt-2">
                        <div className="text-purple-700 font-semibold mb-1">บริการเสริม</div>
                        <div className="space-y-1">
                            {service.addOnServices.filter(a => addOns.split(',').includes(a.name)).map(a => (
                                <div key={a.name} className="flex justify-between text-[15px]">
                                    <span>{a.name}</span>
                                    <span className="text-gray-500">{a.duration} นาที | {a.price?.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="mt-2">
                    <label className="block text-purple-700 font-semibold mb-1 text-[15px]">ใช้คูปอง</label>
                    <select
                        value={selectedCouponId}
                        onChange={e => setSelectedCouponId(e.target.value)}
                        className="w-full border border-purple-200 rounded-lg px-3 py-2 text-[15px] focus:ring-2 focus:ring-pink-200 bg-white"
                        disabled={availableCoupons.length === 0}
                    >
                        <option value="">{availableCoupons.length > 0 ? 'ไม่ใช้คูปอง' : 'ไม่มีคูปองให้เลือก'}</option>
                        {availableCoupons.map(coupon => (
                            <option key={coupon.id} value={coupon.id}>{coupon.name} (-{coupon.value}%)</option>
                        ))}
                    </select>
                </div>
                {selectedCouponId && (
                    <div className="flex justify-between items-center mt-2 text-[15px]">
                        <span className="text-purple-700 font-semibold">คูปอง</span>
                        <span className="text-right">{availableCoupons.find(c => c.id === selectedCouponId)?.name || '-'}</span>
                    </div>
                )}
                <div className="flex justify-between items-center mt-2 text-[15px]">
                    <span className="font-bold text-purple-700">รวม</span>
                    <span className="text-right font-bold">{service ? ((service.duration || 0) + (service.addOnServices || []).filter(a => addOns?.split(',').includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0)) : 0} นาที | {finalPrice.toLocaleString()} ฿</span>
                </div>
                <div className="flex justify-between items-center mt-2 text-[15px]">
                    <span className="text-purple-700 font-semibold">พนักงาน</span>
                    <span className="text-right">{beautician ? beautician.firstName : '-'}</span>
                </div>
                <div className="border-b border-purple-100 my-2" />
                <div className="space-y-2 mt-2">
                    <div className="bg-white rounded-xl border border-purple-100 p-4">
                        <div className="mb-2">
                            <label className="block text-gray-500 text-[15px] mb-1" htmlFor="fullName">ชื่อ-สกุล <span className="text-red-500">*</span></label>
                            <input
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-[15px] focus:ring-2 focus:ring-pink-200 bg-white"
                                placeholder="กรอกชื่อ-นามสกุล"
                            />
                        </div>
                        <div className="mb-2">
                            <label className="block text-gray-500 text-[15px] mb-1" htmlFor="phone">เบอร์ติดต่อ <span className="text-red-500">*</span></label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-[15px] focus:ring-2 focus:ring-pink-200 bg-white"
                                placeholder="เบอร์โทรศัพท์"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-500 text-[15px] mb-1" htmlFor="email">อีเมล <span className="text-gray-400">(ถ้ามี)</span></label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-[15px] focus:ring-2 focus:ring-pink-200 bg-white"
                                placeholder="อีเมล (ถ้ามี)"
                            />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-purple-100 p-4">
                        <label className="block text-gray-500 text-[15px] mb-1" htmlFor="note">เพิ่มเติม</label>
                        <textarea
                            id="note"
                            name="note"
                            value={formData.note}
                            onChange={handleChange}
                            rows={2}
                            className="w-full border border-purple-200 rounded-lg px-3 py-2 text-[15px] focus:ring-2 focus:ring-pink-200 bg-white"
                            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                        />
                    </div>
                </div>
            </div>
            <button type="submit" className="w-full bg-gradient-to-tr from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg mb-2 transition-colors disabled:bg-gray-300 disabled:text-gray-400" disabled={isSubmitting || loading}>
                {isSubmitting ? '...' : 'ยืนยันการนัดหมาย'}
            </button>
        </form>
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