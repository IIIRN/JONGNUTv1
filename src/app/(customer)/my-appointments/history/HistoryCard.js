"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

const statusConfig = {
    'completed': { text: 'เสร็จสมบูรณ์', color: 'bg-green-100 text-green-800' },
    'cancelled': { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

const HistoryCard = ({ appointment, onBookAgain }) => {
    const { profile } = useProfile();
    const appointmentDateTime = appointment.appointmentInfo.dateTime.toDate();
    const statusInfo = statusConfig[appointment.status] || { text: appointment.status, color: 'bg-gray-100 text-gray-800' };

    return (
        <div className="bg-white rounded-2xl p-4 space-y-3 shadow">
            <div className="flex">
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <h2 className="font-bold text-md text-gray-800">{appointment.serviceInfo?.name}</h2>
                            
                            {/* Multi-area service details */}
                            {appointment.serviceInfo?.serviceType === 'multi-area' && (
                                <div className="mt-1 space-y-0.5">
                                    {appointment.serviceInfo?.selectedArea && (
                                        <div className="text-xs text-primary font-medium">
                                            📍 {appointment.serviceInfo.selectedArea.name}
                                        </div>
                                    )}
                                    {appointment.serviceInfo?.selectedPackage && (
                                        <div className="text-xs text-gray-600">
                                            📦 {appointment.serviceInfo.selectedPackage.name} ({appointment.serviceInfo.selectedPackage.duration} นาที)
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <p className="text-sm text-gray-500 mt-1">
                                {format(appointmentDateTime, 'dd MMM yyyy', { locale: th })}
                            </p>
                             <p className="font-bold text-md text-gray-400">{appointment.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} {profile.currencySymbol}</p>
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

