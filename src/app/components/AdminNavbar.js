"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/app/components/Toast";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";

// --- Custom Hook สำหรับ dropdown ---
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const navLinks = [
  { name: "แดชบอร์ด", href: "/dashboard" },
  {
    name: "ข้อมูลหลัก",
    items: [
      // [!code focus start]
      { name: "สร้างการนัดหมาย", href: "/create-appointment" },
      // [!code focus end]
      { name: "บริการ", href: "/services" },
      { name: "ช่าง", href: "/beauticians" },
      { name: "ลูกค้า", href: "/customers" },
    ]
  },
  {
    name: "วิเคราะห์/รีวิว",
    items: [
      { name: "ของรางวัล", href: "/manage-rewards" },
      { name: "วิเคราะห์", href: "/analytics" },
      { name: "รีวิวลูกค้า", href: "/reviews" },
    ]
  },
  {
    name: "ตั้งค่า",
    items: [
      { name: "จัดการผู้ดูแลระบบ", href: "/admins" },
      { name: "จัดการพนักงาน", href: "/employees" },
      { name: "ตั้งค่าทั่วไป", href: "/settings" },
    ]
  },
];

const NavLink = ({ link, currentPath, onClick = () => {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useClickOutside(dropdownRef, () => setIsOpen(false));

  const isActive = link.items ? link.items.some(item => currentPath.startsWith(item.href)) : currentPath === link.href;

  if (link.items) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center justify-between ${isActive ? "bg-slate-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          {link.name}
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        {isOpen && (
          <div className="mt-2 w-full bg-white rounded-md shadow-lg py-1 z-20 border md:absolute md:right-0 md:w-56">
            {link.items.map(item => (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClick}
                className={`px-4 py-2 text-sm flex items-center ${currentPath === item.href ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={link.href}
      onClick={onClick}
  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${isActive ? "bg-slate-800 text-white font-bold" : "text-gray-600 hover:bg-gray-100"}`}
    >
  {link.name}
    </Link>
  )
}

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifPopoverRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);
  const { 
    toasts = [], 
    markAsRead, 
    markAllAsRead,
    removeToast, 
    clearAllToasts,
    hasUnread 
  } = useToast();

  useClickOutside(notifPopoverRef, () => setIsNotifOpen(false));

  // ตรวจสอบการแจ้งเตือนใหม่และเปิดกล่องอัตโนมัติ
  const prevToastsLengthRef = useRef(toasts.length);
  useEffect(() => {
    // ถ้ามีการแจ้งเตือนใหม่ (จำนวน toasts เพิ่มขึ้น)
    if (toasts.length > prevToastsLengthRef.current && toasts.length > 0) {
      setIsNotifOpen(true);
      
      // ล้าง timeout เก่า (ถ้ามี)
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
      
      // ตั้ง timeout ใหม่สำหรับปิดอัตโนมัติหลัง 3 วินาที
      autoCloseTimeoutRef.current = setTimeout(() => {
        setIsNotifOpen(false);
      }, 3000);
    }
    
    prevToastsLengthRef.current = toasts.length;
  }, [toasts.length]);

  // ล้าง timeout เมื่อ component unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const toggleNotifPopover = () => {
    // ล้าง auto-close timeout เมื่อผู้ใช้เปิด-ปิดเอง
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    setIsNotifOpen(!isNotifOpen);
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* [!code focus start] */}
          {/* --- Left Side --- */}
          <div className="flex items-center">
            {/* Hamburger Button for Mobile */}
            <div className="md:hidden mr-2">
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md hover:bg-gray-100">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
                </button>
            </div>
            {/* Title */}
            <Link href="/dashboard" className="text-xl font-bold text-slate-800" >
              Dashboard
            </Link>
          </div>
          {/* [!code focus end] */}
          
          {/* --- Desktop Menu (Center) --- */}
          <div className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <NavLink key={link.name} link={link} currentPath={pathname} />
            ))}
          </div>

          {/* --- Right Side --- */}
          <div className="flex items-center">
            {/* ไอคอนแจ้งเตือนใน navbar */}
            <div className="relative" ref={notifPopoverRef}>
              <button
                onClick={toggleNotifPopover}
                className={`p-2 rounded-full hover:bg-gray-100 relative transition-colors ${
                  hasUnread ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {hasUnread && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">
                    {toasts.filter(t => !t.read).length}
                  </span>
                )}
              </button>
              
              {/* กล่องแจ้งเตือน */}
              {isNotifOpen && (
                <div className="absolute top-16 right-0 w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden z-30">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">แจ้งเตือน</h3>
                    <div className="flex gap-2">
                      {hasUnread && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          อ่านทั้งหมด
                        </button>
                      )}
                      <button
                        onClick={clearAllToasts}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                      >
                        ลบทั้งหมด
                      </button>
                    </div>
                  </div>

                  {/* รายการแจ้งเตือน */}
                  <div className="max-h-80 overflow-y-auto">
                    {toasts.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <p>ไม่มีการแจ้งเตือน</p>
                      </div>
                    ) : (
                      // แสดง 5 รายการล่าสุด โดยใหม่ที่สุดอยู่บนสุด
                      toasts.slice(-5).reverse().map(toast => (
                        <div
                          key={toast.id}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            !toast.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                              toast.type === 'error' ? 'bg-red-500' : 
                              toast.type === 'success' ? 'bg-green-500' : 
                              toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}></div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!toast.read ? 'font-medium' : ''} ${
                                toast.type === 'error' ? 'text-red-700' : 
                                toast.type === 'success' ? 'text-green-700' : 
                                toast.type === 'warning' ? 'text-yellow-700' : 'text-blue-700'
                              }`}>
                                {toast.message}
                              </p>
                              {toast.timestamp && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {toast.timestamp.toLocaleTimeString('th-TH')}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-1">
                              {!toast.read && (
                                <button
                                  onClick={() => markAsRead(toast.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-100"
                                  title="อ่านแล้ว"
                                >
                                  อ่าน
                                </button>
                              )}
                              <button
                                onClick={() => removeToast(toast.id)}
                                className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-100"
                                title="ลบ"
                              >
                                ลบ
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleLogout}
              className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
        
        {isMobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2">
                 {navLinks.map((link) => (
                    <NavLink key={link.name} link={link} currentPath={pathname} onClick={() => setIsMobileMenuOpen(false)} />
                 ))}
            </div>
        )}
      </div>
    </nav>
  );
}