"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import liff from "@line/liff";

const LiffContext = createContext();

export function LiffProvider({ children }) {
  const [isInit, setIsInit] = useState(false);
  const [liffError, setLiffError] = useState(null);
  const [profile, setProfile] = useState(null);
  const initCalled = useRef(false); // ตัวกัน init ซ้ำ (สำคัญมากใน Next.js)

  useEffect(() => {
    // ถ้าเคยเรียก init ไปแล้ว ให้หยุดทันที ไม่ต้องเรียกซ้ำ
    if (initCalled.current) return;
    initCalled.current = true;

    const initLiff = async () => {
      try {
        await liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID,
        });

        // รอจนกว่า LIFF จะพร้อมทำงานจริงๆ
        await liff.ready;

        // ตรวจสอบว่า Login หรือยัง ถ้ายังให้ Login
        if (!liff.isLoggedIn()) {
            liff.login();
            return; // จบการทำงานรอบนี้ รอ Redirect กลับมาใหม่
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);
        setIsInit(true); // แจ้งว่าระบบพร้อมแล้ว!
      } catch (error) {
        console.error("LIFF Init Failed:", error);
        setLiffError(error.toString());
      }
    };

    initLiff();
  }, []);

  return (
    <LiffContext.Provider
      value={{
        liff,
        liffError,
        profile,
        isInit, // ตัวแปรสำคัญเอาไว้เช็คว่าพร้อมหรือยัง
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

export const useLiff = () => useContext(LiffContext);
