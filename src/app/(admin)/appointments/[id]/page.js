// src/app/(admin)/appointments/[id]/page.js
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin } from '@/app/actions/appointmentActions';
// Modal for editing payment info
function EditPaymentModal({ open, onClose, onSave, defaultAmount, defaultMethod }) {
  const [amount, setAmount] = useState(defaultAmount || '');
  const [method, setMethod] = useState(defaultMethod || 'เงินสด');
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">แก้ไขข้อมูลการชำระเงิน</h2>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">ยอดชำระ (บาท)</label>
          <input type="number" className="w-full border rounded px-2 py-1" value={amount} onChange={e => setAmount(e.target.value)} min="0" />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">ช่องทางชำระ</label>
          <select className="w-full border rounded px-2 py-1" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเงิน">โอนเงิน</option>
            <option value="บัตรเครดิต">บัตรเครดิต</option>
            <option value="PromptPay">PromptPay</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">ยกเลิก</button>
          <button onClick={async () => { setSaving(true); await onSave(amount, method); setSaving(false); }} className="px-4 py-2 bg-green-600 text-white rounded" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}
const STATUS_OPTIONS = [
  { value: 'awaiting_confirmation', label: 'รอยืนยัน' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'in_progress', label: 'กำลังใช้บริการ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'cancelled', label: 'ยกเลิก' },
];
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

// --- Status & Color Definitions (Added for badge consistency) ---
const STATUSES = {
    awaiting_confirmation: { label: 'รอยืนยัน', color: 'bg-yellow-100 text-yellow-800' },
    confirmed: { label: 'ยืนยันแล้ว', color: 'bg-blue-100 text-blue-800' },
    in_progress: { label: 'กำลังใช้บริการ', color: 'bg-purple-100 text-purple-800' },
    completed: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

export default function AdminAppointmentDetail() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditPayment, setShowEditPayment] = useState(false);
  // Save payment info
  const handleSavePayment = async (amount, method) => {
    if (!appointment?.id) return;
    try {
      const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', { amount: Number(amount), method });
      if (result.success) {
        alert('อัพเดตข้อมูลการชำระเงินสำเร็จ');
        setAppointment(prev => ({
          ...prev,
          paymentInfo: {
            ...prev.paymentInfo,
            amountPaid: Number(amount),
            paymentMethod: method,
            paymentStatus: 'paid',
            paidAt: new Date(),
          },
        }));
        setShowEditPayment(false);
      } else {
        alert('เกิดข้อผิดพลาด: ' + result.error);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    const currentStatus = appointment.status;
    if (!appointment?.id || newStatus === currentStatus) return;

    const statusLabel = STATUS_OPTIONS.find(opt => opt.value === newStatus)?.label || newStatus;

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนสถานะเป็น "${statusLabel}"? การดำเนินการนี้จะส่งการแจ้งเตือนไปยังลูกค้า`)) {
        setUpdating(true);
        try {
            const result = await updateAppointmentStatusByAdmin(appointment.id, newStatus);
            if (result.success) {
                alert('อัพเดทสถานะสำเร็จ และส่งการแจ้งเตือนแล้ว');
                setAppointment(prev => ({ ...prev, status: newStatus, updatedAt: new Date() }));
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            alert(`อัพเดทสถานะไม่สำเร็จ: ${err.message}`);
            e.target.value = currentStatus;
        } finally {
            setUpdating(false);
        }
    } else {
        e.target.value = currentStatus;
    }
  };

  const handleDelete = async () => {
    if (!appointment?.id) return;
    if (!window.confirm('ยืนยันการลบการจองนี้?')) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      alert('ลบการจองสำเร็จ');
      router.push('/dashboard');
    } catch (err) {
      alert('ลบการจองไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

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
    
  const statusInfo = STATUSES[appointment.status] || { label: appointment.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl text-black md:text-3xl font-bold">รายละเอียดนัดหมาย #{appointment.id.substring(0,6).toUpperCase()}</h1>
          <div className="mt-2">
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md disabled:bg-red-300 self-start md:self-center"
          disabled={deleting}
        >
          {deleting ? 'กำลังลบ...' : 'ลบการจอง'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* ข้อมูลลูกค้า */}
        <div className="bg-white p-6 rounded-lg shadow-md space-y-2">
          <h2 className="text-xl font-bold mb-2">ข้อมูลลูกค้า</h2>
          <InfoRow label="ชื่อ" value={appointment.customerInfo?.fullName || appointment.customerInfo?.name || '-'} />
          <InfoRow label="เบอร์โทร" value={appointment.customerInfo?.phone} />
          <InfoRow label="LINE ID" value={
            appointment.userId
              ? <span className="text-green-600 font-semibold">เชื่อมต่อ LINEOA แล้ว</span>
              : '-'
          } />
          <InfoRow label="หมายเหตุ" value={appointment.customerInfo?.note || appointment.note || '-'} />
          <div className="flex items-center gap-2 text-gray-500 mt-4 border-t pt-4">
            <span>เปลี่ยนสถานะ:</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={appointment.status || ''}
              onChange={handleStatusChange}
              disabled={updating}
            >
              <option value="">-</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {updating && <span className="text-xs text-blue-500 ml-2">กำลังอัพเดท...</span>}
          </div>
        </div>

        {/* ข้อมูลบริการ */}
        <div className="bg-white p-6 rounded-lg shadow-md space-y-2">
          <h2 className="text-xl font-bold mb-2">ข้อมูลบริการ</h2>
          <div className="flex items-start gap-4 mb-2">
            <div className="w-24 h-24 relative rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
              {appointment.serviceInfo?.imageUrl ? (
                <Image src={appointment.serviceInfo.imageUrl} alt={appointment.serviceInfo?.name || 'service'} fill style={{ objectFit: 'cover' }} />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">No Image</div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <InfoRow label="บริการ" value={appointment.serviceInfo?.name || appointment.serviceName || '-'} />
              <InfoRow label="ระยะเวลา" value={appointment.appointmentInfo?.duration ? `${appointment.appointmentInfo.duration} นาที` : (appointment.serviceInfo?.duration ? `${appointment.serviceInfo.duration} นาที` : '-') } />
              <InfoRow label="พนักงาน" value={
                appointment.appointmentInfo?.beauticianName
                || appointment.appointmentInfo?.beauticianInfo?.firstName
                || appointment.beauticianInfo?.firstName
                || appointment.beautician?.firstName
                || appointment.appointmentInfo?.beautician
                || '-'} />
              <InfoRow label="วันที่/เวลา" value={dateTime ? format(dateTime, 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
              <InfoRow label="สถานที่" value={appointment.locationInfo?.name || appointment.appointmentInfo?.locationName || '-'} />
              <InfoRow label="คิว" value={appointment.queue ?? appointment.appointmentInfo?.queue ?? appointment.queueNumber ?? '-'} />
            </div>
          </div>
          {((appointment.appointmentInfo && appointment.appointmentInfo.addOns && appointment.appointmentInfo.addOns.length) || (appointment.addOns && appointment.addOns.length)) && (
            <div className="mt-2 bg-gray-50 p-3 rounded-md">
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

        {/* สรุปการชำระเงิน */}
        <div className="bg-white text-black p-6 rounded-lg shadow-md space-y-2">
          <h2 className="text-xl font-bold mb-2">สรุปการชำระเงิน</h2>
          <InfoRow label="ราคาบริการ" value={
            appointment.paymentInfo?.originalPrice
              ? `${formatPrice(appointment.paymentInfo.originalPrice)} บาท`
              : appointment.paymentInfo?.basePrice
                ? `${formatPrice(appointment.paymentInfo.basePrice)} บาท`
                : appointment.serviceInfo?.price
                  ? `${formatPrice(appointment.serviceInfo.price)} บาท`
                  : appointment.appointmentInfo?.price
                    ? `${formatPrice(appointment.appointmentInfo.price)} บาท`
                    : appointment.price
                      ? `${formatPrice(appointment.price)} บาท`
                      : '-'
          } />
          <InfoRow label="รวมบริการเสริม" value={
            appointment.paymentInfo?.addOnsTotal
              ? `${formatPrice(appointment.paymentInfo.addOnsTotal)} บาท`
              : appointment.appointmentInfo?.addOns
                ? `${formatPrice((appointment.appointmentInfo.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))} บาท`
                : '-'
          } />
          <InfoRow label="ยอดรวม" value={
            appointment.paymentInfo?.totalPrice
              ? `${formatPrice(appointment.paymentInfo.totalPrice)} บาท`
              : (
                  (appointment.paymentInfo?.originalPrice || appointment.paymentInfo?.basePrice || appointment.serviceInfo?.price || appointment.appointmentInfo?.price || appointment.price || 0)
                  + (appointment.paymentInfo?.addOnsTotal || (appointment.appointmentInfo?.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))
                  - (appointment.paymentInfo?.discount || 0)
                )
                ? `${formatPrice(
                    (appointment.paymentInfo?.originalPrice || appointment.paymentInfo?.basePrice || appointment.serviceInfo?.price || appointment.appointmentInfo?.price || appointment.price || 0)
                    + (appointment.paymentInfo?.addOnsTotal || (appointment.appointmentInfo?.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))
                    - (appointment.paymentInfo?.discount || 0)
                  )} บาท`
                : '-'
          } />
          <InfoRow label="ช่องทางชำระ" value={appointment.paymentInfo?.paymentMethod || '-'} />
          <InfoRow label="สถานะชำระเงิน" value={
            appointment.paymentInfo?.paymentStatus === 'paid' ? 'ชำระแล้ว'
            : appointment.paymentInfo?.paymentStatus === 'unpaid' ? 'ยังไม่ชำระ'
            : appointment.paymentInfo?.paymentStatus === 'invoiced' ? 'ออกใบแจ้งหนี้แล้ว'
            : appointment.paymentInfo?.paymentStatus === 'pending' ? 'รอดำเนินการ'
            : appointment.paymentInfo?.paymentStatus || '-'
          } />
          <div className="border-t mt-3 pt-3 space-y-1">
            <InfoRow label="สร้างเมื่อ" value={safeDate(appointment.createdAt) ? format(safeDate(appointment.createdAt), 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
            <InfoRow label="อัพเดตล่าสุด" value={safeDate(appointment.updatedAt) ? format(safeDate(appointment.updatedAt), 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
            <button 
                onClick={() => setShowEditPayment(true)}
                className="w-full bg-yellow-500 text-white py-2 rounded-md mt-2"
            >
                แก้ไขการชำระเงิน
            </button>
            <EditPaymentModal
              open={showEditPayment}
              onClose={() => setShowEditPayment(false)}
              onSave={handleSavePayment}
              defaultAmount={appointment.paymentInfo?.amountPaid || appointment.paymentInfo?.totalPrice || ''}
              defaultMethod={appointment.paymentInfo?.paymentMethod || 'เงินสด'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}