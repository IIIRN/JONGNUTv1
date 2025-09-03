"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';


export default function AddServicePage() {
  const [formData, setFormData] = useState({
    serviceName: '',
    price: '',
    duration: '',
    imageUrl: '',
    details: '',
    addOnServices: []
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOnChange = (idx, field, value) => {
    setFormData(prev => {
      const addOnServices = [...(prev.addOnServices || [])];
      addOnServices[idx][field] = value;
      return { ...prev, addOnServices };
    });
  };

  const handleAddAddOn = () => {
    setFormData(prev => ({
      ...prev,
      addOnServices: [...(prev.addOnServices || []), { name: '', price: '', duration: '' }]
    }));
  };

  const handleRemoveAddOn = (idx) => {
    setFormData(prev => {
      const addOnServices = [...(prev.addOnServices || [])];
      addOnServices.splice(idx, 1);
      return { ...prev, addOnServices };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.serviceName || !formData.price || !formData.duration) {
      showToast("กรุณากรอกชื่อบริการ ราคา และระยะเวลาให้ครบถ้วน", "error");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "services"), {
        ...formData,
        price: Number(formData.price) || 0,
        duration: Number(formData.duration) || 0,
        addOnServices: (formData.addOnServices || []).map(a => ({ ...a, price: Number(a.price) || 0, duration: Number(a.duration) || 0 })),
        createdAt: serverTimestamp(),
      });
      showToast("เพิ่มบริการใหม่สำเร็จ!", "success");
      router.push('/services');
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">เพิ่มบริการใหม่</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">ชื่อบริการ</label>
          <input name="serviceName" value={formData.serviceName} onChange={handleChange} placeholder="เช่น ตัดผมชาย" required className="w-full mt-1 p-2 border rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ราคา (บาท)</label>
            <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="200" required className="w-full mt-1 p-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ระยะเวลา (นาที)</label>
            <input type="number" name="duration" value={formData.duration} onChange={handleChange} placeholder="60" required className="w-full mt-1 p-2 border rounded-md" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">URL รูปภาพ</label>
          <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://example.com/image.png" className="w-full mt-1 p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">รายละเอียดเพิ่มเติม</label>
          <textarea name="details" value={formData.details} onChange={handleChange} rows="3" placeholder="รายละเอียดบริการ เช่น ใช้ผลิตภัณฑ์อะไร ฯลฯ" className="w-full mt-1 p-2 border rounded-md"></textarea>
        </div>
        {/* Add-on services section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">บริการเสริม</label>
          {(formData.addOnServices || []).map((addOn, idx) => (
            <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="ชื่อบริการเสริม"
                value={addOn.name}
                onChange={e => handleAddOnChange(idx, 'name', e.target.value)}
                className="flex-1 p-2 border rounded-md"
              />
              <input
                type="number"
                placeholder="ราคา"
                value={addOn.price}
                onChange={e => handleAddOnChange(idx, 'price', e.target.value)}
                className="w-28 p-2 border rounded-md"
              />
              <input
                type="number"
                placeholder="ระยะเวลา (นาที)"
                value={addOn.duration}
                onChange={e => handleAddOnChange(idx, 'duration', e.target.value)}
                className="w-32 p-2 border rounded-md"
              />
              <button type="button" onClick={() => handleRemoveAddOn(idx)} className="text-red-500 px-2">ลบ</button>
            </div>
          ))}
          <button type="button" onClick={handleAddAddOn} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md mt-2">+ เพิ่มบริการเสริม</button>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
          {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริการ'}
        </button>
      </form>
    </div>
  );
}