import { useEffect, useState } from 'react';
import { Wrench, AlertTriangle, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function MaintenanceGuard({ children }) {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
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
        const interval = setInterval(checkStatus, 30000); 
        return () => clearInterval(interval);
    }, []);

    // Админы не должны блокироваться
    const isAdminRoute = location.pathname.includes('/boss') || location.pathname.includes('/admin');
    const hasAdminToken = localStorage.getItem('adminToken');

    if (isLoading) return null;

    if (isMaintenance && !isAdminRoute && !hasAdminToken) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="bg-[#111318] border border-red-500/30 p-8 md:p-12 rounded-[2rem] max-w-lg w-full text-center shadow-[0_0_80px_rgba(239,68,68,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>
                    
                    <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                       <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping"></div>
                       <Wrench size={40} />
                    </div>
                    
                    <h1 className="text-2xl md:text-3xl font-black text-white mb-4 uppercase tracking-wide">Технические работы</h1>
                    <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-8 whitespace-pre-wrap">
                       {message}
                    </p>
                    
                    <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
                       <Loader2 size={14} className="animate-spin"/> Сайт временно недоступен
                    </div>
                </div>
            </div>
        );
    }

    return children;
}