"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

export default function AddServicePage() {
  const [serviceType, setServiceType] = useState('single');
  const [formData, setFormData] = useState({
    serviceName: '',
    price: '',
    duration: '',
    imageUrl: '',
    details: '',
    completionNote: '',
    addOnServices: [],
    // สำหรับ multi-area
    basePrice: '',
    areas: []
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useProfile();

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

  const handleAddArea = () => {
    setFormData(prev => ({
      ...prev,
      areas: [...(prev.areas || []), { name: '', packages: [{ duration: '', price: '' }] }]
    }));
  };

  const handleRemoveArea = (idx) => {
    setFormData(prev => {
      const areas = [...(prev.areas || [])];
      areas.splice(idx, 1);
      return { ...prev, areas };
    });
  };

  const handleAreaChange = (areaIdx, field, value) => {
    setFormData(prev => {
      const areas = [...(prev.areas || [])];
      areas[areaIdx][field] = value;
      return { ...prev, areas };
    });
  };

  const handleAddPackage = (areaIdx) => {
    setFormData(prev => {
      const areas = [...(prev.areas || [])];
      areas[areaIdx].packages = [...(areas[areaIdx].packages || []), { duration: '', price: '' }];
      return { ...prev, areas };
    });
  };

  const handleRemovePackage = (areaIdx, pkgIdx) => {
    setFormData(prev => {
      const areas = [...(prev.areas || [])];
      areas[areaIdx].packages.splice(pkgIdx, 1);
      return { ...prev, areas };
    });
  };

  const handlePackageChange = (areaIdx, pkgIdx, field, value) => {
    setFormData(prev => {
      const areas = [...(prev.areas || [])];
      areas[areaIdx].packages[pkgIdx][field] = value;
      return { ...prev, areas };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (serviceType === 'single') {
      if (!formData.serviceName || !formData.price || !formData.duration) {
        showToast("กรุณากรอกชื่อบริการ ราคา และระยะเวลาให้ครบถ้วน", "error");
        return;
      }
    } else {
      if (!formData.serviceName || !formData.basePrice || !formData.areas?.length) {
        showToast("กรุณากรอกชื่อบริการ ราคาฐาน และพื้นที่บริการอย่างน้อย 1 พื้นที่", "error");
        return;
      }
      for (const area of formData.areas) {
        if (!area.name || !area.packages?.length) {
          showToast("กรุณากรอกชื่อพื้นที่และแพ็คเกจให้ครบถ้วน", "error");
          return;
        }
        for (const pkg of area.packages) {
          if (!pkg.duration || !pkg.price) {
            showToast("กรุณากรอกระยะเวลาและราคาในทุกแพ็คเกจ", "error");
            return;
          }
        }
      }
    }
    setLoading(true);
    try {
      const dataToSave = {
        serviceName: formData.serviceName,
        imageUrl: formData.imageUrl || '',
        details: formData.details || '',
        addOnServices: (formData.addOnServices || []).map(a => ({ ...a, price: Number(a.price) || 0, duration: Number(a.duration) || 0 })),
        serviceType,
        createdAt: serverTimestamp(),
      };

      // เพิ่ม completionNote เฉพาะเมื่อมีค่า
      if (formData.completionNote && formData.completionNote.trim()) {
        dataToSave.completionNote = formData.completionNote.trim();
      }

      if (serviceType === 'single') {
        dataToSave.price = Number(formData.price) || 0;
        dataToSave.duration = Number(formData.duration) || 0;
      } else {
        dataToSave.basePrice = Number(formData.basePrice) || 0;
        dataToSave.areas = formData.areas.map(area => ({
          name: area.name,
          packages: area.packages.map(pkg => ({
            duration: Number(pkg.duration) || 0,
            price: Number(pkg.price) || 0
          }))
        }));
      }

      await addDoc(collection(db, "services"), dataToSave);
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
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">เพิ่มบริการใหม่</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">ประเภทบริการ</label>
          <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full mt-1 p-2 border rounded-md">
            <option value="single">บริการเดี่ยว (ราคาและระยะเวลาคงที่)</option>
            <option value="multi-area">บริการหลายพื้นที่ (เลือกพื้นที่และแพ็คเกจ)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">ชื่อบริการ</label>
          <input name="serviceName" value={formData.serviceName} onChange={handleChange} placeholder="เช่น เลเซอร์" required className="w-full mt-1 p-2 border rounded-md" />
        </div>

        {serviceType === 'single' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ราคา ({profile.currencySymbol})</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="200" required className="w-full mt-1 p-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ระยะเวลา (นาที)</label>
                <input type="number" name="duration" value={formData.duration} onChange={handleChange} placeholder="60" required className="w-full mt-1 p-2 border rounded-md" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">ราคาฐานต่อพื้นที่ ({profile.currencySymbol})</label>
              <input type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} placeholder="15000" required className="w-full mt-1 p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">พื้นที่บริการ</label>
              {(formData.areas || []).map((area, areaIdx) => (
                <div key={areaIdx} className="border rounded-md p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <input
                      type="text"
                      placeholder="ชื่อพื้นที่ เช่น หน้าท้อง + เอว 2 ข้าง"
                      value={area.name}
                      onChange={e => handleAreaChange(areaIdx, 'name', e.target.value)}
                      className="flex-1 p-2 border rounded-md mr-2"
                      required
                    />
                    <button type="button" onClick={() => handleRemoveArea(areaIdx)} className="text-red-500 px-2">ลบพื้นที่</button>
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">แพ็คเกจ</label>
                    {area.packages.map((pkg, pkgIdx) => (
                      <div key={pkgIdx} className="flex items-center gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="ระยะเวลา (นาที)"
                          value={pkg.duration}
                          onChange={e => handlePackageChange(areaIdx, pkgIdx, 'duration', e.target.value)}
                          className="w-32 p-2 border rounded-md"
                          required
                        />
                        <input
                          type="number"
                          placeholder={`ราคา (${profile.currencySymbol})`}
                          value={pkg.price}
                          onChange={e => handlePackageChange(areaIdx, pkgIdx, 'price', e.target.value)}
                          className="w-32 p-2 border rounded-md"
                          required
                        />
                        <button type="button" onClick={() => handleRemovePackage(areaIdx, pkgIdx)} className="text-red-500 px-2">ลบ</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => handleAddPackage(areaIdx)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md">+ เพิ่มแพ็คเกจ</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddArea} className="bg-blue-200 text-blue-700 px-3 py-2 rounded-md">+ เพิ่มพื้นที่</button>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">URL รูปภาพ</label>
          <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://example.com/image.png" className="w-full mt-1 p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">รายละเอียดเพิ่มเติม</label>
          <textarea name="details" value={formData.details} onChange={handleChange} rows="3" placeholder="รายละเอียดบริการ เช่น ใช้ผลิตภัณฑ์อะไร ฯลฯ" className="w-full mt-1 p-2 border rounded-md"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">ข้อความหลังบริการเสร็จ</label>
          <textarea 
            name="completionNote" 
            value={formData.completionNote} 
            onChange={handleChange} 
            rows="2" 
            placeholder="ข้อความที่จะส่งให้ลูกค้าเมื่อบริการเสร็จสิ้น เช่น ขอบคุณที่ใช้บริการ แนะนำให้ดูแลผิวด้วย..." 
            className="w-full mt-1 p-2 border rounded-md"
           
          />
          <div className="text-xs text-gray-500 mt-1">{formData.completionNote.length}/200 ตัวอักษร</div>
        </div>
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

