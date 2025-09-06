'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export default function LineUsersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCustomersWithLineId();
    }, []);

    const fetchCustomersWithLineId = async () => {
        try {
            setLoading(true);
            
            // Query customers who have LINE User ID
            const customersRef = collection(db, 'customers');
            const snapshot = await getDocs(customersRef);
            
            const customersData = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.lineUserId) {
                    customersData.push({
                        id: doc.id,
                        ...data
                    });
                }
            });

            // Sort by last activity or name
            customersData.sort((a, b) => {
                if (a.fullName && b.fullName) {
                    return a.fullName.localeCompare(b.fullName, 'th');
                }
                return 0;
            });

            setCustomers(customersData);
        } catch (error) {
            console.error('Error fetching customers with LINE ID:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(customer => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (customer.fullName && customer.fullName.toLowerCase().includes(searchLower)) ||
            (customer.firstName && customer.firstName.toLowerCase().includes(searchLower)) ||
            (customer.lastName && customer.lastName.toLowerCase().includes(searchLower)) ||
            (customer.lineUserId && customer.lineUserId.toLowerCase().includes(searchLower)) ||
            (customer.phone && customer.phone.includes(searchTerm))
        );
    });

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            // You could add a toast notification here
            alert('คัดลอกแล้ว!');
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900">
                        👥 ลูกค้าที่มี LINE User ID
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                        รายชื่อลูกค้าที่สามารถใช้ทดสอบ Flex Messages ได้
                    </p>
                </div>

                {/* Search */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="ค้นหาด้วยชื่อ, เบอร์โทร, หรือ LINE User ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-sm text-gray-600">
                        พบ {filteredCustomers.length} คน จากทั้งหมด {customers.length} คน
                    </p>
                </div>

                {/* Customer List */}
                <div className="divide-y divide-gray-200">
                    {filteredCustomers.length === 0 ? (
                        <div className="px-6 py-8 text-center">
                            <p className="text-gray-500">
                                {searchTerm ? 'ไม่พบลูกค้าที่ตรงกับการค้นหา' : 'ไม่มีลูกค้าที่มี LINE User ID'}
                            </p>
                        </div>
                    ) : (
                        filteredCustomers.map((customer) => (
                            <div key={customer.id} className="px-6 py-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-shrink-0">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <span className="text-blue-600 font-medium text-sm">
                                                        {(customer.fullName || customer.firstName || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'ไม่ระบุชื่อ'}
                                                </p>
                                                <div className="flex items-center space-x-4 mt-1">
                                                    {customer.phone && (
                                                        <p className="text-sm text-gray-500">
                                                            📞 {customer.phone}
                                                        </p>
                                                    )}
                                                    {customer.email && (
                                                        <p className="text-sm text-gray-500">
                                                            ✉️ {customer.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="text-right">
                                            <p className="text-xs font-medium text-gray-900 mb-1">LINE User ID</p>
                                            <div className="flex items-center space-x-2">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono">
                                                    {customer.lineUserId}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(customer.lineUserId)}
                                                    className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                                                    title="คัดลอก LINE User ID"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <a
                                            href={`/test-flex?userId=${customer.lineUserId}&name=${encodeURIComponent(customer.fullName || customer.firstName || 'ลูกค้า')}`}
                                            className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            ทดสอบ
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Quick Links */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex justify-center space-x-4">
                        <a
                            href="/test-flex"
                            className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            🧪 ไปหน้าทดสอบ Flex Messages
                        </a>
                        <a
                            href="/customers"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            👥 จัดการลูกค้า
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
