"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

// --- Helper Components ---
const StatusButton = ({ status }) => {
    let text, colorClasses;
    switch (status) {
        case 'available':
            text = 'ให้บริการ';
            colorClasses = 'bg-green-500 hover:bg-green-600';
            break;
        case 'unavailable':
            text = 'งดให้บริการ';
            colorClasses = 'bg-red-500 hover:bg-red-600';
            break;
        default:
            text = 'ไม่ระบุ';
            colorClasses = 'bg-gray-400';
    }
    return <button className={`text-xs text-white font-semibold py-1 px-3 rounded-md ${colorClasses}`}>{text}</button>;
};

// --- Helpers ---
const safeDate = (d) => {
  if (!d) return null;
  if (d?.toDate && typeof d.toDate === 'function') return d.toDate();
  if (typeof d === 'string' || typeof d === 'number') return new Date(d);
  if (d instanceof Date) return d;
  return null;
};

const formatPrice = (v) => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return v.toLocaleString();
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
};

const formatServicePrice = (service, profile) => {
  if (service.serviceType === 'multi-area') {
    const basePrice = service.basePrice || 0;
    const minPrice = Math.min(...service.areas?.flatMap(area => area.packages?.map(pkg => pkg.price) || []) || [0]);
    const maxPrice = Math.max(...service.areas?.flatMap(area => area.packages?.map(pkg => pkg.price) || []) || [0]);
    if (minPrice === maxPrice) {
      return `${formatPrice(minPrice)} ${profile.currencySymbol}`;
    }
    return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)} ${profile.currencySymbol}`;
  }
  return `${formatPrice(service.price)} ${profile.currencySymbol}`;
};

export default function ServicesListPage() {
  const [allServices, setAllServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();
  const { profile, loading: profileLoading } = useProfile();

    // อัพเดทสถานะบริการ
    const handleUpdateStatus = async (service) => {
      if (!service?.id) return;
      const newStatus = service.status === 'available' ? 'unavailable' : 'available';
      setStatusUpdatingId(service.id);
      try {
        await updateDoc(doc(db, 'services', service.id), { status: newStatus });
        setAllServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
        setFilteredServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
        showToast(`อัพเดทสถานะบริการเป็น "${newStatus === 'available' ? 'ให้บริการ' : 'งดให้บริการ'}" สำเร็จ!`, 'success');
      } catch (err) {
        console.error('Error updating status:', err);
        showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error');
      } finally {
        setStatusUpdatingId(null);
      }
    };
  const handleDeleteService = (service) => {
    setServiceToDelete(service);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'services', serviceToDelete.id));
      setAllServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      setFilteredServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      showToast('ลบข้อมูลบริการสำเร็จ!', 'success');
    } catch (error) {
      console.error('Error removing document: ', error);
      showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    } finally {
        setIsDeleting(false);
        setServiceToDelete(null);
    }
  };

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const servicesQuery = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(servicesQuery);
        const servicesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllServices(servicesData);
        setFilteredServices(servicesData);
      } catch (err) {
        console.error("Error fetching services: ", err);
        showToast("ไม่สามารถโหลดข้อมูลบริการได้", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  if (loading || profileLoading) return <div className="text-center mt-20">กำลังโหลดข้อมูลบริการ...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
        <ConfirmationModal
            show={!!serviceToDelete}
            title="ยืนยันการลบ"
            message={`คุณแน่ใจหรือไม่ว่าต้องการลบบริการ "${serviceToDelete?.serviceName || serviceToDelete?.name}"?`}
            onConfirm={confirmDeleteService}
            onCancel={() => setServiceToDelete(null)}
            isProcessing={isDeleting}
        />
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800">จัดการข้อมูลบริการ</h1>
        <Link href="/services/add" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
          เพิ่มบริการ
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map(service => (
              <div key={service.id} className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between">
                  <div>
                      <div className="relative w-full h-40 mb-3">
                                  <Image src={service.imageUrl || '/placeholder.png'} alt={service.serviceName || service.name || 'service'} fill style={{ objectFit: 'cover' }} className="rounded-md" />
                      </div>
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="font-bold text-lg text-gray-800">{service.serviceName || service.name}</p>
                              <p className="text-xs text-gray-400">{service.category}</p>
                          </div>
                          <div className="text-sm font-semibold bg-blue-500 text-white px-3 py-1 rounded">{formatServicePrice(service, profile)}</div>
                      </div>
                      <div className="text-sm text-gray-600 mt-2 border-t pt-2 space-y-1">
                          <p><strong>ระยะเวลา:</strong> {service.serviceType === 'multi-area' ? `${service.areas?.length || 0} พื้นที่` : `${service.duration ?? '-'} นาที`}</p>
                          <p className="truncate"><strong>รายละเอียด:</strong> {service.description || service.details || service.desc || 'ไม่มีรายละเอียด'}</p>
                          {service.addOnServices && service.addOnServices.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium">บริการเสริม:</p>
                              <ul className="text-sm mt-1 space-y-1">
                                {service.addOnServices.map((a, i) => (
                                  <li key={i} className="flex justify-between">
                                    <span>{a.name || a.title || a.label || 'ไม่มีชื่อ'}</span>
                                    <span className="font-medium">{formatPrice(a.price)} {profile.currencySymbol}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {service.createdAt && (
                            <p className="text-xs text-gray-400 mt-2">สร้างเมื่อ: {format(safeDate(service.createdAt), 'dd MMM yyyy', { locale: th })}</p>
                          )}
                          {service.updatedAt && (
                            <p className="text-xs text-gray-400">อัพเดต: {format(safeDate(service.updatedAt), 'dd MMM yyyy', { locale: th })}</p>
                          )}
                      </div>
                  </div>
                  <div className="border-t mt-4 pt-3 flex justify-between items-center gap-2">
                      <div className="flex gap-2 items-center">
                        <StatusButton status={service.status} />
                        <button
                          className={`text-xs px-2 py-1 rounded-md font-semibold border ${service.status === 'available' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'} ${statusUpdatingId === service.id ? 'opacity-60 pointer-events-none' : ''}`}
                          onClick={() => handleUpdateStatus(service)}
                          disabled={statusUpdatingId === service.id}
                        >
                          {service.status === 'available' ? 'งดให้บริการ' : 'เปิดให้บริการ'}
                        </button>
                      </div>
                      <div className="flex gap-2">
                          <Link href={`/services/edit/${service.id}`} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-md">แก้ไข</Link>
                          <button onClick={() => handleDeleteService(service)} className="text-sm bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md">ลบ</button>
                      </div>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
}

