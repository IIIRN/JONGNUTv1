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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-purple-400 to-pink-300 p-4 text-white">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-sm opacity-90">นัดหมาย</div>
                        <div className="font-bold text-base">{format(appointmentDateTime, 'dd/MM/yyyy HH:mm')} น</div>
                    </div>
                    <button 
                        onClick={() => onQrCodeClick(job.id)} 
                        className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium text-sm border border-white/30"
                    >
                        QR CODE
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4">
                {/* Price Details */}
                <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{job.serviceInfo?.name}</span>
                        <span className="text-gray-800">({job.appointmentInfo?.duration || 45} นาที | {formatPrice(job.paymentInfo?.basePrice || 6600)})</span>
                    </div>
                    {job.appointmentInfo?.addOns?.length > 0 && job.appointmentInfo.addOns.map((addon, index) => (
                        <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-600">{addon.name}</span>
                            <span className="text-gray-800">({addon.duration || 25} นาที | {formatPrice(addon.price || 200)})</span>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div className="border-t pt-3 mb-4">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800">รวม</span>
                        <span className="font-bold text-lg text-gray-800">({job.appointmentInfo?.duration || 70} นาที | {formatPrice(job.paymentInfo?.totalPrice || 6800)})</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex-1 bg-purple-400 text-white py-3 rounded-xl font-semibold"
                    >
                        ยืนยัน
                    </button>
                    {job.status === 'awaiting_confirmation' && (
                        <button 
                            onClick={() => onCancelClick(job)}
                            className="flex-1 bg-pink-300 text-white py-3 rounded-xl font-semibold"
                        >
                            ยกเลิก
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;