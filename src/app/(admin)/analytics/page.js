"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { useProfile } from '@/context/ProfileProvider';

// --- Helper Components ---

const AnalyticsCard = ({ title, value, subtext }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
);

const ChartContainer = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                {children}
            </ResponsiveContainer>
        </div>
    </div>
);

// --- Main Page ---

export default function AnalyticsPage() {
    const [appointments, setAppointments] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const appointmentsQuery = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
                const customersQuery = query(collection(db, 'customers'));
                const reviewsQuery = query(collection(db, 'reviews'));
                const servicesQuery = query(collection(db, 'services'));

                const [appointmentsSnapshot, customersSnapshot, reviewsSnapshot, servicesSnapshot] = await Promise.all([
                    getDocs(appointmentsQuery),
                    getDocs(customersQuery),
                    getDocs(reviewsQuery),
                    getDocs(servicesQuery),
                ]);

                const appointmentsData = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const reviewsData = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const servicesData = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setAppointments(appointmentsData);
                setCustomers(customersData);
                setReviews(reviewsData);
                setServices(servicesData);

            } catch (err) {
                console.error("Error fetching data: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analyticsData = useMemo(() => {
        if (loading) return null;

        // กรองนัดหมายตามช่วงวันที่
        const filteredAppointments = appointments.filter(a => {
            const date = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            return date >= dateRange.start && date <= dateRange.end;
        });

        // แยกสถานะ
        const completedAppointments = filteredAppointments.filter(a => a.status === 'completed');
        const cancelledAppointments = filteredAppointments.filter(a => a.status === 'cancelled');

        // สร้างข้อมูลรายวันแยกสถานะ
        const appointmentsByDay = { completed: {}, cancelled: {} };
        completedAppointments.forEach(a => {
            const day = format(a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt), 'yyyy-MM-dd');
            appointmentsByDay.completed[day] = (appointmentsByDay.completed[day] || 0) + 1;
        });
        cancelledAppointments.forEach(a => {
            const day = format(a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt), 'yyyy-MM-dd');
            appointmentsByDay.cancelled[day] = (appointmentsByDay.cancelled[day] || 0) + 1;
        });

        const appointmentChartData = eachDayOfInterval(dateRange).map(day => {
            const formattedDay = format(day, 'yyyy-MM-dd');
            return {
                name: format(day, 'dd/MM'),
                completed: appointmentsByDay.completed[formattedDay] || 0,
                cancelled: appointmentsByDay.cancelled[formattedDay] || 0,
            };
        });

        // รายได้เฉพาะที่สำเร็จ
        const paidAppointments = completedAppointments.filter(a => a.paymentInfo && a.paymentInfo.paymentStatus === 'paid');
        const revenueByDay = paidAppointments.reduce((acc, a) => {
            const paidAt = a.paymentInfo?.paidAt?.toDate ? a.paymentInfo.paidAt.toDate() : new Date(a.paymentInfo?.paidAt);
            const day = format(paidAt, 'yyyy-MM-dd');
            acc[day] = (acc[day] || 0) + (a.paymentInfo?.totalPrice || 0);
            return acc;
        }, {});
        const revenueChartData = eachDayOfInterval(dateRange).map(day => {
            const formattedDay = format(day, 'yyyy-MM-dd');
            return {
                name: format(day, 'dd/MM'),
                revenue: revenueByDay[formattedDay] || 0,
            };
        });
        const totalRevenue = paidAppointments.reduce((sum, a) => sum + (a.paymentInfo?.totalPrice || 0), 0);

        // Pie chart บริการยอดนิยม (เฉพาะที่สำเร็จ)
        const serviceTypeData = completedAppointments.reduce((acc, a) => {
            const type = a.serviceInfo?.name || 'Unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        const servicePieChartData = Object.keys(serviceTypeData).map(key => ({
            name: key,
            value: serviceTypeData[key]
        }));

        // --- สรุปข้อมูลแต่ละบริการ ---
        const serviceSummary = {};
        filteredAppointments.forEach(a => {
            const serviceName = a.serviceInfo?.name || a.serviceName || 'Unknown';
            if (!serviceSummary[serviceName]) {
                serviceSummary[serviceName] = {
                    completed: 0,
                    cancelled: 0,
                    revenue: 0
                };
            }
            if (a.status === 'completed') {
                serviceSummary[serviceName].completed += 1;
                if (a.paymentInfo && a.paymentInfo.paymentStatus === 'paid') {
                    serviceSummary[serviceName].revenue += a.paymentInfo.totalPrice || 0;
                }
            }
            if (a.status === 'cancelled') {
                serviceSummary[serviceName].cancelled += 1;
            }
        });
        // ยอดรวมทุกบริการ
        const totalServiceRevenue = Object.values(serviceSummary).reduce((sum, s) => sum + s.revenue, 0);

        const averageRating = reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
            : 'N/A';

        return {
            totalAppointments: filteredAppointments.length,
            completedAppointments: completedAppointments.length,
            cancelledAppointments: cancelledAppointments.length,
            totalRevenue,
            averageRating,
            appointmentChartData,
            revenueChartData,
            servicePieChartData,
            reviewCount: reviews.length,
            serviceSummary,
            totalServiceRevenue,
        };
    }, [loading, appointments, reviews, dateRange]);
    
    const exportToCSV = () => {
        const headers = ['Appointment ID', 'Customer Name', 'Service', 'Date/Time', 'Total Price', 'Payment Status', 'Status', 'Note'];
        const rows = appointments.map(a => {
            const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`
            return [
                a.id,
                escapeCSV(a.customerInfo?.fullName || a.customerInfo?.name || ''),
                escapeCSV(a.serviceInfo?.name || a.serviceName || ''),
                a.appointmentInfo?.dateTime?.toDate ? a.appointmentInfo.dateTime.toDate().toLocaleString('th-TH') : '',
                a.paymentInfo?.totalPrice || '',
                a.paymentInfo?.paymentStatus || '',
                a.status || '',
                escapeCSV(a.customerInfo?.note || a.note || '')
            ].join(',');
        });
        const bom = '\uFEFF';
        const csvContent = bom + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `appointments_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({...prev, [name]: parseISO(value) }));
    };

    if (loading || profileLoading) return <div className="text-center mt-20">กำลังโหลดและวิเคราะห์ข้อมูล...</div>;
    if (!analyticsData) return <div className="text-center mt-20">ไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์</div>;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">หน้าวิเคราะห์ข้อมูล</h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input type="date" name="start" onChange={handleDateChange} value={format(dateRange.start, 'yyyy-MM-dd')} className="p-2 border rounded-md"/>
                        <span>ถึง</span>
                        <input type="date" name="end" onChange={handleDateChange} value={format(dateRange.end, 'yyyy-MM-dd')} className="p-2 border rounded-md"/>
                    </div>
                    <button 
                        onClick={exportToCSV}
                        className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-green-700"
                    >
                        Export to CSV
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnalyticsCard title="ยอดนัดหมายทั้งหมด" value={analyticsData.totalAppointments.toLocaleString()} subtext={`ในช่วงเวลาที่เลือก`} />
                <AnalyticsCard 
                    title="นัดหมายสำเร็จ/ยกเลิก"
                    value={`${analyticsData.completedAppointments.toLocaleString()} / ${analyticsData.cancelledAppointments.toLocaleString()}`}
                    subtext={`สำเร็จ / ยกเลิก`}
                />
                <AnalyticsCard title="รายได้รวม" value={`${analyticsData.totalRevenue.toLocaleString()}`} subtext={profile.currencySymbol} />
                <AnalyticsCard title="คะแนนรีวิวเฉลี่ย" value={`${analyticsData.averageRating} ★`} subtext={`จาก ${analyticsData.reviewCount} รีวิว`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* กราฟ 2 ช่อง */}
                <div className="grid grid-cols-1 gap-6">
                    <ChartContainer title="ยอดนัดหมายรายวัน (แยกสถานะ)">
                        <BarChart data={analyticsData.appointmentChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="completed" fill="#4ade80" name="สำเร็จ" />
                            <Bar dataKey="cancelled" fill="#f87171" name="ยกเลิก" />
                        </BarChart>
                    </ChartContainer>

                    <ChartContainer title={`รายได้รายวัน (${profile.currencySymbol})`}>
                        <LineChart data={analyticsData.revenueChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={(value) => value.toLocaleString()} />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#82ca9d" name="รายได้"/>
                        </LineChart>
                    </ChartContainer>

                    <ChartContainer title="บริการยอดนิยม">
                        <PieChart>
                            <Pie data={analyticsData.servicePieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {analyticsData.servicePieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ChartContainer>
                </div>

                {/* ตารางสรุปบริการ */}
                <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-start h-full min-h-[300px]">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">สรุปบริการ</h3>
                    <table className="w-full text-sm mb-6">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="py-2 px-2 text-left">บริการ</th>
                                <th className="py-2 px-2 text-center">จอง</th>
                                <th className="py-2 px-2 text-center">ยกเลิก</th>
                                <th className="py-2 px-2 text-right">ยอดเงิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(analyticsData.serviceSummary).map(([service, info]) => (
                                <tr key={service} className="border-b">
                                    <td className="py-2 px-2 font-medium text-slate-800">{service}</td>
                                    <td className="py-2 px-2 text-center text-green-600 font-bold">{info.completed}</td>
                                    <td className="py-2 px-2 text-center text-red-500 font-bold">{info.cancelled}</td>
                                    <td className="py-2 px-2 text-right text-blue-700 font-bold">{info.revenue.toLocaleString()} {profile.currencySymbol}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="font-bold text-lg text-blue-700 mt-2 text-center">ยอดรวมทั้งหมด: {analyticsData.totalServiceRevenue.toLocaleString()} {profile.currencySymbol}</div>
                </div>
            </div>
        </div>
    );
}
