import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldOff, X } from 'lucide-react';
import { LEGAL_DOCUMENTS } from '../legal/details';

// Просьба выключить VPN при заходе на сайт.
// Крестик и «Понятно» закрывают окно до следующего захода (новой вкладки или нового открытия сайта),
// «Больше не показывать» убирает его в этом браузере навсегда.
const HIDDEN_FOREVER_KEY = 'vpn-notice-hidden';
const CLOSED_THIS_VISIT_KEY = 'vpn-notice-closed';
const SHOW_AFTER_MS = 700; // Сначала открывается сама страница, потом окно: так оно не мелькает поверх пустого экрана
const ADMIN_PATHS = ['/boss-login', '/system-core-dashboard'];

// В закрытом режиме браузера хранилище может быть недоступно: тогда окно просто показывается, сайт не ломается.
const readFlag = (storage, key) => {
  try { return storage.getItem(key) === '1'; } catch { return false; }
};
const writeFlag = (storage, key) => {
  try { storage.setItem(key, '1'); } catch { /* хранилище недоступно */ }
};

export default function VpnNotice() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isAdminPage = ADMIN_PATHS.includes(location.pathname);
  const isLegalPage = LEGAL_DOCUMENTS.some((document) => document.path === location.pathname);
  const isSkippedPage = isAdminPage || isLegalPage;

  useEffect(() => {
    if (isSkippedPage) return undefined;
    if (readFlag(localStorage, HIDDEN_FOREVER_KEY) || readFlag(sessionStorage, CLOSED_THIS_VISIT_KEY)) return undefined;
    const timer = setTimeout(() => setIsOpen(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isSkippedPage]);

  const close = () => {
    writeFlag(sessionStorage, CLOSED_THIS_VISIT_KEY);
    setIsOpen(false);
  };

  const hideForever = () => {
    writeFlag(localStorage, HIDDEN_FOREVER_KEY);
    close();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen || isSkippedPage) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm notice-backdrop-appear" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vpn-notice-title"
        aria-describedby="vpn-notice-text"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md bg-[#0d0f13] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-500/10 notice-appear"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f13]"
        >
          <X size={20} />
        </button>

        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-5">
          <ShieldOff size={30} />
        </div>

        <h2 id="vpn-notice-title" className="text-white font-bold text-xl mb-2 pr-8">Отключите VPN</h2>
        <div id="vpn-notice-text" className="space-y-2 text-gray-400 text-sm leading-relaxed">
          <p>С включённым VPN сайт может работать нестабильно: страницы открываются медленнее, а фото и посты иногда не отправляются.</p>
          <p>Чтобы всё работало быстро и без сбоев, выключите VPN, пока пользуетесь SADOVODPS.</p>
        </div>

        <div className="space-y-3 mt-6">
          <button
            type="button"
            onClick={close}
            autoFocus
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f13]"
          >
            Понятно
          </button>
          <button
            type="button"
            onClick={hideForever}
            className="w-full py-3 rounded-xl font-bold text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f13]"
          >
            Больше не показывать
          </button>
        </div>
      </div>
    </div>
  );
}
