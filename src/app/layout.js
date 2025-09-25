// --- เปลี่ยนแปลง: Import ฟอนต์ Barlow และ Noto_Sans_Thai ---
import { Barlow, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";

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


export const metadata = {
  title: "SPOTLIGHT",
  description: "ระบบจองบริการ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${barlow.variable} ${notoSansThai.variable} antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}