// src/app/(customer)/my-appointments/AppointmentCard.js
"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const AppointmentCard = ({ job, onQrCodeClick, onCancelClick, onConfirmClick, isConfirming }) => {
    const statusInfo = {
        'awaiting_confirmation': { text: 'รอยืนยัน' },
        'confirmed': { text: 'ยืนยันแล้ว' },
        'in_progress': { text: 'กำลังใช้บริการ' },
    }[job.status] || { text: job.status };

    const appointmentDateTime = job.appointmentInfo.dateTime.toDate();
    const addOns = job.appointmentInfo?.addOns || [];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header Section */}
            <div className="bg-primary p-4 text-white">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-sm opacity-90">นัดหมายบริการ</div>
                        <div className="font-semibold">{format(appointmentDateTime, 'dd MMMM yyyy, HH:mm น.', { locale: th })}</div>
                    </div>
                    <div className="text-sm font-semibold">{statusInfo.text}</div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4">
                {/* Main Service */}
                <div className="flex justify-between items-start text-sm mb-2">
                    <span className="font-semibold text-gray-800">{job.serviceInfo?.name}</span>
                    <span className="text-gray-700">{job.paymentInfo?.basePrice?.toLocaleString()} บาท</span>
                </div>

                {/* Add-on Services */}
                {addOns.length > 0 && (
                    <div className="space-y-1 text-sm text-gray-600 mb-3 pl-4 border-l-2">
                        {addOns.map((addon, index) => (
                            <div key={index} className="flex justify-between">
                                <span>+ {addon.name}</span>
                                <span>{addon.price?.toLocaleString()} บาท</span>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Total Price */}
                <div className="border-t pt-3 mb-4">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-black">ราคารวม</span>
                        <span className="font-bold text-lg text-black">{job.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} บาท</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <button 
                        onClick={() => onQrCodeClick(job.id)}
                        className="bg-primary-dark text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-slate-600 transition-colors"
                    >
                        QR Code
                    </button>
                    <div className="flex space-x-2">
                        {job.status === 'awaiting_confirmation' && (
                            <button 
                                onClick={() => onConfirmClick(job)}
                                disabled={isConfirming}
                                className=" bg-primary text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors disabled:bg-gray-400"
                            >
                                {isConfirming ? '...' : 'ยืนยัน'}
                            </button>
                        )}
                         {job.status === 'confirmed' && (
                            <button 
                                className="bg-success text-white py-2 px-4 rounded-lg font-semibold text-sm cursor-not-allowed"
                                disabled
                            >
                                ยืนยันแล้ว
                            </button>
                        )}
                        {job.status !== 'in_progress' && (
                            <button 
                                onClick={() => onCancelClick(job)}
                                className="bg-error text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-red-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;