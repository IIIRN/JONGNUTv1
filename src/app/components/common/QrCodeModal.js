"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { generateQrCodeFromText } from '@/app/actions/paymentActions';

const QrCodeModal = ({ show, onClose, appointmentId }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && appointmentId) {
            const generateQR = async () => {
                setLoading(true);
                try {
                    const url = await generateQrCodeFromText(appointmentId);
                    setQrCodeUrl(url);
                } catch (error) {
                    console.error("Error generating QR code:", error);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointmentId]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-2 text-gray-800">Appointment QR Code</h2>
                <p className="text-sm text-gray-500 mb-4">แสดง QR Code นี้ให้ช่างเสริมสวย</p>
                {loading ? (
                    <div className="h-48 flex items-center justify-center"><p>กำลังสร้าง QR Code...</p></div>
                ) : (
                    <div className="flex justify-center">
                        {qrCodeUrl && <Image src={qrCodeUrl} alt="Appointment QR Code" width={256} height={256} />}
                    </div>
                )}
                <button onClick={onClose} className="mt-4 w-full bg-gray-200 text-gray-800 py-2 rounded-xl font-semibold">ปิด</button>
            </div>
        </div>
    );
};

export default QrCodeModal;

