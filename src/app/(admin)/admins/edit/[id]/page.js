"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { updateAdmin } from '@/app/actions/adminActions';
import { useToast } from '@/app/components/Toast';

export default function EditAdminPage() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminData, setAdminData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    lineUserId: ''
  });

  useEffect(() => {
    if (params.id) {
      loadAdminData();
    }
  }, [params.id]);

  const loadAdminData = async () => {
    try {
      const adminRef = doc(db, 'admins', params.id);
      const adminSnap = await getDoc(adminRef);
      
      if (adminSnap.exists()) {
        const data = adminSnap.data();
        setAdminData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          lineUserId: data.lineUserId || ''
        });
      } else {
        showToast('ไม่พบข้อมูลผู้ดูแลระบบ', 'error');
        router.push('/admins');
      }
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
      router.push('/admins');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAdminData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!adminData.firstName || !adminData.phoneNumber || !adminData.email) {
      showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
      return;
    }

    setSaving(true);
    
    try {
      const updateData = {
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        phoneNumber: adminData.phoneNumber,
        lineUserId: adminData.lineUserId
      };

      const result = await updateAdmin(params.id, updateData);
      
      if (result.success) {
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
        router.push('/admins');
      } else {
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
      }
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/admins')}
            className="flex items-center text-purple-600 hover:text-purple-800 mb-4"
          >
            ← กลับไปหน้าจัดการผู้ดูแลระบบ
          </button>
          <h1 className="text-3xl font-bold text-gray-800">แก้ไขข้อมูลผู้ดูแลระบบ</h1>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อจริง <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={adminData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  นามสกุล
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={adminData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={adminData.phoneNumber}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                อีเมล <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={adminData.email}
                onChange={handleInputChange}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                title="ไม่สามารถแก้ไขอีเมลได้"
              />
              <p className="text-sm text-gray-500 mt-1">* ไม่สามารถแก้ไขอีเมลได้</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LINE User ID
              </label>
              <input
                type="text"
                name="lineUserId"
                value={adminData.lineUserId}
                onChange={handleInputChange}
                placeholder="U12345..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
              
              <button
                type="button"
                onClick={() => router.push('/admins')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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
