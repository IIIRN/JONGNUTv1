// src/context/ProfileProvider.js
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

const ProfileContext = createContext(null);

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
    const [profile, setProfile] = useState({
        storeName: 'กำลังโหลด...',
        currency: undefined,
        currencySymbol: undefined,
        contactPhone: '',
        address: '',
        description: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const docRef = doc(db, 'settings', 'profile');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                } else {
                    setProfile({
                        storeName: 'ชื่อร้านค้า',
                        currency: '฿',
                        currencySymbol: 'บาท',
                        contactPhone: '',
                        address: '',
                        description: ''
                    });
                }
            } catch (error) {
                console.error("Error fetching store profile:", error);
                 setProfile({
                    storeName: 'เกิดข้อผิดพลาด',
                    currency: undefined,
                    currencySymbol: undefined,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    return (
        <ProfileContext.Provider value={{ profile, loading }}>
            {children}
        </ProfileContext.Provider> 
    );
};