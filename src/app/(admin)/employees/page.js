"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { fetchEmployees, deleteEmployee, updateEmployeeStatus } from '@/app/actions/employeeActions';
import { auth, db } from '@/app/lib/firebase';  
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';

// Helper Component: StatusBadge
const StatusBadge = ({ status }) => {
    let text = '';
    let colorClasses = '';
    switch (status) {
        case 'available': text = 'พร้อมทำงาน'; colorClasses = 'bg-green-100 text-green-800'; break;
        case 'on_leave': text = 'ลาพัก'; colorClasses = 'bg-yellow-100 text-yellow-800'; break;
        case 'suspended': text = 'พักงาน'; colorClasses = 'bg-red-100 text-red-800'; break;
        default: text = status || 'ไม่ระบุ'; colorClasses = 'bg-gray-100 text-gray-700';
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>{text}</span>;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    lineUserId: '',
    role: 'employee',
    status: 'available'
  });
  const [formLoading, setFormLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const result = await fetchEmployees();
      if (result.success) {
        setEmployees(result.employees);
      } else {
        console.error(result.error);
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน', 'error');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานนี้?')) {
      try {
        const result = await deleteEmployee(employeeId);
        if (result.success) {
          showToast('ลบพนักงานสำเร็จ', 'success');
          loadEmployees();
        } else {
          showToast('เกิดข้อผิดพลาดในการลบพนักงาน', 'error');
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        showToast('เกิดข้อผิดพลาดในการลบพนักงาน', 'error');
      }
    }
  };

  const handleStatusChange = async (employeeId, newStatus) => {
    try {
      const result = await updateEmployeeStatus(employeeId, newStatus);
      if (result.success) {
        showToast('อัพเดทสถานะสำเร็จ', 'success');
        loadEmployees();
      } else {
        showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error');
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddEmployee = async (e) => {
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

      const targetCollection = formData.role === 'admin' ? 'admins' : 'employees';
      const dataToSave = {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phone,
        email: user.email,
        lineUserId: formData.lineUserId,
        status: formData.status,
        createdAt: serverTimestamp(),
      };

      if (formData.role === 'admin') {
        dataToSave.role = 'admin';
      }

      await setDoc(doc(db, targetCollection, user.uid), dataToSave);

      showToast(`เพิ่ม${formData.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}สำเร็จ!`, 'success');
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        password: '',
        lineUserId: '',
        role: 'employee',
        status: 'available'
      });
      setShowAddForm(false);
      loadEmployees();

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">จัดการพนักงาน</h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
        >
          <span>+</span>
          {showAddForm ? 'ปิดฟอร์ม' : 'เพิ่มพนักงาน'}
        </button>
      </div>

      {/* Add Employee Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">เพิ่มพนักงานใหม่</h2>
          <form onSubmit={handleAddEmployee} className="space-y-4">
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ตำแหน่ง</label>
                <select 
                  name="role" 
                  value={formData.role} 
                  onChange={handleFormChange} 
                  className="w-full mt-1 p-2 border rounded-md bg-white"
                >
                  <option value="employee">พนักงาน</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>
              </div>
              {formData.role === 'employee' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">สถานะ</label>
                  <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleFormChange} 
                    className="w-full mt-1 p-2 border rounded-md bg-white"
                  >
                    <option value="available">พร้อมทำงาน</option>
                    <option value="on_leave">ลาพัก</option>
                    <option value="suspended">พักงาน</option>
                  </select>
                </div>
              )}
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
                className="flex-1 bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {formLoading ? 'กำลังบันทึก...' : 'เพิ่มพนักงาน'}
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

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">พนักงาน</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ข้อมูลติดต่อ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {employee.photoURL ? (
                        <Image
                          className="h-10 w-10 rounded-full"
                          src={employee.photoURL}
                          alt="Profile"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {employee.firstName?.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{employee.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{employee.phoneNumber}</div>
                  {employee.lineUserId && (
                    <div className="text-sm text-gray-500">LINE: {employee.lineUserId}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select 
                    value={employee.status} 
                    onChange={(e) => handleStatusChange(employee.id, e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="available">พร้อมทำงาน</option>
                    <option value="on_leave">ลาพัก</option>
                    <option value="suspended">พักงาน</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => window.location.href = `/employees/edit/${employee.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      แก้ไข
                    </button>
                    <button 
                      onClick={() => handleDeleteEmployee(employee.id)}
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
        
        {employees.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">ยังไม่มีข้อมูลพนักงาน</p>
          </div>
        )}
      </div>
    </div>
  );
}
