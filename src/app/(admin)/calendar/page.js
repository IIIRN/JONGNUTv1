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

const statusLabels = {
  awaiting_confirmation: "รอยืนยัน",
  pending: "รออนุมัติ",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const formatDateKey = (date) => format(date, "yyyy-MM-dd");

export default function CalendarPage() {
  const { showToast } = useToast();
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" or "timeline"

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

  // Timeline helpers
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 9; hour <= 21; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const timeToPosition = (timeStr) => {
    const minutes = parseTime(timeStr);
    const startMinutes = 9 * 60; // 9:00
    const totalMinutes = 12 * 60; // 9:00 to 21:00 = 12 hours
    return ((minutes - startMinutes) / totalMinutes) * 100;
  };

  const durationToHeight = (duration) => {
    const totalMinutes = 12 * 60;
    return (duration / totalMinutes) * 100;
  };

  const technicians = useMemo(() => {
    const techMap = new Map();
    selectedAppointments.forEach((apt) => {
      if (apt.technicianInfo?.id) {
        const techId = apt.technicianInfo.id;
        if (!techMap.has(techId)) {
          techMap.set(techId, {
            id: techId,
            name: `${apt.technicianInfo.firstName || ''} ${apt.technicianInfo.lastName || ''}`.trim(),
          });
        }
      }
    });
    // If no technician, create a default column
    if (techMap.size === 0) {
      techMap.set('default', { id: 'default', name: 'ทั้งหมด' });
    }
    return Array.from(techMap.values());
  }, [selectedAppointments]);

  const appointmentsByTechnician = useMemo(() => {
    const byTech = {};
    technicians.forEach((tech) => {
      byTech[tech.id] = [];
    });
    selectedAppointments.forEach((apt) => {
      const techId = apt.technicianInfo?.id || 'default';
      if (byTech[techId]) {
        byTech[techId].push(apt);
      }
    });

    // Calculate overlap columns for each technician
    Object.keys(byTech).forEach((techId) => {
      const appointments = byTech[techId];
      appointments.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      appointments.forEach((apt, idx) => {
        const aptStart = parseTime(apt.time || '09:00');
        const aptEnd = aptStart + (apt.serviceInfo?.duration || 60);
        
        // Find overlapping appointments
        const overlapping = [];
        appointments.forEach((other, otherIdx) => {
          if (idx === otherIdx) return;
          const otherStart = parseTime(other.time || '09:00');
          const otherEnd = otherStart + (other.serviceInfo?.duration || 60);
          
          // Check if they overlap
          if (aptStart < otherEnd && aptEnd > otherStart) {
            overlapping.push(otherIdx);
          }
        });

        // Assign column based on overlaps
        apt._column = 0;
        apt._totalColumns = overlapping.length + 1;
        
        // Find available column
        const usedColumns = new Set();
        overlapping.forEach(otherIdx => {
          if (appointments[otherIdx]._column !== undefined) {
            usedColumns.add(appointments[otherIdx]._column);
          }
        });
        
        for (let col = 0; col < apt._totalColumns; col++) {
          if (!usedColumns.has(col)) {
            apt._column = col;
            break;
          }
        }
      });
    });

    return byTech;
  }, [selectedAppointments, technicians]);

  return (
    <div className="container mx-auto p-4 lg:p-8">
      {/* View Mode Toggle */}
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === "calendar"
                ? "bg-indigo-600 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            ปฏิทิน
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === "timeline"
                ? "bg-indigo-600 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            เส้นเวลา
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
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
                    className={`p-2 rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isSelected
                        ? "border-2 border-indigo-600 !bg-indigo-50 shadow-lg"
                        : isCurrentMonth
                        ? "border border-gray-200 bg-white hover:bg-gray-50"
                        : "border-dashed border-gray-200 bg-gray-50 text-gray-400"
                    } ${isToday && !isSelected ? "ring ring-yellow-400" : ""}`}
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
                  <a
                    key={appointment.id}
                    href={`/appointments/${appointment.id}`}
                    className="block border rounded-lg p-3 shadow-sm hover:bg-indigo-50 transition cursor-pointer"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {(() => {
                          const start = appointment.time || "--:--";
                          const duration = appointment.serviceInfo?.duration || 60;
                          if (!appointment.time) return start;
                          const [h, m] = appointment.time.split(":").map(Number);
                          const startMinutes = h * 60 + m;
                          const endMinutes = startMinutes + duration;
                          const endH = Math.floor(endMinutes / 60) % 24;
                          const endM = endMinutes % 60;
                          const pad = n => n.toString().padStart(2, "0");
                          return `${pad(h)}:${pad(m)} - ${pad(endH)}:${pad(endM)} (${duration} นาที)`;
                        })()}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusStyles[appointment.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {statusLabels[appointment.status] || "-"}
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
                  </a>
                ))}
            </div>
          )}
        </div>
      </div>
      ) : (
        /* Timeline View */
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">เส้นเวลาการจอง</p>
              <h2 className="text-lg font-semibold text-gray-800">
                {selectedDate ? new Date(selectedDate).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "-"}
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const currentDate = new Date(selectedDate);
                  const prevDate = addDays(currentDate, -1);
                  setSelectedDate(formatDateKey(prevDate));
                  if (prevDate.getMonth() !== activeMonth.getMonth()) {
                    setActiveMonth(startOfMonth(prevDate));
                  }
                }}
                className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                <span className="sr-only">วันก่อนหน้า</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentDate = new Date(selectedDate);
                  const nextDate = addDays(currentDate, 1);
                  setSelectedDate(formatDateKey(nextDate));
                  if (nextDate.getMonth() !== activeMonth.getMonth()) {
                    setActiveMonth(startOfMonth(nextDate));
                  }
                }}
                className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                <span className="sr-only">วันถัดไป</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {selectedAppointments.length === 0 ? (
            <div className="text-center text-gray-500 border border-dashed rounded-lg p-12">
              ไม่มีการนัดหมายในวันนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Header */}
                <div className="flex border-b">
                  <div className="w-20 flex-shrink-0 border-r bg-gray-50 p-2">
                    <span className="text-xs font-semibold text-gray-600">เวลา</span>
                  </div>
                  {technicians.map((tech) => (
                    <div key={tech.id} className="flex-1 min-w-[200px] border-r last:border-r-0 bg-gray-50 p-2">
                      <span className="text-sm font-semibold text-gray-700">{tech.name}</span>
                    </div>
                  ))}
                </div>

                {/* Timeline Grid */}
                <div className="relative flex">
                  {/* Time Labels */}
                  <div className="w-20 flex-shrink-0 border-r">
                    {timeSlots.map((time) => (
                      <div key={time} className="h-20 border-b flex items-start justify-end pr-2 pt-1">
                        <span className="text-xs text-gray-500">{time}</span>
                      </div>
                    ))}
                  </div>

                  {/* Technician Columns */}
                  {technicians.map((tech) => (
                    <div key={tech.id} className="flex-1 min-w-[200px] border-r last:border-r-0 relative">
                      {/* Time slot backgrounds */}
                      {timeSlots.map((time) => (
                        <div key={time} className="h-20 border-b" />
                      ))}

                      {/* Appointment blocks */}
                      <div className="absolute inset-0 pointer-events-none">
                        {appointmentsByTechnician[tech.id]?.map((appointment) => {
                          const duration = appointment.serviceInfo?.duration || 60;
                          const top = timeToPosition(appointment.time || "09:00");
                          const height = durationToHeight(duration);
                          const statusClass = statusStyles[appointment.status] || "bg-gray-100 text-gray-700 border-gray-300";
                          // Calculate position for overlapping appointments
                          const column = appointment._column || 0;
                          const totalColumns = appointment._totalColumns || 1;
                          const widthPercent = 100 / totalColumns;
                          const leftPercent = (column * widthPercent);

                          return (
                            <div
                              key={appointment.id}
                              className={`absolute rounded-lg border-2 p-2 shadow-sm pointer-events-auto cursor-pointer hover:shadow-md transition-shadow ${statusClass}`}
                              style={{
                                top: `${top}%`,
                                height: `${height}%`,
                                left: `${leftPercent}%`,
                                width: `${widthPercent - 1}%`,
                                minHeight: '60px',
                              }}
                              title={`${appointment.customerInfo?.fullName || 'ลูกค้า'} - ${appointment.serviceInfo?.name || 'บริการ'}`}
                            >
                              <div className="text-xs font-semibold mb-1">
                                {appointment.time || "--:--"} ({duration} นาที)
                              </div>
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {appointment.customerInfo?.fullName || "ลูกค้าไม่ระบุ"}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {appointment.serviceInfo?.name || "บริการไม่ระบุ"}
                              </div>
                              <div className="text-xs mt-1">
                                <span className={`px-2 py-0.5 rounded-full border ${statusClass}`}>{statusLabels[appointment.status] || "-"}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
