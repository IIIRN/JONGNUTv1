// src/app/page.js
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// 1. Import Firebase functions ที่จำเป็น
import { auth, db } from '@/app/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 2. ลองทำการ Sign in ด้วยอีเมลและรหัสผ่าน
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. ตรวจสอบใน Firestore ว่า user ที่ login เข้ามา เป็น admin หรือไม่
      const adminDocRef = doc(db, 'admins', user.uid);
      const adminDocSnap = await getDoc(adminDocRef);

      if (adminDocSnap.exists()) {
        setRedirecting(true);
        // 4. ถ้าเป็น admin จริง ให้ redirect ไปหน้า dashboard
        router.push('dashboard');
      } else {
        // 5. ถ้าไม่ใช่ admin ให้ออกจากระบบและแสดงข้อผิดพลาด
        await signOut(auth);
        setError('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
      }

    } catch (error) {
      // 6. จัดการข้อผิดพลาดในการล็อกอิน (แสดงเฉพาะข้อความที่เข้าใจง่าย ไม่ log error object)
      let errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "ไม่พบผู้ใช้งานนี้ในระบบ";
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
          break;
        case 'auth/invalid-email':
          errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
          break;
        case 'auth/user-disabled':
          errorMessage = "บัญชีผู้ใช้ถูกระงับ";
          break;
        case 'auth/too-many-requests':
          errorMessage = "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง";
          break;
        case 'auth/network-request-failed':
          errorMessage = "เกิดปัญหาการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ต";
          break;
        case 'auth/internal-error':
          errorMessage = "เกิดข้อผิดพลาดภายใน กรุณาลองใหม่อีกครั้ง";
          break;
        default:
          errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง";
      }
      setError(errorMessage);
    } finally {
      if (!redirecting) {
        setLoading(false);
      }
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow">
        {/* Admin Section Only */}
        <div className="p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-6">สำหรับผู้ดูแลระบบ</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input 
                type="email" 
                name="email" 
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="password-admin" className="sr-only">Password</label>
              <input 
                type="password" 
                name="password-admin" 
                id="password-admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors disabled:bg-gray-400"
            >
              {redirecting ? 'กำลังไป Dashboard...' : loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

