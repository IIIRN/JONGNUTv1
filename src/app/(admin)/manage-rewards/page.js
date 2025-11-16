"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

export default function AdminRewardsPage() {
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rewardToDelete, setRewardToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    useEffect(() => {
        const fetchRewards = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'rewards'), orderBy('pointsRequired', 'asc'));
                const querySnapshot = await getDocs(q);
                setRewards(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching rewards: ", error);
                showToast("เกิดข้อผิดพลาดในการโหลดข้อมูลของรางวัล", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchRewards();
    }, []);

    const handleDelete = (reward) => {
        setRewardToDelete(reward);
    };

    const confirmDelete = async () => {
        if (!rewardToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'rewards', rewardToDelete.id));
            setRewards(prev => prev.filter(r => r.id !== rewardToDelete.id));
            showToast('ลบของรางวัลสำเร็จ!', 'success');
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsDeleting(false);
            setRewardToDelete(null);
        }
    };
    
    if (loading || profileLoading) return <div className="text-center mt-20">กำลังโหลดข้อมูลของรางวัล...</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <ConfirmationModal
                show={!!rewardToDelete}
                title="ยืนยันการลบ"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบของรางวัล "${rewardToDelete?.name}"?`}
                onConfirm={confirmDelete}
                onCancel={() => setRewardToDelete(null)}
                isProcessing={isDeleting}
            />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">จัดการของรางวัล</h1>
                <Link href="/manage-rewards/add" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
                  + เพิ่มของรางวัลใหม่
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rewards.map(reward => (
                    <div key={reward.id} className="bg-white rounded-lg shadow-md p-5 flex flex-col justify-between">
                        <div>
                            <h2 className="font-bold text-lg text-indigo-600">{reward.name}</h2>
                            <p className="text-sm text-gray-600 mt-2">{reward.description}</p>
                            <div className="mt-2">
                                <span className="text-sm text-purple-600 font-medium">
                                    {reward.discountType === 'percentage' ? `ส่วนลด ${reward.discountValue}%` : `ส่วนลด ${reward.discountValue} ${profile.currencySymbol}`}
                                </span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t">
                             <div className="flex justify-between items-center">
                                <p className="text-xl font-bold text-gray-800">{reward.pointsRequired} <span className="text-sm font-normal text-gray-500">คะแนน</span></p>
                                <button
                                    onClick={() => handleDelete(reward)}
                                    className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200"
                                >
                                    ลบ
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                 {rewards.length === 0 && <p className="col-span-full text-center text-gray-500">ยังไม่มีของรางวัลในระบบ</p>}
            </div>
        </div>
    );
}

