"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addReward } from '@/app/actions/rewardActions'; // Using server action

export default function AddRewardPage() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [pointsRequired, setPointsRequired] = useState('');
    const [type, setType] = useState('percentage_discount');
    const [value, setValue] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const rewardData = {
            name,
            description,
            pointsRequired: Number(pointsRequired),
            type,
            value: Number(value),
        };
        
        const result = await addReward(rewardData);

        if (result.success) {
            alert('เพิ่มของรางวัลสำเร็จ!');
            router.push('/manager/manage-rewards');
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
                    <label className="block text-sm font-medium text-gray-700">ประเภทของรางวัล</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white">
                        <option value="percentage_discount">ส่วนลด (เปอร์เซ็นต์)</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">มูลค่า (เช่น 10 สำหรับ 10%)</label>
                    <input type="number" value={value} onChange={(e) => setValue(e.target.value)} required className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกของรางวัล'}
                </button>
            </form>
        </div>
    );
}