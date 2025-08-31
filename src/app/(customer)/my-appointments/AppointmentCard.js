"use client";

import { useState } from 'react';
import { format } from 'date-fns';

const statusConfig = {
    'awaiting_confirmation': { text: 'รอยืนยัน' },
    'confirmed': { text: 'ยืนยันแล้ว' },
};

const AppointmentCard = ({ job, onQrCodeClick, onCancelClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getBeauticianDisplayName = () => {
        const b = job.beauticianInfo || job.appointmentInfo?.beauticianInfo || null;
        if (!b) return job.appointmentInfo?.beauticianName || job.beauticianName || 'N/A';
        if (b.name) return b.name;
        const first = b.firstName || '';
        const last = b.lastName || '';
        return `${first} ${last}`.trim() || 'N/A';
    };

    const formatPrice = (val) => {
        if (val == null) return 'N/A';
        return Number(val).toLocaleString();
    };

    const parseDate = (d) => {
        if (!d) return new Date();
        return d.toDate ? d.toDate() : new Date(d);
    };

    const appointmentDateTime = parseDate(job?.appointmentInfo?.dateTime);
    const statusInfo = statusConfig[job.status] || { text: job.status };

    return (
        <div className="rounded-2xl overflow-hidden shadow">
            <div className="p-4 bg-gradient-to-r from-purple-500 to-indigo-400 text-white">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-sm opacity-90">นัดหมาย</div>
                        <div className="font-bold text-lg">{job.serviceInfo?.name}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs opacity-90">คิว</div>
                        <div className="mt-1 bg-white/20 px-3 py-1 rounded-full font-semibold">{job.queueNumber || '-'}</div>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                    <div className="text-sm opacity-90">{format(appointmentDateTime, 'dd/MM/yyyy HH:mm')}</div>
                    <button onClick={() => onQrCodeClick(job.id)} className="bg-white text-purple-700 px-5 py-2 rounded-full font-semibold">QR CODE</button>
                </div>
            </div>

            <div className="bg-white p-4">
                <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-700">ช่าง: {getBeauticianDisplayName()}</div>
                    <div className="text-sm font-bold text-gray-800">{formatPrice(job.paymentInfo?.totalPrice)} บาท</div>
                </div>

                <div className="mt-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-600">สถานะ: {statusInfo.text}</div>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setIsExpanded(!isExpanded)} className="bg-pink-500 text-white font-semibold py-2 px-4 rounded-xl text-sm">{isExpanded ? 'ซ่อน' : 'ดูสถานที่'}</button>
                            {job.status === 'awaiting_confirmation' && (
                                <button onClick={() => onCancelClick(job)} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-xl text-sm">ยกเลิก</button>
                            )}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="border-t mt-3 pt-3">
                        {job.locationInfo?.name ? (
                            <>
                                <h3 className="font-bold text-md mb-2">สถานที่ให้บริการ</h3>
                                <div className="text-sm space-y-1">
                                    <p><strong>ชื่อ:</strong> {job.locationInfo.name}</p>
                                    <p><strong>ที่อยู่:</strong> {job.locationInfo.address || 'ไม่มีข้อมูลที่อยู่'}</p>
                                </div>
                            </>
                        ) : <p>ไม่พบข้อมูลสถานที่</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppointmentCard;