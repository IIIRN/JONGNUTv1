// src/hooks/useLiff.js

"use client";

import { useState, useEffect } from 'react';

const MOCK_PROFILE = {
    userId: 'U_TEST_1234567890ABCDEF',
    displayName: 'คุณ ทดสอบ',
    pictureUrl: 'https://lh5.googleusercontent.com/d/10mcLZP15XqebnVb1IaODQLhZ93EWT7h7'
};

const useLiff = (liffId) => {
    const [liffObject, setLiffObject] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const initializeLiff = async () => {
            if (process.env.NODE_ENV === 'development') {
                console.warn("LIFF mock mode is active.");
                // Mock LIFF object with all necessary functions for development
                const mockLiff = {
                    isInClient: () => true,
                    closeWindow: () => {
                        console.log('Mock: LIFF window closed');
                        window.history.back();
                    },
                    sendMessages: async (messages) => {
                        console.log('Mock: Messages sent:', messages);
                        return Promise.resolve();
                    },
                    scanCodeV2: async () => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ value: 'mock-appointment-id-12345' });
                            }, 1000);
                        });
                    }
                };
                setLiffObject(mockLiff);
                setProfile(MOCK_PROFILE);
                setLoading(false);
                return;
            }

            if (!liffId) {
                setError("LIFF ID is not provided.");
                setLoading(false);
                return;
            }
            try {
                const liff = (await import('@line/liff')).default;
                await liff.init({ liffId });

                const params = new URLSearchParams(window.location.search);
                const redirectPath = params.get('liff.state');
                
                if (redirectPath) {
                    window.location.replace(redirectPath);
                    return; 
                }

                if (!liff.isLoggedIn()) {
                    liff.login({ 
                        redirectUri: window.location.href,
                        scope: 'profile openid chat_message.write'
                    });
                    return;
                }

                const userProfile = await liff.getProfile();
                setProfile(userProfile);
                setLiffObject(liff);

            } catch (err) {
                console.error("LIFF initialization failed", err);
                
                // Set a more user-friendly error message
                let userError = 'การเชื่อมต่อ LINE ไม่สมบูรณ์';
                if (err.message && err.message.includes('permission')) {
                    userError = 'สิทธิ์การเข้าถึง LINE ไม่เพียงพอ กรุณาอนุญาตสิทธิ์ในการส่งข้อความ';
                } else if (err.message && err.message.includes('scope')) {
                    userError = 'การตั้งค่า LIFF ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ';
                }
                
                setError(userError);
                
                // In development, still provide mock data to allow testing
                if (process.env.NODE_ENV === 'development') {
                    console.warn('Setting up fallback mock data for development');
                    setLiffObject({
                        isInClient: () => false,
                        closeWindow: () => window.history.back(),
                        sendMessages: async () => console.log('Mock: Messages sent (fallback)')
                    });
                    setProfile(MOCK_PROFILE);
                }
            } finally {
                setLoading(false);
            }
        };

        initializeLiff();
    }, [liffId]);

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;

