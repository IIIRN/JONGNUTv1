"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { useProfile } from '@/context/ProfileProvider';

export default function PointsReportPage() {
    const [reportData, setReportData] = useState({
        totalPointsAwarded: 0,
        totalPointsRedeemed: 0,
        recentReviews: [],
        topCustomers: []
    });
    const [pointSettings, setPointSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { profile, loading: profileLoading } = useProfile();

    useEffect(() => {
        const fetchReportData = async () => {
            try {
                setLoading(true);
                
                const reviewsQuery = query(
                    collection(db, 'reviews'),
                    where('pointsAwarded', '>', 0),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                );
                const customersQuery = query(
                    collection(db, 'customers'),
                    orderBy('points', 'desc'),
                    limit(10)
                );
                const pointSettingsRef = doc(db, 'settings', 'points');

                const [reviewsSnapshot, customersSnapshot, pointSettingsSnap] = await Promise.all([
                    getDocs(reviewsQuery),
                    getDocs(customersSnapshot),
                    getDoc(pointSettingsRef)
                ]);

                const recentReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const topCustomers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (pointSettingsSnap.exists()) {
                    setPointSettings(pointSettingsSnap.data());
                }

                let totalPointsAwarded = 0;
                recentReviews.forEach(review => {
                    totalPointsAwarded += review.pointsAwarded || 0;
                });

                let totalPointsRedeemed = 0;

                setReportData({
                    totalPointsAwarded,
                    totalPointsRedeemed,
                    recentReviews,
                    topCustomers
                });

            } catch (error) {
                console.error('Error fetching report data:', error);
                setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, []);

    if (loading || profileLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg">กำลังโหลดข้อมูล...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">รายงานระบบพ้อยต์</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-500 text-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-2">พ้อยต์ที่แจกออกไป</h3>
                    <p className="text-3xl font-bold">{reportData.totalPointsAwarded.toLocaleString()}</p>
                    <p className="text-sm opacity-80">จากการรีวิวล่าสุด</p>
                </div>
                
                <div className="bg-green-500 text-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-2">พ้อยต์ที่ถูกใช้</h3>
                    <p className="text-3xl font-bold">{reportData.totalPointsRedeemed.toLocaleString()}</p>
                    <p className="text-sm opacity-80">จากการแลกรางวัล</p>
                </div>
                
                <div className="bg-purple-500 text-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-2">ลูกค้าทั้งหมด</h3>
                    <p className="text-3xl font-bold">{reportData.topCustomers.length}</p>
                    <p className="text-sm opacity-80">ที่มีพ้อยต์</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">รีวิวล่าสุดที่ได้รับพ้อยต์</h2>
                    <div className="space-y-3">
                        {reportData.recentReviews.length > 0 ? (
                            reportData.recentReviews.map((review) => (
                                <div key={review.id} className="border-l-4 border-blue-400 pl-4 py-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-gray-800">{review.customerName}</p>
                                            <p className="text-sm text-gray-600">
                                                ⭐ {review.rating}/5 - {review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {review.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || 'วันที่ไม่ระบุ'}
                                            </p>
                                        </div>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-semibold">
                                            +{review.pointsAwarded} พ้อย
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500">ยังไม่มีรีวิวที่ได้รับพ้อยต์</p>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">ลูกค้าที่มีพ้อยต์สูงสุด</h2>
                    <div className="space-y-3">
                        {reportData.topCustomers.length > 0 ? (
                            reportData.topCustomers.map((customer, index) => (
                                <div key={customer.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                    <div className="flex items-center">
                                        <div className="bg-purple-100 text-purple-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm mr-3">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                {customer.fullName || customer.firstName || 'ไม่ระบุชื่อ'}
                                            </p>
                                            <p className="text-sm text-gray-600">{customer.phoneNumber || 'ไม่ระบุเบอร์'}</p>
                                        </div>
                                    </div>
                                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-bold">
                                        {(customer.points || 0).toLocaleString()} พ้อย
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500">ยังไม่มีข้อมูลลูกค้า</p>
                        )}
                    </div>
                </div>
            </div>

            {pointSettings && (
                <div className="mt-8 bg-gray-100 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">การตั้งค่าพ้อยต์ปัจจุบัน</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {pointSettings.enableReviewPoints && (
                            <div>
                                <p className="font-semibold text-gray-700">รีวิว</p>
                                <p className="text-gray-600">ได้รับ {pointSettings.reviewPoints} พ้อยต์ต่อครั้ง</p>
                            </div>
                        )}
                        {pointSettings.enablePurchasePoints && (
                            <div>
                                <p className="font-semibold text-gray-700">ยอดซื้อ</p>
                                <p className="text-gray-600">{pointSettings.pointsPerCurrency} {profile.currencySymbol} = 1 พ้อย</p>
                            </div>
                        )}
                        {pointSettings.enableVisitPoints && (
                            <div>
                                <p className="font-semibold text-gray-700">เข้าใช้บริการ</p>
                                <p className="text-gray-600">{pointSettings.pointsPerVisit} พ้อยต์ต่อครั้ง</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-4">
                        <a 
                            href="/admin/settings" 
                            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        >
                            แก้ไขการตั้งค่า
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}