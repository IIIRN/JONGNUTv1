// src/app/(admin)/layout.js
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/app/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import AdminNavbar from '@/app/components/AdminNavbar';
import { ToastProvider, useToast } from '@/app/components/Toast';
import { markAllNotificationsAsRead, clearAllNotifications } from '@/app/actions/notificationActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { ProfileProvider } from '@/context/ProfileProvider'; // --- IMPORT ---

// Inner component to use Toast context within the provider (โค้ดเดิม)
function AdminLayoutContent({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminDocRef = doc(db, 'admins', user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          setIsAuthorized(true);
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    const notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribeNotifs = onSnapshot(notifQuery, (querySnapshot) => {
        const notifsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotifications(notifsData);
        const unread = notifsData.filter(n => !n.isRead).length;
        setUnreadCount(unread);
    });

    return () => {
        unsubscribeAuth();
        unsubscribeNotifs();
    };
  }, [router]);
  
  const handleMarkAsRead = async () => {
      if (unreadCount > 0) {
          const result = await markAllNotificationsAsRead();
          if(!result.success) showToast("เกิดข้อผิดพลาดในการอัปเดต", "error");
      }
  };
  
  const handleClearAllClick = () => {
      if (notifications.length > 0) {
          setShowClearConfirm(true);
      } else {
          showToast("ไม่มีการแจ้งเตือนให้ลบ", "info");
      }
  };

  const handleClearAll = async () => {
      const result = await clearAllNotifications();
      if(result.success){
        showToast("ลบการแจ้งเตือนทั้งหมดแล้ว", "success");
      } else {
        showToast("เกิดข้อผิดพลาดในการลบ", "error");
      }
      setShowClearConfirm(false);
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center">
                <p>Verifying admin access...</p>
            </div>
        </div>
    );
  }

  if (isAuthorized) {
    return (
        <div className="min-h-screen bg-gray-100">
          <ConfirmationModal
              show={showClearConfirm}
              title="ยืนยันการลบ"
              message="คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนทั้งหมด?"
              onConfirm={handleClearAll}
              onCancel={() => setShowClearConfirm(false)}
              isProcessing={false} 
          />
          <AdminNavbar 
              notifications={notifications} 
              unreadCount={unreadCount} 
              onMarkAsRead={handleMarkAsRead}
              onClearAll={handleClearAllClick}
          />
          <main>{children}</main>
        </div>
    );
  }

  return null;
}

// Main Layout component that provides the Toast context (โค้ดเดิม)
export default function AdminLayout({ children }) {
    return (
        <ToastProvider>
            <ProfileProvider>
                <AdminLayoutContent>{children}</AdminLayoutContent>
            </ProfileProvider>
        </ToastProvider>
    )
}

