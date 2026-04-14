import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Bell, Inbox, X, Send, UserPlus, UserCheck, UserX,
  CheckCircle2, Info, Image as ImageIcon, Eye, Share2, Layers,
  ChevronRight, ArrowRight
} from 'lucide-react';

export default function Requests() {
  const { 
    user, notifications, sharedIncoming, fetchPartnerData, fetchSharedPosts,
    acceptPartnershipRequest, declinePartnershipRequest,
    deleteSharedPostAction, saveTempDraft, markNotificationAsRead
  } = useStore();
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // all, partners, content
  const [previewPost, setPreviewPost] = useState(null);

  useEffect(() => {
    fetchPartnerData(user?.id);
    fetchSharedPosts();
    // Блокировка скролла при модалке
    document.body.style.overflow = previewPost ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [user, fetchPartnerData, fetchSharedPosts, previewPost]);

  // Фильтрация уведомлений
  const incomingPartnerRequests = useStore((state) => state.incomingRequests) || [];
  
  const handleAcceptPartner = async (reqId) => {
    await acceptPartnershipRequest(reqId);
    fetchPartnerData(user?.id);
  };

  const handleDeclinePartner = async (reqId) => {
    await declinePartnershipRequest(reqId);
    fetchPartnerData(user?.id);
  };

  const handleUsePost = (post) => {
    const mediaUrls = JSON.parse(post.mediaUrls || '[]');
    const photos = mediaUrls.map((url, i) => ({
      id: Math.random().toString(36),
      url: url,
      file: null // В Publish.jsx подхватится как URL-черновик
    }));

    saveTempDraft({ text: post.text || '', photos, step: 1, view: 'wizard' });
    setPreviewPost(null);
    navigate('/publish');
  };

  return (
    <div className="w-full space-y-6 font-sans pb-20">
      
      {/* Заголовок */}
      <div className="bg-admin-card border border-gray-800 p-6 rounded-3xl flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Bell className="text-yellow-500" size={28} /> Уведомления
           </h1>
           <p className="text-gray-500 text-sm mt-1">Запросы в партнеры и входящий контент</p>
        </div>
      </div>

      {/* Сетка уведомлений: Партнеры */}
      {incomingPartnerRequests.length > 0 && (
        <section className="space-y-4">
           <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest px-2">Запросы в партнеры ({incomingPartnerRequests.length})</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingPartnerRequests.map(req => (
                <div key={req.id} className="bg-admin-card border border-gray-800 p-5 rounded-3xl flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
                         <img src={req.requester?.avatarUrl} className="w-full h-full object-cover" />
                      </div>
                      <div>
                         <h4 className="text-white font-bold">{req.requester?.name}</h4>
                         <p className="text-xs text-blue-500 font-bold">Павильон {req.requester?.pavilion}</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => handleDeclinePartner(req.id)} className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 transition-all hover:text-white"><UserX size={18}/></button>
                      <button onClick={() => handleAcceptPartner(req.id)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 transition-all hover:text-white"><UserCheck size={18}/></button>
                   </div>
                </div>
              ))}
           </div>
        </section>
      )}

      {/* Сетка уведомлений: Посты */}
      <section className="space-y-4">
         <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest px-2">Входящие публикации ({sharedIncoming.length})</h2>
         {sharedIncoming.length === 0 ? (
           <div className="bg-admin-card border border-gray-800 border-dashed p-10 rounded-3xl text-center">
              <Inbox className="mx-auto text-gray-700 mb-4" size={40} />
              <p className="text-gray-500 font-bold">Новых постов пока нет</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedIncoming.map(post => (
                <div key={post.id} onClick={() => setPreviewPost(post)} className="bg-admin-card border border-gray-800 p-5 rounded-3xl hover:border-gray-600 transition-all cursor-pointer flex flex-col h-full group">
                   <div className="flex items-center gap-3 mb-4">
                      <img src={post.sender?.avatarUrl} className="w-8 h-8 rounded-lg object-cover" />
                      <span className="text-xs font-bold text-gray-400 truncate">{post.sender?.name}</span>
                      <div className="ml-auto bg-blue-500/10 p-1.5 rounded-lg text-blue-500"><Share2 size={14}/></div>
                   </div>
                   <div className="flex gap-3 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                         <img src={JSON.parse(post.mediaUrls || '[""]')[0]} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-white text-sm line-clamp-2 font-medium leading-relaxed">{post.text}</p>
                   </div>
                   <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">{new Date(post.createdAt).toLocaleDateString()}</span>
                      <ChevronRight className="text-gray-700 group-hover:text-blue-500 transition-all" size={18} />
                   </div>
                </div>
              ))}
           </div>
         )}
      </section>

      {/* Модалка предпросмотра входящего поста */}
      {previewPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-admin-card w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-gray-800">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900">
                 <h3 className="text-white font-bold">Публикация от партнера</h3>
                 <button onClick={() => setPreviewPost(null)} className="p-2 bg-gray-800 text-gray-400 rounded-xl"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                 <div className="flex items-center gap-4 mb-6">
                    <img src={previewPost.sender?.avatarUrl} className="w-12 h-12 rounded-2xl object-cover" />
                    <div>
                       <h4 className="text-white font-black text-lg leading-tight">{previewPost.sender?.name}</h4>
                       <p className="text-xs text-gray-500 font-bold uppercase">Отправил вам готовый пост</p>
                    </div>
                 </div>
                 <p className="text-gray-200 text-base leading-relaxed mb-6 whitespace-pre-wrap">{previewPost.text}</p>
                 <div className="grid grid-cols-2 gap-2">
                    {JSON.parse(previewPost.mediaUrls || '[]').map((img, i) => (
                       <img key={i} src={img} className="rounded-2xl border border-gray-800 aspect-square object-cover" />
                    ))}
                 </div>
              </div>
              <div className="p-5 border-t border-gray-800 bg-gray-900 flex gap-3">
                 <button onClick={() => deleteSharedPostAction(previewPost.id)} className="flex-1 py-4 rounded-2xl bg-gray-800 text-red-400 font-bold border border-red-500/10 hover:bg-red-500 hover:text-white transition-all">Удалить</button>
                 <button onClick={() => handleUsePost(previewPost)} className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-95">
                    <Send size={18}/> Опубликовать у себя
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}