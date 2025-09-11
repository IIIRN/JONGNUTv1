"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';

export default function EditCustomerPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    points: 0,
    userId: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            fullName: data.fullName || '',
            phone: data.phone || '',
            email: data.email || '',
            points: data.points || 0,
            userId: data.userId || ''
          });
        } else {
          showToast("ไม่พบข้อมูลลูกค้า", 'error');
          router.push('/customers');
        }
      } catch (error) {
        showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", 'error');
        router.push('/customers');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id, router, showToast]);

  // ฟังก์ชันคัดลอก User ID (LINE)
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('คัดลอก User ID แล้ว!', 'success');
    });
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, "customers", id);
      await updateDoc(docRef, {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        points: Number(formData.points),
        updatedAt: new Date()
      });
      showToast("อัปเดตข้อมูลลูกค้าสำเร็จ!", 'success');
      router.push('/customers');
    } catch (error) {
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/customers')}
            className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4"
          >
            ← กลับไปหน้าจัดการลูกค้า
          </button>
          <h1 className="text-3xl font-bold text-gray-800">แก้ไขข้อมูลลูกค้า</h1>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              {/* User ID (LINE) Section */}
              {formData.userId && (
                <div className="mb-4 flex items-center">
                  <span className="block text-sm font-medium text-gray-700 mr-2">LINE User ID</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(formData.userId)}
                    className="inline-flex items-center px-2 py-1 bg-green-50 hover:bg-green-100 rounded focus:outline-none"
                    title="คัดลอก LINE User ID"
                  >
                    {/* LINE Icon SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">
                      <rect width="48" height="48" rx="12" fill="#00C300"/>
                      <path fill="#fff" d="M24 13c-6.627 0-12 4.477-12 10 0 4.418 3.676 8.167 8.824 9.527.385.09.91.277.98.635.07.358.06.91.03 1.27l-.15 1.79c-.04.358.18.49.39.358l2.54-1.54c.27-.17.77-.24 1.09-.17C26.09 36.98 25.04 37 24 37c6.627 0 12-4.477 12-10s-5.373-10-12-10z"/>
                    </svg>
                    <span className="ml-2 text-xs font-mono text-green-700">{formData.userId}</span>
                  </button>
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                อีเมล
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                คะแนนสะสม
              </label>
              <input
                type="number"
                name="points"
                value={formData.points}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/customers')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}