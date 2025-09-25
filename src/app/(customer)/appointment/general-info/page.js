"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/common/Toast';

function GeneralInfoContent() {
    const searchParams = useSearchParams();
    const { profile, loading: liffLoading } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const router = useRouter();
    const { showToast, ToastComponent } = useToast();

    const serviceId = searchParams.get('serviceId');
    const addOnsParam = searchParams.get('addOns');
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

    const selectedAddOns = addOnsParam ? addOnsParam.split(',') : [];

    useEffect(() => {
        const fetchAllData = async () => {
            if (liffLoading || !profile?.userId || !serviceId) return;
            try {
                const promises = [
                    getDoc(doc(db, "customers", profile.userId)),
                    getDoc(doc(db, 'services', serviceId)),
                    getDocs(query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false)))
                ];
                
                if (beauticianId && beauticianId !== 'auto-assign') {
                    promises.push(getDoc(doc(db, 'beauticians', beauticianId)));
                }

                const results = await Promise.all(promises);
                const [customerSnap, serviceSnap, couponsSnapshot, beauticianSnap] = results;

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.fullName || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (serviceSnap.exists()) setService(serviceSnap.data());
                
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
        const addOnsPrice = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.price || 0), 0);
        const total = base + addOnsPrice;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);
        
        let discountAmount = 0;
        if (selectedCoupon) {
            discountAmount = selectedCoupon.discountType === 'percentage' ? Math.round(total * (selectedCoupon.discountValue / 100)) : selectedCoupon.discountValue;
            discountAmount = Math.min(discountAmount, total);
        }

        return { basePrice: base, addOnsTotal: addOnsPrice, totalPrice: total, finalPrice: Math.max(0, total - discountAmount), discount: discountAmount };
    }, [service, selectedAddOns, selectedCouponId, availableCoupons]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone) {
            showToast("กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์", "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        if (liffLoading || !profile?.userId) {
            showToast('กรุณาเข้าสู่ระบบก่อนทำการจอง', "warning", "ต้องเข้าสู่ระบบ");
            return;
        }

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
                    employeeId: beauticianId,
                    beauticianInfo: { firstName: beautician?.firstName, lastName: beautician?.lastName },
                    dateTime: new Date(`${date}T${time}`),
                    addOns: (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)),
                    duration: (service.duration || 0) + (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0),
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
            };

            const result = await createAppointmentWithSlotCheck(appointmentData);
            
            if (!result.success) {
                showToast(result.error, "error", "เกิดข้อผิดพลาด");
                setIsSubmitting(false);
                return;
            }

            const newAppointmentId = result.id;

            if (selectedCouponId) {
                await updateDoc(doc(db, 'customers', profile.userId, 'coupons', selectedCouponId), {
                    used: true,
                    usedAt: new Date(),
                    appointmentId: newAppointmentId
                });
            }

            showToast('จองสำเร็จ! กำลังพาไปหน้านัดหมาย', "success", "จองสำเร็จ");
            setTimeout(() => {
                router.push('/my-appointments');
            }, 1500);

        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง', "error", "เกิดข้อผิดพลาด");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center">กำลังโหลดข้อมูล...</div>;
    }

    return (
        <div>
            <ToastComponent />
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="px-4 pb-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                    <div className="p-4 border-b border-gray-100  text-black">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">วันที่</span>
                            <span className="text-sm font-semibold ">{date ? format(new Date(date), 'dd/MM/yyyy', { locale: th }) : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium ">เวลา</span>
                            <span className="text-sm font-semibold">{time} น.</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">พนักงาน</span>
                            <span className="text-sm font-semibold">{beautician?.firstName === 'ระบบจัดให้' ? '-' : beautician?.firstName}</span>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-100  text-black">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">บริการ</span>
                            <div className="text-right">
                                <div className="text-sm font-semibold">{service?.serviceName}</div>
                                <div className="text-sm text-gray-500">{service?.duration}นาที | {basePrice.toLocaleString()}</div>
                            </div>
                        </div>

                        {selectedAddOns.length > 0 && (
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-primary">บริการเสริม</span>
                                <div className="text-right">
                                    <div className="text-sm font-semibold">
                                        {(service.addOnServices || [])
                                            .filter(a => selectedAddOns.includes(a.name))
                                            .map(a => a.name).join(', ')
                                        }
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {(service.addOnServices || [])
                                            .filter(a => selectedAddOns.includes(a.name))
                                            .reduce((sum, a) => sum + (a.duration || 0), 0)
                                        }นาที | {addOnsTotal.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {availableCoupons.length > 0 && (
                        <div className="p-4 border-b border-gray-100 ">
                            <button
                                type="button"
                                onClick={() => setShowCoupon(!showCoupon)}
                                className="flex items-center justify-between w-full text-left text-primary font-medium"
                            >
                                <span>ใช้คูปอง ({availableCoupons.length} ใบ)</span>
                                <span>{showCoupon ? '▼' : '▶'}</span>
                            </button>

                            {showCoupon && (
                                <div className="space-y-2 mt-3">
                                    <div className="bg-gray-50 text-primary rounded-lg p-3">
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
                                        <div key={coupon.id} className="bg-gray-50 text-primary rounded-lg p-3">
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
                                                <div className="font-medium">{coupon.name}</div>
                                                <div className="text-gray-500">
                                                    ลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue}${shopProfile.currencySymbol || '฿'}`}
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-black font-semibold">รวม</span>
                            <div className="text-right">
                                <div className="text-black font-bold">
                                    {(service?.duration || 0) + (service.addOnServices || [])
                                        .filter(a => selectedAddOns.includes(a.name))
                                        .reduce((sum, a) => sum + (a.duration || 0), 0)
                                    }นาที | {finalPrice.toLocaleString()} {shopProfile.currencySymbol || '฿'}
                                </div>
                                {discount > 0 && (
                                    <div className="text-sm text-green-600">ส่วนลด -{discount.toLocaleString()} {shopProfile.currencySymbol || '฿'}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white text-black rounded-2xl p-4 mb-4 shadow-sm  border border-gray-100">
                    <label className="block text-md text-center font-medium text-gray-700 mb-4">ข้อมูลลูกค้า</label>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className='flex items-center'>
                            <label className="w-24 block text-sm font-medium text-gray-700">ชื่อ-สกุล</label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                            />
                        </div>

                        <div className='flex items-center'>
                            <label className="w-24 block text-sm font-medium text-gray-700">เบอร์ติดต่อ</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent placeholder-gray-500"
                                required
                            />
                        </div>

                        <div className='flex items-center'>
                            <label className="w-24 block text-sm font-medium text-gray-700">อีเมล</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent placeholder-gray-500"

                            />
                        </div>

                        <div className='flex items-center'>
                            <label className="w-24 block text-sm font-medium text-gray-700">เพิ่มเติม</label>
                            <textarea
                                name="note"
                                value={formData.note}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none placeholder-gray-500"

                            />
                        </div>
                    </form>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-semibold text-lg shadow-lg disabled:opacity-50"
                >
                    {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการนัดหมาย'}
                </button>
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