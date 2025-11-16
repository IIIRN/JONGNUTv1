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
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLineLogin = async () => {
    setLineLoading(true);
    // เพิ่ม delay เล็กน้อยเพื่อให้เห็น loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    router.push('/dashboard');
    setLineLoading(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Debug: ตรวจสอบว่ามี auth object หรือไม่
      console.log('Auth object:', auth);
      console.log('Email:', email);
      
      // 2. ลองทำการ Sign in ด้วยอีเมลและรหัสผ่าน
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('User signed in:', user.uid);

      // 3. ตรวจสอบใน Firestore ว่า user ที่ login เข้ามา เป็น admin หรือไม่
      const adminDocRef = doc(db, 'admins', user.uid);
      const adminDocSnap = await getDoc(adminDocRef);

      if (adminDocSnap.exists()) {
        console.log('Admin verified, redirecting...');
        setRedirecting(true);
        // 4. ถ้าเป็น admin จริง ให้ redirect ไปหน้า dashboard
        router.push('dashboard');
      } else {
        console.log('User is not an admin');
        // 5. ถ้าไม่ใช่ admin ให้ออกจากระบบและแสดงข้อผิดพลาด
        await signOut(auth);
        setError('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
      }

    } catch (error) {
      // 6. จัดการข้อผิดพลาดในการล็อกอิน
      console.error('Complete error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      
      // จัดการข้อผิดพลาดตาม error code
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
          errorMessage = `เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ${error.code || 'Unknown error'}`;
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
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-800">SPOTLIGHT</h1>
          <p className="text-gray-500">ระบบจองบริการ</p>
        </div>

        {/* Customer & technician Section */}
        <div className="p-6 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">สำหรับลูกค้าและช่างเสริมสวย</h2>
          <button 
            onClick={handleLineLogin}
            disabled={lineLoading}
            className="w-full flex items-center justify-center py-3 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:bg-gray-400"
          >
            {lineLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย LINE'}
          </button>
        </div>

        {/* Admin Section */}
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">สำหรับผู้ดูแลระบบ</h2>
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

