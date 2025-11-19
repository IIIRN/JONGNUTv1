"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import liff from "@line/liff";

const LiffContext = createContext();

export function LiffProvider({ children }) {
  const [isInit, setIsInit] = useState(false);
  const [liffError, setLiffError] = useState(null);
  const [profile, setProfile] = useState(null);
  const initCalled = useRef(false);

  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;

    const initLiff = async () => {
      try {
        await liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID,
        });

        await liff.ready;

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);
        setIsInit(true);
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
        isInit,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

// ส่งออกทั้งชื่อใหม่ (useLiff) และชื่อเก่า (useLiffContext) เพื่อไม่ให้ Error
export const useLiff = () => useContext(LiffContext);
export const useLiffContext = () => useContext(LiffContext);
