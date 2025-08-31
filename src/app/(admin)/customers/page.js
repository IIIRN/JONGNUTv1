"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const filtered = customers.filter(c => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">ลูกค้าทั้งหมด</h1>
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-2">
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
                <th className="py-2 px-4 text-left">สร้างเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{c.name || '-'}</td>
                  <td className="py-2 px-4">{c.phone || '-'}</td>
                  <td className="py-2 px-4">{c.email || '-'}</td>
                  <td className="py-2 px-4 font-bold text-purple-700">{c.points ?? 0}</td>
                  <td className="py-2 px-4 text-xs text-gray-500">{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString("th-TH") : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
