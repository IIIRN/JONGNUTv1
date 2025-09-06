'use client';

import { useState, useEffect } from 'react';

export default function PointMergeHistoryPage() {
  const [mergeHistory, setMergeHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMergeHistory();
  }, []);

  const fetchMergeHistory = async () => {
    try {
      setLoading(true);
      // This would need to be implemented as a server action
      // For now, we'll show a placeholder
      setMergeHistory([]);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'ไม่ระบุ';
    return new Date(timestamp.seconds * 1000).toLocaleString('th-TH');
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          ประวัติการรวมคะแนน
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {mergeHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className="text-gray-500">ยังไม่มีประวัติการรวมคะแนน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่รวม
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    เบอร์โทรศัพท์
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LINE User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    คะแนนที่รวม
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    คะแนนเดิมใน LINE
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    คะแนนรวมใหม่
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mergeHistory.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.mergedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {record.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      +{record.mergedPoints} คะแนน
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.originalLinePoints} คะแนน
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      {record.newTotalPoints} คะแนน
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">การรวมทั้งหมด</h3>
            <p className="text-3xl font-bold text-blue-600">{mergeHistory.length}</p>
            <p className="text-sm text-blue-700">ครั้ง</p>
          </div>
          
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-2">คะแนนที่รวมทั้งหมด</h3>
            <p className="text-3xl font-bold text-green-600">
              {mergeHistory.reduce((sum, record) => sum + (record.mergedPoints || 0), 0)}
            </p>
            <p className="text-sm text-green-700">คะแนน</p>
          </div>
          
          <div className="bg-purple-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">คะแนนเฉลี่ยต่อครั้ง</h3>
            <p className="text-3xl font-bold text-purple-600">
              {mergeHistory.length > 0 
                ? Math.round(mergeHistory.reduce((sum, record) => sum + (record.mergedPoints || 0), 0) / mergeHistory.length)
                : 0
              }
            </p>
            <p className="text-sm text-purple-700">คะแนน</p>
          </div>
        </div>

        {/* Information */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">ข้อมูลการรวมคะแนน</h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• การรวมคะแนนจะเกิดขึ้นเมื่อลูกค้าเชื่อมต่อ LINE ID กับเบอร์โทรศัพท์ที่มีคะแนนสะสมอยู่</li>
            <li>• คะแนนจากระบบเบอร์โทรจะถูกรวมเข้ากับบัญชี LINE ของลูกค้า</li>
            <li>• หลังจากรวมแล้ว คะแนนในระบบเบอร์โทรจะถูกล้างและมีสถานะ "merged"</li>
            <li>• ลูกค้าจะได้รับแจ้งเตือนผ่าน LINE เมื่อมีการเปลี่ยนแปลงคะแนน</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
