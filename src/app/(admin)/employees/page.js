"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { fetchAllUsers, deleteUser } from '@/app/actions/userActions'; // [!code focus]

// Helper Component: StatusBadge (คงเดิม)
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

// [!code focus start]
// Helper Component: RoleBadge
const RoleBadge = ({ role }) => {
    const colorClasses = role === 'Admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>{role}</span>;
}
// [!code focus end]

export default function EmployeesListPage() {
  const [users, setUsers] = useState([]); // [!code focus]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // [!code focus start]
    const loadUsers = async () => {
        setLoading(true);
        const result = await fetchAllUsers();
        if (result.success) {
            setUsers(result.users);
        } else {
            console.error(result.error);
        }
        setLoading(false);
    };
    loadUsers();
    // [!code focus end]
  }, []);

  const handleDelete = async (userId, userName, role) => { // [!code focus]
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ "${userName}"?`)) {
      const result = await deleteUser(userId, role); // [!code focus]
      if (result.success) {
        setUsers(prev => prev.filter(user => user.id !== userId));
        alert("ลบข้อมูลผู้ใช้สำเร็จ!");
      } else {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
      }
    }
  };

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลผู้ใช้...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้ (พนักงาน/แอดมิน)</h1>
            <Link href="/register-staff" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
              เพิ่มผู้ใช้ใหม่
            </Link>
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ใช้</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ตำแหน่ง</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Link href={user.role === 'Employee' ? `/employees/${user.id}` : '#'} className={`flex items-center group ${user.role !== 'Employee' ? 'cursor-default' : ''}`}>
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <Image
                                            className="h-10 w-10 rounded-full object-cover"
                                            src={user.imageUrl || 'https://via.placeholder.com/150'}
                                            alt={`${user.firstName} ${user.lastName}`}
                                            width={40}
                                            height={40}
                                        />
                                    </div>
                                    <div className="ml-4">
                                        <div className={`text-sm font-medium text-gray-900 ${user.role === 'Employee' ? 'group-hover:text-indigo-600' : ''}`}>{user.firstName} {user.lastName}</div>
                                        <div className="text-sm text-gray-500">{user.phoneNumber}</div>
                                    </div>
                                </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><RoleBadge role={user.role} /></td>
                            <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={user.status} /></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <Link href={`/employees/edit/${user.id}`} className="text-indigo-600 hover:text-indigo-900">แก้ไข</Link>
                                <button onClick={() => handleDelete(user.id, `${user.firstName} ${user.lastName}`, user.role)} className="text-red-600 hover:text-red-900">ลบ</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
}