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

        const filteredAppointments = appointments.filter(a => {
            const date = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            return date >= dateRange.start && date <= dateRange.end;
        });

        const appointmentsByDay = filteredAppointments.reduce((acc, a) => {
            const day = format(a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt), 'yyyy-MM-dd');
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});
        const appointmentChartData = eachDayOfInterval(dateRange).map(day => {
            const formattedDay = format(day, 'yyyy-MM-dd');
            return {
                name: format(day, 'dd/MM'),
                appointments: appointmentsByDay[formattedDay] || 0,
            };
        });

        const paidAppointments = filteredAppointments.filter(a => a.paymentInfo && a.paymentInfo.paymentStatus === 'paid');
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

        const serviceTypeData = filteredAppointments.reduce((acc, a) => {
            const type = a.serviceInfo?.name || 'Unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        const servicePieChartData = Object.keys(serviceTypeData).map(key => ({
            name: key,
            value: serviceTypeData[key]
        }));

        const averageRating = reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
            : 'N/A';

        return {
            totalAppointments: filteredAppointments.length,
            totalRevenue,
            averageRating,
            appointmentChartData,
            revenueChartData,
            servicePieChartData,
            reviewCount: reviews.length,
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
                 <AnalyticsCard title="ยอดนัดหมาย" value={analyticsData.totalAppointments.toLocaleString()} subtext={`ในช่วงเวลาที่เลือก`} />
                <AnalyticsCard title="รายได้รวม" value={`${analyticsData.totalRevenue.toLocaleString()}`} subtext={profile.currencySymbol} />
                <AnalyticsCard title="คะแนนรีวิวเฉลี่ย" value={`${analyticsData.averageRating} ★`} subtext={`จาก ${analyticsData.reviewCount} รีวิว`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <ChartContainer title="ยอดนัดหมายรายวัน">
                    <BarChart data={analyticsData.appointmentChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="appointments" fill="#8884d8" name="จำนวนการนัดหมาย" />
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
        </div>
    );
}
