"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Toast = ({ show, title, message, type = 'success', onClose, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (show) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => {
                    onClose && onClose();
                }, 300); // Wait for animation to complete
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [show, duration, onClose]);

    if (!mounted) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <div className="bg-green-100 p-2 rounded-full">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                );
            case 'error':
                return (
                    <div className="bg-red-100 p-2 rounded-full">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                );
            case 'warning':
                return (
                    <div className="bg-yellow-100 p-2 rounded-full">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="bg-blue-100 p-2 rounded-full">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                );
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success': return 'border-green-200';
            case 'error': return 'border-red-200';
            case 'warning': return 'border-yellow-200';
            default: return 'border-blue-200';
        }
    };

    if (!show) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="flex items-start justify-center pt-20 px-4">
                <div className={`
                    pointer-events-auto
                    bg-white rounded-2xl shadow-lg border-2 ${getBorderColor()}
                    p-4 max-w-sm w-full
                    transform transition-all duration-300 ease-in-out
                    ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-95'}
                `}>
                    <div className="flex items-start space-x-3">
                        {getIcon()}
                        <div className="flex-1 min-w-0">
                            {title && (
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                    {title}
                                </h3>
                            )}
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {message}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(() => onClose && onClose(), 300);
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Hook สำหรับใช้งาน Toast
export const useToast = () => {
    const [toast, setToast] = useState({
        show: false,
        title: '',
        message: '',
        type: 'success'
    });

    const showToast = (message, type = 'success', title = '') => {
        setToast({
            show: true,
            title,
            message,
            type
        });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, show: false }));
    };

    const ToastComponent = () => (
        <Toast
            show={toast.show}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
        />
    );

    return {
        showToast,
        hideToast,
        ToastComponent
    };
};

export default Toast;
