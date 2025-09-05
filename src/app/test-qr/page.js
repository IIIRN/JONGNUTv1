// src/app/test-qr/page.js
"use client";

import React, { useState } from 'react';
import { generateQrCodePayload, testPromptPayPayload } from '@/app/actions/paymentActions';
import Image from 'next/image';

export default function TestQRPage() {
    const [promptPayId, setPromptPayId] = useState('0623733306');
    const [amount, setAmount] = useState('100.00');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [debugInfo, setDebugInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerateQR = async () => {
        setLoading(true);
        setError('');
        try {
            const qrUrl = await generateQrCodePayload(promptPayId, parseFloat(amount));
            setQrCodeDataUrl(qrUrl);
            
            const testResult = await testPromptPayPayload(promptPayId, parseFloat(amount));
            setDebugInfo(testResult);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">ทดสอบ QR Code PromptPay</h1>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            เลขพร้อมเพย์
                        </label>
                        <input
                            type="text"
                            value={promptPayId}
                            onChange={(e) => setPromptPayId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="เบอร์โทรหรือเลขบัตรประชาชน"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            จำนวนเงิน (บาท)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="0.00"
                        />
                    </div>
                    
                    <button
                        onClick={handleGenerateQR}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {loading ? 'กำลังสร้าง...' : 'สร้าง QR Code'}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700">
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {qrCodeDataUrl && (
                    <div className="mt-6 text-center">
                        <h3 className="text-lg font-semibold mb-2">QR Code PromptPay</h3>
                        <div className="flex justify-center mb-2">
                            <Image 
                                src={qrCodeDataUrl} 
                                alt="PromptPay QR Code" 
                                width={250} 
                                height={250} 
                                className="border-2 border-gray-200 rounded-lg"
                            />
                        </div>
                        <p className="text-gray-600 text-sm">
                            ทดสอบสแกนด้วยแอปธนาคาร
                        </p>
                    </div>
                )}

                {debugInfo && (
                    <div className="mt-4 bg-gray-50 p-3 rounded-lg">
                        <h4 className="font-semibold mb-2">ข้อมูลการตรวจสอบ</h4>
                        <div className="text-xs space-y-1">
                            <p><strong>Payload:</strong></p>
                            <p className="font-mono bg-white p-2 rounded break-all">
                                {debugInfo.payload}
                            </p>
                            <div className="mt-2">
                                <strong>การตรวจสอบ:</strong>
                                {Object.entries(debugInfo.validations).map(([key, value]) => (
                                    <div key={key} className={`${value ? 'text-green-600' : 'text-red-600'}`}>
                                        {key}: {value ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
