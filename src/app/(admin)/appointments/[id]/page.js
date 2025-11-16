// src/app/(admin)/appointments/[id]/page.js
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin, sendInvoiceToCustomer } from '@/app/actions/appointmentActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileProvider';

// --- Modal Component for editing payment info ---
function EditPaymentModal({ open, onClose, onSave, defaultAmount, defaultMethod, currencySymbol }) {
  const [amount, setAmount] = useState(defaultAmount || '');
  const [method, setMethod] = useState(defaultMethod || 'เงินسด');
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">ยืนยันการชำระเงิน</h2>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">ยอดชำระ ({currencySymbol})</label>
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

// --- Modal Component for completion note ---
function CompletionNoteModal({ open, onClose, onSave, customerName, serviceInfo }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  
  if (!open) return null;
  
  const loadServiceNote = () => {
    const serviceNote = serviceInfo?.completionNote || serviceInfo?.note || '';
    if (serviceNote) {
      setNote(serviceNote);
    } else {
      alert('ไม่มีข้อความที่กำหนดไว้ในบริการนี้');
    }
  };
  
  // ตรวจสอบว่ามี completion note หรือไม่
  const hasServiceNote = !!(serviceInfo?.completionNote && serviceInfo.completionNote.trim());
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">ข้อความถึงลูกค้า</h2>
        <p className="text-sm text-gray-600 mb-3">
          ส่งข้อความขอบคุณหรือคำแนะนำให้ลูกค้า {customerName}
        </p>
        
        {/* ปุ่มดึงข้อความจากบริการ - แสดงเฉพาะเมื่อมี completionNote */}
        {hasServiceNote && (
          <div className="mb-3">
            <button
              onClick={loadServiceNote}
              type="button"
              className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm hover:bg-blue-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ใช้ข้อความจากบริการ
            </button>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">ข้อความ (ไม่บังคับ)</label>
          <textarea
            className="w-full border rounded px-3 py-2 h-24 resize-none"
            placeholder="เช่น ขอบคุณที่ใช้บริการ หวังว่าจะได้เจอกันอีกครั้ง..."
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
          />
          <div className="text-xs text-gray-500 mt-1">{note.length}/200 ตัวอักษร</div>
        </div>
        
        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          <button 
            onClick={async () => { 
              setSaving(true); 
              await onSave(note.trim()); 
              setSaving(false); 
            }} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400" 
            disabled={saving}
          >
            {saving ? 'กำลังส่ง...' : 'ส่งข้อความ'}
          </button>
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
  const [serviceDetails, setServiceDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompletionNote, setShowCompletionNote] = useState(false);
  const [statusChangeInfo, setStatusChangeInfo] = useState(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const { showToast } = useToast(); // ยังใช้ toast สำหรับ error ที่ไม่เกี่ยวกับ card
  const { profile, loading: profileLoading } = useProfile();

  const handleSavePayment = async (amount, method) => {
    if (!appointment?.id) return;
    try {
      const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', { amount: Number(amount), method });
      if (result.success) {
        showToast('อัพเดตข้อมูลการชำระเงินสำเร็จ', 'success');
        setAppointment(prev => ({
          ...prev,
          status: 'confirmed',
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
        showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === appointment.status) return;
    
    // ถ้าเป็นสถานะ "เสร็จสิ้น" ให้แสดง modal ใส่ note
    if (newStatus === 'completed') {
      setShowCompletionNote(true);
      return;
    }
    
    const statusLabel = STATUS_OPTIONS.find(opt => opt.value === newStatus)?.label || newStatus;
    setStatusChangeInfo({ newStatus, statusLabel });
  };

  const handleCompletionWithNote = async (note) => {
    setUpdating(true);
    try {
      const result = await updateAppointmentStatusByAdmin(appointment.id, 'completed', note);
      if (result.success) {
        showToast('อัพเดทสถานะเป็นเสร็จสิ้นสำเร็จ และส่งข้อความไปยังลูกค้าแล้ว', 'success');
        setAppointment(prev => ({ 
          ...prev, 
          status: 'completed', 
          updatedAt: new Date(),
          completionNote: note // บันทึก note ที่ส่งไป
        }));
      } else {
        showToast(`อัพเดทสถานะไม่สำเร็จ: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`อัพเดทสถานะไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setUpdating(false);
      setShowCompletionNote(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusChangeInfo) return;
    const { newStatus } = statusChangeInfo;
    setUpdating(true);
    try {
      const result = await updateAppointmentStatusByAdmin(appointment.id, newStatus);
      if (result.success) {
        showToast('อัพเดทสถานะสำเร็จ และส่งการแจ้งเตือนแล้ว', 'success');
        setAppointment(prev => ({ ...prev, status: newStatus, updatedAt: new Date() }));
      } else {
        showToast(`อัพเดทสถานะไม่สำเร็จ: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`อัพเดทสถานะไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setUpdating(false);
      setStatusChangeInfo(null);
    }
  };

  const handleDelete = async () => {
    if (!appointment?.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      showToast('ลบการจองสำเร็จ', 'success');
      setDeleted(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      showToast('ลบการจองไม่สำเร็จ', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!appointment?.id) return;
    setIsSendingInvoice(true);
    try {
        const result = await sendInvoiceToCustomer(appointment.id);
        if(result.success) {
            showToast('ส่งลิงก์ชำระเงินให้ลูกค้าแล้ว', 'success');
            setAppointment(prev => ({
                ...prev,
                paymentInfo: { ...prev.paymentInfo, paymentStatus: 'invoiced' }
            }));
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        setIsSendingInvoice(false);
    }
  };


  const serializeFirestoreTimestamps = (data) => {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => serializeFirestoreTimestamps(item));
  }
  if (typeof data === 'object' && data !== null) {
    // Check for Firestore Timestamp structure
    if (data._seconds !== undefined && data._nanoseconds !== undefined) {
      return new Date(data._seconds * 1000 + data._nanoseconds / 1000000).toISOString();
    }
    const newData = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = serializeFirestoreTimestamps(data[key]);
      }
    }
    return newData;
  }
  return data;
};

  useEffect(() => {
    if (!id || deleted) return;
    setLoading(true);
    const ref = doc(db, 'appointments', id);
    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        showToast('ไม่พบข้อมูลการนัดหมาย', 'error');
        setAppointment(null);
        setLoading(false);
        return;
      }
      const rawData = snap.data();
      const dataWithDates = {
        ...rawData,
        createdAt: rawData.createdAt?.toDate ? rawData.createdAt.toDate() : (rawData.createdAt ? new Date(rawData.createdAt) : null),
        updatedAt: rawData.updatedAt?.toDate ? rawData.updatedAt.toDate() : (rawData.updatedAt ? new Date(rawData.updatedAt) : null),
      };
      setAppointment({ id: snap.id, ...dataWithDates });
      // ดึงข้อมูลบริการเพิ่มเติม (one-time fetch)
      if (rawData.serviceId) {
        try {
          const serviceRef = doc(db, 'services', rawData.serviceId);
          const serviceSnap = await getDoc(serviceRef);
          if (serviceSnap.exists()) {
            setServiceDetails(serviceSnap.data());
          }
        } catch (err) {
          console.error('Error fetching service details:', err);
        }
      }
      setLoading(false);
    }, (err) => {
      console.error('Error in real-time listener:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, router, deleted]);

  if (deleted) return <div className="text-center mt-20">ข้อมูลการนัดหมายถูกลบแล้ว กำลังกลับไปหน้าหลัก...</div>;
  if (loading || profileLoading) return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
  if (!appointment) return <div className="text-center mt-20">ไม่พบข้อมูลการนัดหมาย</div>;

  // ปรับ logic ให้รองรับทุกกรณีและ field
  const dateTime = (() => {
    const raw =
      appointment.appointmentInfo?.dateTime ||
      appointment.dateTime ||
      appointment.date ||
      appointment.appointmentDate;
    if (!raw) return null;
    if (typeof raw === 'string' || typeof raw === 'number') {
      const d = new Date(raw);
      return isNaN(d) ? null : d;
    }
    if (raw instanceof Date) return raw;
    if (raw?._seconds !== undefined && raw._nanoseconds !== undefined) {
      // Firestore Timestamp object
      return new Date(raw._seconds * 1000 + raw._nanoseconds / 1000000);
    }
    if (raw?.toDate && typeof raw.toDate === 'function') return raw.toDate();
    return null;
  })();
    
  const statusInfo = STATUSES[appointment.status] || { label: appointment.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="container mx-auto p-4 md:p-8">
        <ConfirmationModal
            show={showDeleteConfirm}
            title="ยืนยันการลบ"
            message="คุณแน่ใจหรือไม่ว่าต้องการลบการจองนี้?"
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            isProcessing={deleting}
        />
        <ConfirmationModal
            show={!!statusChangeInfo}
            title="ยืนยันการเปลี่ยนสถานะ"
            message={`คุณต้องการเปลี่ยนสถานะเป็น "${statusChangeInfo?.statusLabel}" หรือไม่? การดำเนินการนี้จะส่งแจ้งเตือนไปยังลูกค้า`}
            onConfirm={confirmStatusChange}
            onCancel={() => setStatusChangeInfo(null)}
            isProcessing={updating}
        />
        <CompletionNoteModal
            open={showCompletionNote}
            onClose={() => setShowCompletionNote(false)}
            onSave={handleCompletionWithNote}
            customerName={appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ลูกค้า'}
            serviceInfo={serviceDetails || appointment.serviceInfo}
        />
      <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl text-black md:text-3xl font-bold">รายละเอียดนัดหมาย #{appointment.id.substring(0,6).toUpperCase()}</h1>
          <div className="mt-2">
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
    <div className="flex gap-2 self-start md:self-center">
      <button
      onClick={() => setShowDeleteConfirm(true)}
      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md disabled:bg-red-300"
      disabled={deleting}
      >
      {deleting ? 'กำลังลบ...' : 'ลบการจอง'}
      </button>
    </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Customer Information */}
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
          {appointment.completionNote && (
            <InfoRow 
              label="ข้อความที่ส่งให้ลูกค้า" 
              value={
                <div className="bg-green-50 border border-green-200 rounded-md p-2 text-sm">
                  <span className="text-green-800">{appointment.completionNote}</span>
                </div>
              } 
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-gray-500 mt-4 border-t pt-4">
            <span>เปลี่ยนสถานะ:</span>
            <div className="flex flex-wrap gap-2">
                {/* ปุ่มสถานะถัดไป - เด่นชัด */}
                {appointment.status === 'awaiting_confirmation' && (
                    <button
                        onClick={() => handleStatusChange('confirmed')}
                        disabled={updating}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                    >
                        ✓ ยืนยันการจอง
                    </button>
                )}
                {appointment.status === 'confirmed' && (
                    <button
                        onClick={() => handleStatusChange('in_progress')}
                        disabled={updating}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                    >
                        ▶ เริ่มให้บริการ
                    </button>
                )}
                {appointment.status === 'in_progress' && (
                    <button
                        onClick={() => handleStatusChange('completed')}
                        disabled={updating}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                    >
                        ✓ บริการเสร็จสิ้น
                    </button>
                )}
                
                {/* ปุ่มสถานะอื่นๆ - เล็กกว่า */}
                <div className="flex flex-wrap gap-2 ml-2 border-l pl-2">
                    {STATUS_OPTIONS.filter(opt => {
                        // ซ่อนปุ่มที่กำลังใช้และปุ่มสถานะถัดไป
                        if (opt.value === appointment.status) return false;
                        if (appointment.status === 'awaiting_confirmation' && opt.value === 'confirmed') return false;
                        if (appointment.status === 'confirmed' && opt.value === 'in_progress') return false;
                        if (appointment.status === 'in_progress' && opt.value === 'completed') return false;
                        return true;
                    }).map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => handleStatusChange(opt.value)}
                            disabled={updating}
                            className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            {updating && <span className="text-xs text-blue-500 ml-2">กำลังอัพเดท...</span>}
          </div>
        </div>

        {/* Service Information */}
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
              
              {/* Multi-area service details */}
              {appointment.serviceInfo?.serviceType === 'multi-area' && (
                <>
                  {appointment.serviceInfo?.selectedArea && (
                    <InfoRow 
                      label="พื้นที่บริการ" 
                      value={
                        <span className="text-primary font-medium">
                          {appointment.serviceInfo.selectedArea.name || '-'}
                        </span>
                      } 
                    />
                  )}
                  {appointment.serviceInfo?.selectedPackage && (
                    <InfoRow 
                      label="แพ็คเกจ" 
                      value={
                        <div className="text-sm">
                          <span className="font-medium">{appointment.serviceInfo.selectedPackage.name || '-'}</span>
                          <div className="text-gray-600 text-xs mt-1">
                            {appointment.serviceInfo.selectedPackage.duration} นาที | {formatPrice(appointment.serviceInfo.selectedPackage.price)} {profile.currencySymbol}
                          </div>
                        </div>
                      } 
                    />
                  )}
                </>
              )}
              
              <InfoRow label="ระยะเวลา" value={appointment.appointmentInfo?.duration ? `${appointment.appointmentInfo.duration} นาที` : (appointment.serviceInfo?.duration ? `${appointment.serviceInfo.duration} นาที` : '-') } />
              <InfoRow label="พนักงาน" value={
                appointment.appointmentInfo?.technicianName
                || appointment.appointmentInfo?.technicianInfo?.firstName
                || appointment.technicianInfo?.firstName
                || appointment.technician?.firstName
                || appointment.appointmentInfo?.technician
                || '-'} />
              <InfoRow label="วันที่/เวลา" value={
                dateTime && !isNaN(dateTime)
                  ? format(dateTime, 'dd MMM yyyy, HH:mm', { locale: th })
                  : (appointment.date && appointment.time
                      ? `${format(new Date(appointment.date), 'dd MMM yyyy', { locale: th })}, ${appointment.time}`
                      : appointment.date
                        ? format(new Date(appointment.date), 'dd MMM yyyy', { locale: th })
                        : appointment.time
                          ? appointment.time
                          : '-')
              } />
              <InfoRow label="สถานที่" value={
                appointment.locationInfo?.name
                  || appointment.appointmentInfo?.locationName
                  || profile.storeName
                  || '-'
              } />
              <InfoRow label="คิว" value={appointment.queue ?? appointment.appointmentInfo?.queue ?? appointment.queueNumber ?? 'ไม่มีการจัดคิว'} />
            </div>
          </div>
          {((appointment.appointmentInfo && appointment.appointmentInfo.addOns && appointment.appointmentInfo.addOns.length) || (appointment.addOns && appointment.addOns.length)) && (
            <div className="mt-2 bg-gray-50 p-3 rounded-md">
              <h3 className="font-semibold mb-2">บริการเสริม</h3>
              <ul className="text-sm space-y-1">
                {(appointment.appointmentInfo?.addOns || appointment.addOns || []).map((a, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{a.name || a.title || 'ไม่มีชื่อ'}</span>
                    <span className="font-medium">{formatPrice(a.price)} {profile.currencySymbol}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="bg-white text-black p-6 rounded-lg shadow-md space-y-2">
          <h2 className="text-xl font-bold mb-2">สรุปการชำระเงิน</h2>
          <InfoRow label="ราคาบริการ" value={
            appointment.paymentInfo?.originalPrice
              ? `${formatPrice(appointment.paymentInfo.originalPrice)} ${profile.currencySymbol}`
              : appointment.paymentInfo?.basePrice
                ? `${formatPrice(appointment.paymentInfo.basePrice)} ${profile.currencySymbol}`
                : appointment.serviceInfo?.price
                  ? `${formatPrice(appointment.serviceInfo.price)} ${profile.currencySymbol}`
                  : appointment.appointmentInfo?.price
                    ? `${formatPrice(appointment.appointmentInfo.price)} ${profile.currencySymbol}`
                    : appointment.price
                      ? `${formatPrice(appointment.price)} ${profile.currencySymbol}`
                      : '-'
          } />
          <InfoRow label="รวมบริการเสริม" value={
            appointment.paymentInfo?.addOnsTotal
              ? `${formatPrice(appointment.paymentInfo.addOnsTotal)} ${profile.currencySymbol}`
              : appointment.appointmentInfo?.addOns
                ? `${formatPrice((appointment.appointmentInfo.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))} ${profile.currencySymbol}`
                : '-'
          } />
          {appointment.paymentInfo?.couponDiscount || appointment.paymentInfo?.discount ? (
            <InfoRow label="ส่วนลดคูปอง" value={`-${formatPrice(appointment.paymentInfo.couponDiscount || appointment.paymentInfo.discount)} ${profile.currencySymbol}`} />
          ) : null}
          <InfoRow label="ยอดรวม" value={
            appointment.paymentInfo?.totalPrice
              ? `${formatPrice(appointment.paymentInfo.totalPrice)} ${profile.currencySymbol}`
              : (
                  (appointment.paymentInfo?.originalPrice || appointment.paymentInfo?.basePrice || appointment.serviceInfo?.price || appointment.appointmentInfo?.price || appointment.price || 0)
                  + (appointment.paymentInfo?.addOnsTotal || (appointment.appointmentInfo?.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))
                  - (appointment.paymentInfo?.couponDiscount || appointment.paymentInfo?.discount || 0)
                )
                ? `${formatPrice(
                    (appointment.paymentInfo?.originalPrice || appointment.paymentInfo?.basePrice || appointment.serviceInfo?.price || appointment.appointmentInfo?.price || appointment.price || 0)
                    + (appointment.paymentInfo?.addOnsTotal || (appointment.appointmentInfo?.addOns||[]).reduce((s,a)=>s+Number(a.price||0),0))
                    - (appointment.paymentInfo?.couponDiscount || appointment.paymentInfo?.discount || 0)
                  )} ${profile.currencySymbol}`
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
          <div className="border-t mt-3 pt-3 space-y-2">
            <button
                onClick={handleSendInvoice}
                disabled={isSendingInvoice || appointment.paymentInfo?.paymentStatus === 'paid'}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-base shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isSendingInvoice ? 'กำลังส่ง...' : 'ส่งลิงก์ชำระเงินให้ลูกค้า'}
            </button>
            <button 
                onClick={() => setShowEditPayment(true)}
                className="w-full bg-green-500 text-white py-2 rounded-md mt-2 hover:bg-green-600"
            >
                ยืนยันการชำระเงิน (เงินสด/อื่นๆ)
            </button>
            <hr className="my-2"/>
            <InfoRow label="สร้างเมื่อ" value={safeDate(appointment.createdAt) instanceof Date && !isNaN(safeDate(appointment.createdAt)) ? format(safeDate(appointment.createdAt), 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
            <InfoRow label="อัพเดตล่าสุด" value={safeDate(appointment.updatedAt) instanceof Date && !isNaN(safeDate(appointment.updatedAt)) ? format(safeDate(appointment.updatedAt), 'dd MMM yyyy, HH:mm', { locale: th }) : '-'} />
            <EditPaymentModal
              open={showEditPayment}
              onClose={() => setShowEditPayment(false)}
              onSave={handleSavePayment}
              defaultAmount={appointment.paymentInfo?.amountPaid || appointment.paymentInfo?.totalPrice || ''}
              defaultMethod={appointment.paymentInfo?.paymentMethod || 'เงินสด'}
              currencySymbol={profile.currencySymbol}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
