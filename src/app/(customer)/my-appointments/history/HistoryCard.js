"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const statusConfig = {
    'completed': { text: 'เสร็จสมบูรณ์', color: 'bg-green-100 text-green-800' },
    'cancelled': { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

const HistoryCard = ({ appointment, onBookAgain }) => {
    const appointmentDateTime = appointment.appointmentInfo.dateTime.toDate();
    const statusInfo = statusConfig[appointment.status] || { text: appointment.status, color: 'bg-gray-100 text-gray-800' };

    return (
        <div className="bg-white rounded-2xl p-4 space-y-3 shadow">
            <div className="flex">
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-bold text-lg text-gray-800">{appointment.serviceInfo?.name}</h2>
                            <p className="text-sm text-gray-500">
                                {format(appointmentDateTime, 'dd MMM yyyy', { locale: th })}
                            </p>
                             <p className="font-bold text-md text-gray-400">{appointment.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} บาท</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                            {statusInfo.text}
                        </span>
                        
                    </div>
                </div>
            </div>

        </div>
    );
};

export default HistoryCard;