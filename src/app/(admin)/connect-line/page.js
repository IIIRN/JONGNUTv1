'use client';

import { useState } from 'react';
import { connectLineToCustomer } from '@/app/actions/customerActions';
import { getPointsByPhone } from '@/app/actions/pointActions';

export default function ConnectLinePage() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    userId: '',
    fullName: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [pointsPreview, setPointsPreview] = useState(null);
  const [checkingPoints, setCheckingPoints] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear message when user types
    if (message) setMessage('');
  };

  const handleCheckPoints = async () => {
    if (!formData.phoneNumber.trim()) {
      setMessage('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    setCheckingPoints(true);
    try {
      const result = await getPointsByPhone(formData.phoneNumber.trim());
      
      if (result.success) {
        setPointsPreview(result);
        if (result.points > 0) {
          setMessage(`พบคะแนนสะสม ${result.points} คะแนนสำหรับเบอร์นี้`);
        } else {
          setMessage('ไม่พบคะแนนสะสมสำหรับเบอร์นี้');
        }
      } else {
        setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        setPointsPreview(null);
      }
    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      setPointsPreview(null);
    } finally {
      setCheckingPoints(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.phoneNumber.trim() || !formData.userId.trim()) {
      setMessage('กรุณากรอกเบอร์โทรศัพท์และ LINE User ID');
      return;
    }

    setLoading(true);
    try {
      const result = await connectLineToCustomer(
        formData.phoneNumber.trim(),
        formData.userId.trim(),
        {
          fullName: formData.fullName.trim(),
          email: formData.email.trim()
        }
      );

      if (result.success) {
        setMessage(result.message);
        setFormData({
          phoneNumber: '',
          userId: '',
          fullName: '',
          email: ''
        });
        setPointsPreview(null);
      } else {
        setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
      }
    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          เชื่อมต่อ LINE ID กับลูกค้า
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              เบอร์โทรศัพท์ <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="กรอกเบอร์โทรศัพท์"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={handleCheckPoints}
                disabled={checkingPoints || !formData.phoneNumber.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingPoints ? 'กำลังตรวจสอบ...' : 'ตรวจสอบคะแนน'}
              </button>
            </div>
          </div>

          {/* Points Preview */}
          {pointsPreview && (
            <div className={`p-4 rounded-md ${
              pointsPreview.points > 0 
                ? 'bg-green-50 border border-green-200'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <h3 className="font-medium text-gray-900 mb-2">ข้อมูลคะแนนปัจจุบัน</h3>
              <div className="text-sm text-gray-700">
                <p>คะแนนที่จะรวม: <span className="font-bold text-green-600">{pointsPreview.points} คะแนน</span></p>
                {pointsPreview.customerInfo && (
                  <>
                    <p>วันที่ได้รับคะแนนล่าสุด: {pointsPreview.customerInfo.lastPointsDate ? 
                      new Date(pointsPreview.customerInfo.lastPointsDate.seconds * 1000).toLocaleDateString('th-TH') : 
                      'ไม่ระบุ'
                    }</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* LINE User ID */}
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
              LINE User ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="userId"
              name="userId"
              value={formData.userId}
              onChange={handleInputChange}
              placeholder="กรอก LINE User ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              LINE User ID ที่ได้จากการเชื่อมต่อ LINE Bot
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="กรอกชื่อ-นามสกุล (ถ้ามี)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              อีเมล
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="กรอกอีเมล (ถ้ามี)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ LINE ID'}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div className={`mt-6 p-4 rounded-md ${
            message.includes('เกิดข้อผิดพลาด') || message.includes('ถูกใช้งานแล้ว')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : message.includes('สำเร็จ')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">วิธีการใช้งาน</h3>
          <ol className="space-y-2 text-sm text-yellow-700 list-decimal list-inside">
            <li>กรอกเบอร์โทรศัพท์ของลูกค้าแล้วกดตรวจสอบคะแนน</li>
            <li>กรอก LINE User ID ที่ได้จากการเชื่อมต่อ LINE Bot</li>
            <li>กรอกข้อมูลเพิ่มเติม (ถ้ามี)</li>
            <li>กดปุ่มเชื่อมต่อ LINE ID</li>
            <li>ระบบจะรวมคะแนนจากระบบเบอร์โทรอัตโนมัติ (ถ้ามี)</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-100 rounded border border-yellow-300">
            <p className="text-xs text-yellow-800">
              <strong>หมายเหตุ:</strong> หลังจากเชื่อมต่อแล้ว ลูกค้าจะสามารถรับแจ้งเตือนผ่าน LINE และสะสมคะแนนได้ปกติ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
