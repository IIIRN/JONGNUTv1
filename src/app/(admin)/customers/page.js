"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import { ConfirmationModal } from "@/app/components/common/NotificationComponent";
import { addCustomer, deleteCustomer } from "@/app/actions/customerActions";

export default function AdminCustomersPage() {
  // ฟังก์ชันคัดลอก userId
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('คัดลอก LINE User ID แล้ว!', 'success');
    });
  }
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    points: 0
  });
  const [formLoading, setFormLoading] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();


  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      setCustomers([]);
      showToast("เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) {
      showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "error");
      return;
    }
    setFormLoading(true);
    const result = await addCustomer(formData);
    if (result.success) {
      showToast(result.message, 'success');
      setShowAddForm(false);
      setFormData({ fullName: '', phone: '', email: '', points: 0 });
      fetchCustomers();
    } else {
      showToast(result.error, 'error');
    }
    setFormLoading(false);
  };

  const handleDeleteCustomer = (customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    const result = await deleteCustomer(customerToDelete.id);
    if (result.success) {
      showToast(result.message, 'success');
      fetchCustomers();
    } else {
      showToast(result.error, 'error');
    }
    setIsDeleting(false);
    setCustomerToDelete(null);
  };


  const filtered = customers.filter(c => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="container mx-auto p-4 md:p-8">
       <ConfirmationModal
          show={!!customerToDelete}
          title="ยืนยันการลบ"
          message={`คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้า "${customerToDelete?.fullName}"?`}
          onConfirm={confirmDeleteCustomer}
          onCancel={() => setCustomerToDelete(null)}
          isProcessing={isDeleting}
      />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ลูกค้าทั้งหมด</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
        >
          {showAddForm ? 'ปิดฟอร์ม' : '+ เพิ่มลูกค้า'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">เพิ่มลูกค้าใหม่</h2>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="fullName" value={formData.fullName} onChange={handleFormChange} placeholder="ชื่อ-นามสกุล" required className="p-2 border rounded-md" />
              <input name="phone" value={formData.phone} onChange={handleFormChange} placeholder="เบอร์โทรศัพท์" required className="p-2 border rounded-md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="email" name="email" value={formData.email} onChange={handleFormChange} placeholder="อีเมล" className="p-2 border rounded-md" />
              <input type="number" name="points" value={formData.points} onChange={handleFormChange} placeholder="คะแนนสะสม" className="p-2 border rounded-md" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-200 rounded-md">ยกเลิก</button>
              <button type="submit" disabled={formLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-400">
                {formLoading ? 'กำลังบันทึก...' : 'เพิ่มลูกค้า'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4">
        <input
          className="border rounded px-3 py-2 w-full md:w-80"
          placeholder="ค้นหาชื่อ, เบอร์, อีเมล"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <div className="text-center mt-20">กำลังโหลดข้อมูลลูกค้า...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center mt-20 text-gray-500">ไม่พบข้อมูลลูกค้า</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="py-2 px-4 text-left">ชื่อ</th>
                <th className="py-2 px-4 text-left">เบอร์โทร</th>
                <th className="py-2 px-4 text-left">อีเมล</th>
                <th className="py-2 px-4 text-left">แต้มสะสม</th>
                <th className="py-2 px-4 text-left">LINE</th>
                <th className="py-2 px-4 text-left">สร้างเมื่อ</th>
                <th className="py-2 px-4 text-left">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{c.fullName || '-'}</td>
                  <td className="py-2 px-4">{c.phone || '-'}</td>
                  <td className="py-2 px-4">{c.email || '-'}</td>
                  <td className="py-2 px-4 font-bold text-purple-700">{c.points ?? 0}</td>
                  <td className="py-2 px-4">
                    {c.userId ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(c.userId)}
                        className="inline-flex items-center px-2 py-1 bg-green-50 hover:bg-green-100 rounded focus:outline-none"
                        title="คัดลอก LINE User ID"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                          <rect width="48" height="48" rx="12" fill="#00C300"/>
                          <path fill="#fff" d="M24 13c-6.627 0-12 4.477-12 10 0 4.418 3.676 8.167 8.824 9.527.385.09.91.277.98.635.07.358.06.91.03 1.27l-.15 1.79c-.04.358.18.49.39.358l2.54-1.54c.27-.17.77-.24 1.09-.17C26.09 36.98 25.04 37 24 37c6.627 0 12-4.477 12-10s-5.373-10-12-10z"/>
                        </svg>
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-xs text-gray-500">{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString("th-TH") : '-'}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => router.push(`/customers/edit/${c.id}`)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold mr-2"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(c)}
                      className="text-red-600 hover:text-red-800 text-sm font-semibold"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

