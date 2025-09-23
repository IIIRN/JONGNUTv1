"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addReward } from '@/app/actions/rewardActions';
import { useProfile } from '@/context/ProfileProvider';

export default function AddRewardPage() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [pointsRequired, setPointsRequired] = useState('');
    const [discountType, setDiscountType] = useState('percentage');
    const [discountValue, setDiscountValue] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { profile } = useProfile();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const rewardData = {
            name,
            description,
            pointsRequired: Number(pointsRequired),
            discountType,
            discountValue: Number(discountValue),
        };
        
        const result = await addReward(rewardData);

        if (result.success) {
            alert('เพิ่มของรางวัลสำเร็จ!');
            router.push('/manage-rewards');
        } else {
            alert(`เกิดข้อผิดพลาด: ${result.error}`);
            setLoading(false);
        }
    };
    
    return (
         <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
            <h1 className="text-2xl font-bold mb-6">เพิ่มของรางวัลใหม่</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">ชื่อของรางวัล</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">คำอธิบาย</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" required className="w-full mt-1 p-2 border rounded-md"></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">คะแนนที่ใช้แลก</label>
                    <input type="number" value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} required className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">ประเภทส่วนลด</label>
                    <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white">
                        <option value="percentage">ส่วนลด (เปอร์เซ็นต์)</option>
                        <option value="fixed">ส่วนลด (จำนวนเต็ม)</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">
                        {discountType === 'percentage' ? 'เปอร์เซ็นต์ส่วนลด (เช่น 10 สำหรับ 10%)' : `จำนวนเงินส่วนลด (เช่น 50 สำหรับ 50 ${profile.currencySymbol})`}
                    </label>
                    <input 
                        type="number" 
                        value={discountValue} 
                        onChange={(e) => setDiscountValue(e.target.value)} 
                        required 
                        className="w-full mt-1 p-2 border rounded-md"
                        min="0"
                        max={discountType === 'percentage' ? '100' : undefined}
                    />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกของรางวัล'}
                </button>
            </form>
        </div>
    );
}