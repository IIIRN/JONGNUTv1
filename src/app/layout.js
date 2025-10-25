// --- เปลี่ยนแปลง: Import ฟอนต์ Barlow และ Noto_Sans_Thai ---
import { Barlow, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
// ไม่ได้ใช้ Inter แล้ว ลบออกได้
// import { Inter } from "next/font/google";

// --- เปลี่ยนแปลง: ตั้งค่าฟอนต์ที่ต้องการ ---
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

// 1. แยก metadata ทั่วไปออกมา (ไม่มี viewport แล้ว)
export const metadata = {
  title: "Management",
  description: "ระบบจัดการรถในองค์กร",
};

// 2. สร้าง function generateViewport แยกออกมาเพื่อปิดการซูม
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
      {/* 3. ใช้ CSS Variables ของฟอนต์ที่ตั้งค่าไว้ */}
      <body className={`${barlow.variable} ${notoSansThai.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
