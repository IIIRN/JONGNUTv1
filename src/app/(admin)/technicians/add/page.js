"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useToast } from '@/app/components/Toast';

export default function AddTechnicianPage() {
  const [formData, setFormData] = useState({ 
      firstName: '', 
      lastName: '', 
      phoneNumber: '', 
      lineUserId: '',
      imageUrl: '',
      status: 'available'
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.firstName || !formData.phoneNumber) {
      showToast("กรุณากรอกชื่อ และเบอร์โทร", "error");
      setLoading(false);
      return;
    }
    try {
      await addDoc(collection(db, "technicians"), {
        ...formData,
        createdAt: serverTimestamp(),
      });
      showToast("เพิ่มช่างใหม่สำเร็จ!", "success");
      router.push('/technicians');
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">เพิ่มช่างใหม่</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                        <input type="text" name="firstName"  value={formData.firstName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                        <input type="text" name="lastName"  value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" name="phoneNumber"  value={formData.phoneNumber} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
            <label className="block text-sm font-medium text-gray-700">สถานะ</label>
            <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
              <option value="available">พร้อมให้บริการ</option>
              <option value="on_job">กำลังให้บริการ</option>
              <option value="unavailable">ไม่พร้อมให้บริการ</option>
              <option value="suspended">พักงาน</option>
            </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">LINE User ID (ถ้ามี)</label>
                    <input type="text" name="lineUserId" placeholder="U12345..." value={formData.lineUserId} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">URL รูปภาพ (ถ้ามี)</label>
                    <input type="url" name="imageUrl" placeholder="https://example.com/photo.jpg" value={formData.imageUrl} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white p-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
            </form>
        </div>
    </div>
  );
}

