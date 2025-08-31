"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-start text-sm py-1">
    <span className="text-gray-500 w-2/5">{label}</span>
    <span className="font-semibold text-gray-800 text-right w-3/5">{value || '-'}</span>
  </div>
);

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

export default function AdminAppointmentDetail() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ref = doc(db, 'appointments', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert('ไม่พบข้อมูลการนัดหมาย');
          router.push('/dashboard');
          return;
        }
        setAppointment({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error('Error fetching appointment:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
  if (!appointment) return <div className="text-center mt-20">ไม่พบข้อมูลการนัดหมาย</div>;

  const dateTime = appointment.appointmentInfo?.dateTime && typeof appointment.appointmentInfo.dateTime.toDate === 'function'
    ? appointment.appointmentInfo.dateTime.toDate()
    : appointment.appointmentInfo?.dateTime ? new Date(appointment.appointmentInfo.dateTime) : null;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">รายละเอียดนัดหมาย #{appointment.id.substring(0,6).toUpperCase()}</h1>
        <p className="text-gray-500">สถานะ: <span className="font-semibold">{appointment.status || '-'}</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-3">ข้อมูลลูกค้า</h2>
            <InfoRow label="ชื่อ" value={appointment.customerInfo?.name} />
            <InfoRow label="เบอร์โทร" value={appointment.customerInfo?.phone} />
            <InfoRow label="LINE ID" value={appointment.userId} />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-3">ข้อมูลบริการ</h2>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 relative rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                {appointment.serviceInfo?.imageUrl ? (
                  <Image src={appointment.serviceInfo.imageUrl} alt={appointment.serviceInfo?.name || 'service'} fill style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">No Image</div>
                )}
              </div>
              <div className="flex-1">
                <InfoRow label="บริการ" value={appointment.serviceInfo?.name || appointment.serviceName || '-'} />
                <InfoRow label="ระยะเวลา" value={appointment.appointmentInfo?.duration ? `${appointment.appointmentInfo.duration} นาที` : (appointment.serviceInfo?.duration ? `${appointment.serviceInfo.duration} นาที` : '-') } />
                <InfoRow label="พนักงาน" value={appointment.appointmentInfo?.beauticianName || (appointment.beauticianInfo ? `${appointment.beauticianInfo.firstName || ''} ${appointment.beauticianInfo.lastName || ''}`.trim() : '-')} />
                <InfoRow label="วันที่/เวลา" value={dateTime ? format(dateTime, 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
                <InfoRow label="สถานที่" value={appointment.locationInfo?.name || appointment.appointmentInfo?.locationName || '-'} />
                <InfoRow label="คิว" value={appointment.queue ?? appointment.appointmentInfo?.queue ?? appointment.queueNumber ?? '-'} />
              </div>
            </div>

            {((appointment.appointmentInfo && appointment.appointmentInfo.addOns && appointment.appointmentInfo.addOns.length) || (appointment.addOns && appointment.addOns.length)) && (
              <div className="mt-4 bg-gray-50 p-3 rounded-md">
                <h3 className="font-semibold mb-2">บริการเสริม</h3>
                <ul className="text-sm space-y-1">
                  {(appointment.appointmentInfo?.addOns || appointment.addOns || []).map((a, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{a.name || a.title || 'ไม่มีชื่อ'}</span>
                      <span className="font-medium">{formatPrice(a.price)} บาท</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-3">สรุป</h2>
            <InfoRow label="ราคาบริการ" value={appointment.paymentInfo?.basePrice ? `${formatPrice(appointment.paymentInfo.basePrice)} บาท` : (appointment.serviceInfo?.price ? `${formatPrice(appointment.serviceInfo.price)} บาท` : '-')} />
            <InfoRow label="รวมบริการเสริม" value={appointment.paymentInfo?.addOnsTotal ? `${formatPrice(appointment.paymentInfo.addOnsTotal)} บาท` : (appointment.appointmentInfo?.addOns ? `${formatPrice((appointment.appointmentInfo.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))} บาท` : '-')} />
            <InfoRow label="ยอดรวม" value={appointment.paymentInfo?.totalPrice ? `${formatPrice(appointment.paymentInfo.totalPrice)} บาท` : '-'} />
            <InfoRow label="ช่องทางชำระ" value={appointment.paymentInfo?.paymentMethod || '-'} />
            <InfoRow label="หมายเหตุ" value={appointment.customerInfo?.note || appointment.note || '-'} />
            <div className="border-t mt-3 pt-3">
              <InfoRow label="สร้างเมื่อ" value={safeDate(appointment.createdAt) ? format(safeDate(appointment.createdAt), 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
              <InfoRow label="อัพเดตล่าสุด" value={safeDate(appointment.updatedAt) ? format(safeDate(appointment.updatedAt), 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
              <div className="mt-3">
                <button onClick={() => router.back()} className="w-full bg-gray-900 text-white py-2 rounded-md">กลับ</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
