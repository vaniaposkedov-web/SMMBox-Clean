import React from 'react';
import { Users, Activity, AlertTriangle, Send } from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    { label: 'Всего пользователей', value: '1,248', icon: <Users size={24} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Постов за сегодня', value: '342', icon: <Send size={24} />, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Активные подписки', value: '156', icon: <Activity size={24} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Ошибки API', value: '3', icon: <AlertTriangle size={24} />, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Обзор системы</h1>
      <p className="text-gray-400 mb-8">Статистика и состояние серверов SMMBOXSS</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-admin-card border border-gray-800 rounded-3xl p-6 shadow-lg">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-sm font-medium text-gray-400">{stat.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      
      {/* Здесь в будущем добавим графики регистраций и логи серверов */}
      <div className="mt-8 bg-admin-card border border-gray-800 rounded-3xl p-6 sm:p-10 text-center shadow-lg">
        <p className="text-gray-500">Графики активности находятся в разработке...</p>
      </div>
    </div>
  );
}