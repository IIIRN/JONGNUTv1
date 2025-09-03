"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { fetchAdmins, deleteAdmin } from '@/app/actions/adminActions';
import { auth, db } from '@/app/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';

export default function AdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    lineUserId: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const { showToast } = useToast();
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const result = await fetchAdmins();
      if (result.success) {
        setAdmins(result.admins);
      } else {
        console.error(result.error);
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ดูแลระบบ', 'error');
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ดูแลระบบ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = (admin) => {
    setAdminToDelete(admin);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteAdmin(adminToDelete.id);
      if (result.success) {
        showToast('ลบผู้ดูแลระบบสำเร็จ', 'success');
        loadAdmins();
      } else {
        showToast('เกิดข้อผิดพลาดในการลบผู้ดูแลระบบ', 'error');
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      showToast('เกิดข้อผิดพลาดในการลบผู้ดูแลระบบ', 'error');
    } finally {
      setIsDeleting(false);
      setAdminToDelete(null);
    }
  };


  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.phone || !formData.email || !formData.password) {
        showToast("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", 'error');
        return;
    }
    if (formData.password.length < 6) {
        showToast("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", 'error');
        return;
    }
    
    setFormLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`.trim(),
      });

      const dataToSave = {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phone,
        email: user.email,
        lineUserId: formData.lineUserId,
        role: 'admin',
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'admins', user.uid), dataToSave);

      showToast('เพิ่มผู้ดูแลระบบสำเร็จ!', 'success');
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        password: '',
        lineUserId: ''
      });
      setShowAddForm(false);
      loadAdmins();

    } catch (error) {
      let errorMessage = "เกิดข้อผิดพลาดที่ไม่รู้จักในการลงทะเบียน";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "รหัสผ่านไม่ปลอดภัย (ต้องมีอย่างน้อย 6 ตัวอักษร)";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
      }
      showToast(errorMessage, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ConfirmationModal
          show={!!adminToDelete}
          title="ยืนยันการลบ"
          message={`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ดูแลระบบ "${adminToDelete?.firstName}"?`}
          onConfirm={confirmDeleteAdmin}
          onCancel={() => setAdminToDelete(null)}
          isProcessing={isDeleting}
      />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">จัดการผู้ดูแลระบบ</h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
        >
          <span>+</span>
          {showAddForm ? 'ปิดฟอร์ม' : 'เพิ่มผู้ดูแลระบบ'}
        </button>
      </div>

      {/* Add Admin Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">เพิ่มผู้ดูแลระบบใหม่</h2>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                <input 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleFormChange} 
                  required 
                  className="w-full mt-1 p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                <input 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleFormChange} 
                  className="w-full mt-1 p-2 border rounded-md"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
              <input 
                type="tel" 
                name="phone" 
                value={formData.phone} 
                onChange={handleFormChange} 
                required 
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">อีเมล (สำหรับเข้าระบบ)</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleFormChange} 
                required 
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                onChange={handleFormChange} 
                required 
                placeholder="อย่างน้อย 6 ตัวอักษร" 
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">LINE User ID (ถ้ามี)</label>
              <input 
                name="lineUserId" 
                value={formData.lineUserId} 
                onChange={handleFormChange} 
                placeholder="U12345..." 
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            
            <div className="flex gap-2">
              <button 
                type="submit" 
                disabled={formLoading} 
                className="flex-1 bg-purple-600 text-white p-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {formLoading ? 'กำลังบันทึก...' : 'เพิ่มผู้ดูแลระบบ'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admins Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้ดูแลระบบ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ข้อมูลติดต่อ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่สร้าง</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {admin.photoURL ? (
                        <Image
                          className="h-10 w-10 rounded-full"
                          src={admin.photoURL}
                          alt="Profile"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-700">
                            {admin.firstName?.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {admin.firstName} {admin.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{admin.email}</div>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        ผู้ดูแลระบบ
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{admin.phoneNumber}</div>
                  {admin.lineUserId && (
                    <div className="text-sm text-gray-500">LINE: {admin.lineUserId}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {admin.createdAt ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString('th-TH') : 'ไม่ระบุ'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => window.location.href = `/admins/edit/${admin.id}`}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      แก้ไข
                    </button>
                    <button 
                      onClick={() => handleDeleteAdmin(admin)}
                      className="text-red-600 hover:text-red-900"
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {admins.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">ยังไม่มีข้อมูลผู้ดูแลระบบ</p>
          </div>
        )}
      </div>
    </div>
  );
}