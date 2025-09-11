'use client';

import { useState, useEffect } from 'react';
import { getPointsByPhone } from '@/app/actions/pointActions';

export default function PointsManagementPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearchPoints = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setMessage('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const result = await getPointsByPhone(phoneNumber.trim());
      
      if (result.success) {
        setCustomerInfo(result);
        if (result.customerInfo) {
          setMessage(`พบข้อมูลคะแนนของลูกค้า: ${result.points} คะแนน`);
        } else {
          setMessage('ไม่พบข้อมูลคะแนนสำหรับเบอร์นี้');
        }
      } else {
        setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        setCustomerInfo(null);
      }
    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'ไม่ระบุ';
    return new Date(timestamp.seconds * 1000).toLocaleString('th-TH');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          จัดการคะแนนลูกค้า (ไม่มี LINE ID)
        </h1>

        {/* Search Form */}
        <form onSubmit={handleSearchPoints} className="mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="กรอกเบอร์โทรศัพท์"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
              </button>
            </div>
          </div>
        </form>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-md mb-6 ${
            message.includes('เกิดข้อผิดพลาด') 
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message}
          </div>
        )}

        {/* Customer Info */}
        {customerInfo && customerInfo.customerInfo && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลคะแนนลูกค้า</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600">เบอร์โทรศัพท์</label>
                <p className="text-gray-900">{customerInfo.customerInfo.phoneNumber}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600">คะแนนปัจจุบัน</label>
                <p className="text-2xl font-bold text-green-600">{customerInfo.points} คะแนน</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600">การนัดหมายล่าสุด</label>
                <p className="text-gray-900">{customerInfo.customerInfo.lastAppointmentId || 'ไม่ระบุ'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600">คะแนนที่ได้รับล่าสุด</label>
                <p className="text-gray-900">{customerInfo.customerInfo.lastPointsAwarded || 0} คะแนน</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600">วันที่ได้รับคะแนนล่าสุด</label>
                <p className="text-gray-900">{formatDate(customerInfo.customerInfo.lastPointsDate)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600">สถานะ LINE</label>
                <p className="text-red-600 font-medium">ไม่มี LINE ID</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="font-medium text-yellow-800 mb-2">หมายเหตุสำหรับแอดมิน</h3>
              <p className="text-sm text-yellow-700">
                ลูกค้ารายนี้ไม่มี LINE ID จึงไม่สามารถรับแจ้งเตือนคะแนนผ่าน LINE ได้ 
                แนะนำให้แจ้งคะแนนผ่านช่องทางอื่น เช่น โทรศัพท์ หรือ SMS
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">คำแนะนำการใช้งาน</h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• ระบบจะเก็บคะแนนแยกสำหรับลูกค้าที่ไม่มี LINE ID โดยใช้เบอร์โทรศัพท์เป็นตัวอ้างอิง</li>
            <li>• คะแนนจะถูกเก็บอัตโนมัติเมื่อการนัดหมายเสร็จสิ้น</li>
            <li>• ลูกค้าเหล่านี้จะไม่ได้รับแจ้งเตือนผ่าน LINE จึงต้องแจ้งคะแนนด้วยตนเอง</li>
            <li>• สามารถแนะนำให้ลูกค้าเชื่อมต่อ LINE เพื่อรับแจ้งเตือนอัตโนมัติ</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
