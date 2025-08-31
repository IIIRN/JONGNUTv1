"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { promoteEmployeeToAdmin } from '@/app/actions/employeeActions'; // [!code focus]

const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-gray-800 text-right">{value || '-'}</span>
    </div>
);

export default function EmployeeDetailPage() {
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPromoting, setIsPromoting] = useState(false); // [!code focus]
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    useEffect(() => {
        if (!id) return;
        const fetchEmployee = async () => {
            setLoading(true);
            const docRef = doc(db, 'employees', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setEmployee({ id: docSnap.id, ...docSnap.data() });
            } else {
                // If not found in employees, check if they are already an admin
                const adminRef = doc(db, 'admins', id);
                const adminSnap = await getDoc(adminRef);
                if(adminSnap.exists()){
                     alert("บุคคลนี้เป็น Admin อยู่แล้ว");
                     router.push('/employees'); // Redirect back to employee list
                } else {
                    alert("ไม่พบข้อมูลผู้ใช้");
                    router.push('/employees');
                }
            }
            setLoading(false);
        };
        fetchEmployee();
    }, [id, router]);

    // [!code focus start]
    const handlePromote = async () => {
        if (!employee) return;
        if (window.confirm(`คุณต้องการเลื่อนตำแหน่ง ${employee.firstName} เป็น Admin ใช่หรือไม่?`)) {
            setIsPromoting(true);
            const result = await promoteEmployeeToAdmin(employee.id);
            if (result.success) {
                alert('เลื่อนตำแหน่งสำเร็จ!');
                router.push('/employees');
            } else {
                alert(`เกิดข้อผิดพลาด: ${result.error}`);
                setIsPromoting(false);
            }
        }
    };
    // [!code focus end]


    if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
    if (!employee) return null;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="max-w-xl mx-auto bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col items-center">
                    <Image
                        className="h-24 w-24 rounded-full object-cover mb-4"
                        src={employee.imageUrl || 'https://via.placeholder.com/150'}
                        alt={`${employee.firstName} ${employee.lastName}`}
                        width={96}
                        height={96}
                    />
                    <h1 className="text-2xl font-bold text-gray-900">{employee.firstName} {employee.lastName}</h1>
                    <p className="text-gray-500">{employee.status}</p>
                </div>
                <div className="mt-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-2">ข้อมูลติดต่อ</h2>
                    <DetailRow label="เบอร์โทรศัพท์" value={employee.phoneNumber} />
                    <DetailRow label="LINE User ID" value={employee.lineUserId} />
                    <DetailRow label="Email" value={employee.email} />
                </div>
                 {/* [!code focus start] */}
                 <div className="mt-6 flex justify-end gap-4">
                    <button
                        onClick={handlePromote}
                        disabled={isPromoting}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                        {isPromoting ? 'กำลังดำเนินการ...' : 'เลื่อนตำแหน่งเป็น Admin'}
                    </button>
                    <Link href={`/employees/edit/${employee.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                        แก้ไขข้อมูล
                    </Link>
                </div>
                 {/* [!code focus end] */}
            </div>
        </div>
    );
}