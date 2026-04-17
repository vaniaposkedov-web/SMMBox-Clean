// frontend/src/components/MaintenanceGuard.jsx
import { useEffect, useState } from 'react';
import { Wrench, AlertTriangle, Loader2, X, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client'; // Не забудьте установить: npm install socket.io-client

export default function MaintenanceGuard({ children }) {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [message, setMessage] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [warningMsg, setWarningMsg] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        // 1. Первоначальная проверка при загрузке
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/system/status');
                const data = await res.json();
                setIsMaintenance(data.isMaintenance);
                setMessage(data.message);
            } catch (e) {}
            setIsLoading(false);
        };
        checkStatus();

        // 2. Настройка Socket.io для мгновенных обновлений
        const socket = io(window.location.origin); // Подключаемся к нашему серверу

        socket.on('maintenance_update', (data) => {
            setIsMaintenance(data.isMaintenance);
            if (data.message) setMessage(data.message);
        });

        socket.on('system_warning', (data) => {
            setWarningMsg(data.message);
            setShowWarning(true);
        });

        return () => socket.disconnect();
    }, []);

    const isAdminRoute = location.pathname.includes('/boss') || location.pathname.includes('/admin');
    const hasAdminToken = localStorage.getItem('adminToken');

    if (isLoading) return null;

    // Если идут работы и это не админ — блокируем всё
    if (isMaintenance && !isAdminRoute && !hasAdminToken) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="bg-[#111318] border border-red-500/30 p-8 md:p-12 rounded-[2rem] max-w-lg w-full text-center shadow-[0_0_80px_rgba(239,68,68,0.15)]">
                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                       <Wrench size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-4 uppercase">Технические работы</h1>
                    <p className="text-gray-400 mb-8 whitespace-pre-wrap">{message}</p>
                    <div className="inline-flex items-center gap-2 bg-red-500/5 border border-red-500/10 px-4 py-2 rounded-lg text-xs text-red-400 font-bold">
                       <Loader2 size={14} className="animate-spin"/> Ожидайте завершения
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* ПЛАШКА ПРЕДУПРЕЖДЕНИЯ (CLOSEABLE) */}
            {showWarning && !isMaintenance && !isAdminRoute && (
                <div className="fixed top-4 left-4 right-4 z-[10000] animate-in slide-in-from-top-full duration-500">
                    <div className="max-w-xl mx-auto bg-gradient-to-r from-amber-600 to-orange-600 p-[1px] rounded-2xl shadow-2xl">
                        <div className="bg-[#111318] rounded-[15px] p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center shrink-0">
                                    <Bell size={20} className="animate-bounce" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">Плановое обслуживание</p>
                                    <p className="text-gray-400 text-xs">{warningMsg}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowWarning(false)}
                                className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {children}
        </>
    );
}