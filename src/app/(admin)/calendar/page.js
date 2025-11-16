"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays } from "date-fns";
import { db } from "@/app/lib/firebase";
import { useToast } from "@/app/components/Toast";

const statusStyles = {
  awaiting_confirmation: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const formatDateKey = (date) => format(date, "yyyy-MM-dd");

export default function CalendarPage() {
  const { showToast } = useToast();
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const monthStart = startOfMonth(activeMonth);
        const monthEnd = endOfMonth(activeMonth);
        const startStr = formatDateKey(monthStart);
        const endStr = formatDateKey(monthEnd);

        const appointmentsQuery = query(
          collection(db, "appointments"),
          orderBy("date"),
          where("date", ">=", startStr),
          where("date", "<=", endStr)
        );

        const snapshot = await getDocs(appointmentsQuery);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAppointments(data);

        const selectedDateObj = new Date(selectedDate);
        if (
          selectedDateObj.getMonth() !== activeMonth.getMonth() ||
          selectedDateObj.getFullYear() !== activeMonth.getFullYear()
        ) {
          setSelectedDate(formatDateKey(activeMonth));
        }
      } catch (error) {
        console.error("Error loading calendar appointments", error);
        showToast("ไม่สามารถโหลดข้อมูลการจองได้", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [activeMonth, selectedDate, showToast]);

  const appointmentsByDate = useMemo(() => {
    return appointments.reduce((acc, appointment) => {
      if (!appointment.date) return acc;
      const key = appointment.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(appointment);
      return acc;
    }, {});
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = startOfMonth(activeMonth);
    const startDay = addDays(firstDayOfMonth, -firstDayOfMonth.getDay()); // start from Sunday
    return Array.from({ length: 42 }, (_, idx) => {
      const date = addDays(startDay, idx);
      const dateKey = formatDateKey(date);
      const isCurrentMonth = date.getMonth() === activeMonth.getMonth();
      const isToday = dateKey === formatDateKey(new Date());
      return {
        date,
        dateKey,
        isCurrentMonth,
        isToday,
        appointments: appointmentsByDate[dateKey] || [],
      };
    });
  }, [activeMonth, appointmentsByDate]);

  const selectedAppointments = appointmentsByDate[selectedDate] || [];

  return (
    <div className="container mx-auto p-4 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 bg-white border rounded-xl shadow-sm p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">ปฏิทินการจอง</p>
              <h1 className="text-2xl font-semibold text-gray-800">
                {activeMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveMonth((prev) => subMonths(prev, 1))}
                className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                <span className="sr-only">เดือนก่อนหน้า</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setActiveMonth((prev) => addMonths(prev, 1))}
                className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                <span className="sr-only">เดือนถัดไป</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mt-6 text-center text-sm font-semibold text-gray-500">
            {"อา จ อ พ พฤ ศ ส".split(" ").map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2 mt-4">
              {calendarDays.map(({ date, dateKey, isCurrentMonth, isToday, appointments }) => {
                const isSelected = selectedDate === dateKey;
                const totalAppointments = appointments.length;
                const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
                return (
                  <button
                    key={dateKey}
                    onClick={() => {
                      setSelectedDate(dateKey);
                    }}
                    className={`p-2 rounded-xl text-left border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50"
                        : isCurrentMonth
                        ? "border-gray-200 bg-white"
                        : "border-dashed border-gray-200 bg-gray-50 text-gray-400"
                    } ${isToday ? "ring-1 ring-indigo-400" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${!isCurrentMonth ? "text-gray-400" : "text-gray-700"}`}>
                        {date.getDate()}
                      </span>
                      {totalAppointments > 0 && (
                        <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {totalAppointments}
                        </span>
                      )}
                    </div>
                    {totalAppointments > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-indigo-100">
                          <div
                            className="h-1.5 rounded-full bg-indigo-500"
                            style={{ width: `${(confirmedCount / totalAppointments) * 100 || 0}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>ยืนยัน {confirmedCount}</span>
                          <span>รวม {totalAppointments}</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 bg-white border rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">รายการในวัน</p>
              <h2 className="text-lg font-semibold text-gray-800">
                {selectedDate ? new Date(selectedDate).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "-"}
              </h2>
            </div>
          </div>

          {selectedAppointments.length === 0 ? (
            <div className="text-center text-gray-500 border border-dashed rounded-lg p-6">
              ไม่มีการนัดหมายในวันนี้
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {selectedAppointments
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                .map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">{appointment.time || "--:--"}</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[appointment.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {appointment.status || "-"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {appointment.customerInfo?.fullName || "ลูกค้าไม่ระบุ"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {appointment.serviceInfo?.name || "บริการไม่ระบุ"}
                    </p>
                    {appointment.technicianInfo?.firstName && (
                      <p className="text-xs text-gray-500 mt-1">
                        ช่าง: {appointment.technicianInfo.firstName} {appointment.technicianInfo.lastName || ""}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
