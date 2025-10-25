import { Barlow, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";

// --- ตั้งค่าฟอนต์ที่ต้องการ ---
const barlow = Barlow({
  weight: ['400', '500', '700'], // เลือกน้ำหนักที่ต้องการใช้
  subsets: ["latin"],
  display: 'swap', // ช่วยให้เว็บแสดงผลเร็วขึ้น
  variable: "--font-barlow", // กำหนดชื่อ CSS Variable
});

const notoSansThai = Noto_Sans_Thai({
  weight: ['400', '500', '700'],
  subsets: ["thai"],
  display: 'swap',
  variable: "--font-noto-sans-thai",
});

// 1. metadata ทั่วไป (ไม่มี viewport)
export const metadata = {
  title: "SPOTLIGHT",
  description: "ระบบจองบริการ",
};

// 2. เพิ่ม function generateViewport เพื่อปิดการซูม
export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* 3. ใช้ CSS Variables ของฟอนต์ */}
      <body className={`${barlow.variable} ${notoSansThai.variable} antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
