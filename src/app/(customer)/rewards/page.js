"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore'; 
import { redeemReward } from '@/app/actions/rewardActions';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';

const RewardCard = ({ reward, userPoints, onRedeem, isRedeeming }) => {
    const { profile } = useProfile();
    const canRedeem = userPoints >= reward.pointsRequired;
    return (
        <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
            <div>
                <h3 className="font-bold text-indigo-600">{reward.name}</h3>
                <p className="text-sm text-gray-600">{reward.description}</p>
                <div className="text-sm text-purple-600 font-medium mt-1">
                    {reward.discountType === 'percentage' ? `ส่วนลด ${reward.discountValue}%` : `ส่วนลด ${reward.discountValue} ${profile.currencySymbol}`}
                </div>
                <p className="text-sm text-gray-500 mt-1">ใช้ {reward.pointsRequired} คะแนน</p>
            </div>
            <button
                onClick={() => onRedeem(reward.id)}
                disabled={!canRedeem || isRedeeming}
                className="bg-pink-500 text-white font-semibold px-4 py-2 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
                {isRedeeming ? '...' : 'แลก'}
            </button>
        </div>
    );
};

export default function RewardsPage() {
    const { profile: liffProfile, loading: liffLoading } = useLiffContext();
    const [customer, setCustomer] = useState(null);
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
    const [showModal, setShowModal] = useState(false);
    const [selectedRewardId, setSelectedRewardId] = useState(null);

    useEffect(() => {
        let unsubCustomer = () => {};
        if (liffProfile?.userId) {
            const customerRef = doc(db, "customers", liffProfile.userId);
            unsubCustomer = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) setCustomer(doc.data());
            });
        }
        return () => unsubCustomer();
    }, [liffProfile]);

    useEffect(() => {
        const fetchRewards = async () => {
            setLoading(true);
            const q = query(collection(db, 'rewards'), orderBy('pointsRequired'));
            const snapshot = await getDocs(q);
            setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        };
        fetchRewards();
    }, []);

    const handleRedeemClick = (rewardId) => {
        setSelectedRewardId(rewardId);
        setShowModal(true);
    };

    const handleConfirmRedeem = async () => {
        setShowModal(false);
        setIsRedeeming(true);
        const result = await redeemReward(liffProfile.userId, selectedRewardId);
        if (result.success) {
            setNotification({ show: true, title: "แลกสำเร็จ!", message: "คุณได้รับคูปองใหม่แล้ว", type: 'success' });
        } else {
            setNotification({ show: true, title: "เกิดข้อผิดพลาด", message: result.error, type: 'error' });
        }
        setIsRedeeming(false);
        setSelectedRewardId(null);
    };

    const handleCancelRedeem = () => {
        setShowModal(false);
        setSelectedRewardId(null);
    };
    
    if (loading || liffLoading) return <div className="text-center p-10">กำลังโหลด...</div>

    return (
        <div>
            <CustomerHeader />
            <div className="px-4 pb-4 space-y-6">
            <Notification {...notification} />
            <ConfirmationModal
                show={showModal}
                title="ยืนยันการแลกของรางวัล"
                message="คุณต้องการใช้คะแนนเพื่อแลกของรางวัลนี้ใช่หรือไม่?"
                onConfirm={handleConfirmRedeem}
                onCancel={handleCancelRedeem}
                isProcessing={isRedeeming}
            />
            <div className="bg-white p-5 rounded-lg shadow-md text-center">
                <p className="text-gray-500">คะแนนสะสมของคุณ</p>
                <p className="text-4xl font-bold text-purple-600">{customer?.points ?? 0}</p>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold">ของรางวัลทั้งหมด</h2>
                {rewards.length > 0 ? (
                    rewards.map(reward => (
                        <RewardCard 
                            key={reward.id} 
                            reward={reward} 
                            userPoints={customer?.points ?? 0}
                            onRedeem={handleRedeemClick}
                            isRedeeming={isRedeeming && selectedRewardId === reward.id}
                        />
                    ))
                ) : (
                    <p className="text-center text-gray-500">ยังไม่มีของรางวัลให้แลกในขณะนี้</p>
                )}
            </div>
            </div>
        </div>
    );
}