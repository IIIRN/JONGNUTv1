"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const CouponCard = ({ coupon }) => {
    const isUsed = coupon.used;
    return (
        <div className={`p-4 rounded-lg shadow-md relative overflow-hidden ${isUsed ? 'bg-gray-100' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'}`}>
            {isUsed && <div className="absolute inset-0 bg-white/70"></div>}
            <div className="relative z-10">
                <h3 className={`font-bold text-lg ${isUsed ? 'text-gray-500' : 'text-white'}`}>{coupon.name}</h3>
                <p className={`text-sm mt-1 ${isUsed ? 'text-gray-400' : 'text-purple-100'}`}>{coupon.description}</p>
                <div className="border-t border-dashed my-3 border-white/30"></div>
                <p className={`text-xs ${isUsed ? 'text-gray-400' : 'text-purple-200'}`}>
                    แลกเมื่อ: {format(coupon.redeemedAt.toDate(), 'dd MMM yyyy', { locale: th })}
                </p>
                 {isUsed && (
                    <p className="text-xs font-semibold text-gray-500">
                        ใช้ไปแล้ว
                    </p>
                )}
            </div>
        </div>
    );
};

export default function MyCouponsPage() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);

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

    if (loading || liffLoading) {
        return <div className="text-center p-10">กำลังโหลดคูปอง...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold mb-3">คูปองที่ใช้ได้</h2>
                {availableCoupons.length > 0 ? (
                    <div className="space-y-3">
                        {availableCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">คุณยังไม่มีคูปองที่ใช้ได้</p>
                )}
            </div>

            <div>
                <h2 className="text-xl font-bold mb-3">คูปองที่ใช้ไปแล้ว</h2>
                {usedCoupons.length > 0 ? (
                    <div className="space-y-3">
                        {usedCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">ยังไม่มีประวัติการใช้คูปอง</p>
                )}
            </div>
        </div>
    );
}