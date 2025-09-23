
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useLiffContext } from '@/context/LiffProvider';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';
import CustomerHeader from '@/app/components/CustomerHeader';



const CouponCard = ({ coupon }) => {
    const isUsed = coupon.used;
    return (
        <div className={`relative overflow-hidden rounded-xl shadow p-3 mb-2 ${isUsed ? 'bg-gray-100' : 'bg-gradient-to-r from-purple-400 to-pink-300 text-white'}`}>
            {isUsed && <div className="absolute inset-0 bg-white/70 z-10 rounded-xl"></div>}
            <div className="relative z-20">
                <div className="flex justify-between items-center mb-1">
                    <h3 className={`font-bold text-base ${isUsed ? 'text-gray-500' : 'text-white'}`}>{coupon.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isUsed ? 'bg-gray-200 text-gray-500' : 'bg-white/30 text-white'}`}>{isUsed ? 'ใช้แล้ว' : 'ใช้ได้'}</span>
                </div>
                <p className={`text-xs ${isUsed ? 'text-gray-400' : 'text-white/90'}`}>{coupon.description}</p>
                <div className="border-t border-dashed my-2 border-white/30"></div>
                <div className="flex justify-between items-center">
                    <span className={`text-xs ${isUsed ? 'text-gray-400' : 'text-white/80'}`}>แลกเมื่อ: {coupon.redeemedAt ? format(coupon.redeemedAt.toDate(), 'dd MMM yyyy', { locale: th }) : '-'}</span>
                </div>
            </div>
        </div>
    );
};

export default function MyCouponsPage() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!liffLoading && profile?.userId) {
            const couponsRef = collection(db, 'customers', profile.userId, 'coupons');
            const q = query(couponsRef, orderBy('redeemedAt', 'desc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCoupons(couponsData);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching coupons:", error);
                setLoading(false);
            });

            return () => unsubscribe();
        } else if (!liffLoading) {
            setLoading(false);
        }
    }, [profile, liffLoading]);

    const availableCoupons = coupons.filter(c => !c.used);
    const usedCoupons = coupons.filter(c => c.used);

    return (
        <div>
            <CustomerHeader />
            <div className="min-h-screen bg-white flex flex-col items-center pt-3 px-1">
            {/* ปุ่มแลกคูปอง */}
            <div className="w-full px-4 flex justify-end mb-2">
                <button
                    className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-xl shadow text-sm transition-colors"
                    onClick={() => router.push('/rewards')}
                >
                    แลกคูปอง
                </button>
            </div>
            <div className="w-full px-4 space-y-2">
                {loading ? (
                    <div className="text-center text-gray-500 pt-6 text-sm">กำลังโหลดคูปอง...</div>
                ) : coupons.length === 0 ? (
                    <div className="text-center text-gray-500 pt-6 bg-white p-4 rounded-xl text-sm">
                        <p className="font-semibold">ยังไม่มีคูปอง</p>
                    </div>
                ) : (
                    <>
                        {availableCoupons.length > 0 && (
                            <div>
                                <h2 className="font-bold text-purple-700 mb-1 text-sm">คูปองที่ใช้ได้</h2>
                                <div className="space-y-2">
                                    {availableCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                </div>
                            </div>
                        )}
                        {usedCoupons.length > 0 && (
                            <div className="mt-3">
                                <h2 className="font-bold text-gray-400 mb-1 text-sm">คูปองที่ใช้ไปแล้ว</h2>
                                <div className="space-y-2">
                                    {usedCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            </div>
        </div>
    );
}