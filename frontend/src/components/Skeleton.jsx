import { useLocation } from 'react-router-dom';

// Серые переливающиеся блоки на месте будущего содержимого. Размеры повторяют настоящие элементы, поэтому страница не прыгает.
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

// Обёртка сообщает программам чтения с экрана, что содержимое загружается.
function Loading({ className = '', children }) {
  return (
    <div data-skeleton="" role="status" aria-busy="true" className={className}>
      <span className="sr-only">Загрузка</span>
      {children}
    </div>
  );
}

const repeat = (count, render) => Array.from({ length: count }, (_, index) => render(index));

// Карточки постов в истории и входящих
export function PostGridSkeleton({ count = 6 }) {
  return (
    <Loading className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {repeat(count, (index) => (
        <div key={index} className="bg-admin-card border border-gray-800 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 flex flex-col">
          <div className="flex gap-4 sm:gap-5 mb-4 sm:mb-5">
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.2rem] shrink-0" />
            <div className="flex-1 min-w-0 space-y-2.5 pt-1">
              <Skeleton className="h-3 w-2/5 rounded-md" />
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-4/5 rounded-md" />
            </div>
          </div>
          <div className="mt-auto pt-4 sm:pt-5 border-t border-gray-800 flex items-center justify-between">
            <Skeleton className="h-7 w-32 rounded-xl" />
            <Skeleton className="h-5 w-5 rounded-md" />
          </div>
        </div>
      ))}
    </Loading>
  );
}

// Строки: уведомления, посты в плане, заявки
export function ListSkeleton({ count = 4 }) {
  return (
    <Loading className="space-y-3">
      {repeat(count, (index) => (
        <div key={index} className="bg-admin-card border border-gray-800 p-4 sm:p-5 rounded-[1.5rem] flex gap-4 items-center">
          <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="flex-1 min-w-0 space-y-2.5">
            <Skeleton className="h-3.5 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </Loading>
  );
}

// Карточки партнёров и заявок
export function CardGridSkeleton({ count = 3, className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' }) {
  return (
    <Loading className={className}>
      {repeat(count, (index) => (
        <div key={index} className="bg-admin-card border border-gray-800 p-5 rounded-[1.5rem] sm:rounded-[2rem]">
          <div className="flex items-center gap-4 mb-5">
            <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2.5">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </Loading>
  );
}

// Подключённые каналы на странице аккаунтов
export function ChannelGridSkeleton({ count = 4 }) {
  return (
    <Loading className="grid grid-cols-2 gap-2 sm:gap-3">
      {repeat(count, (index) => (
        <div key={index} className="bg-admin-card border border-gray-800 rounded-xl p-3 flex items-center gap-2.5">
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <Skeleton className="h-3 flex-1 rounded-md" />
        </div>
      ))}
    </Loading>
  );
}

// Каналы при выборе, куда опубликовать
export function ChannelPickerSkeleton({ count = 4 }) {
  return (
    <Loading className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
      {repeat(count, (index) => (
        <div key={index} className="flex items-center gap-2.5 p-2.5 min-h-[48px] rounded-xl border border-gray-800">
          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          <Skeleton className="h-3 flex-1 rounded-md" />
          <Skeleton className="w-4 h-4 rounded-full shrink-0" />
        </div>
      ))}
    </Loading>
  );
}

function ProfilePage() {
  return (
    <Loading className="space-y-6">
      <div className="bg-admin-card border border-gray-800 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center gap-4 min-h-[392px] md:min-h-[220px]">
        <Skeleton className="w-24 h-24 rounded-full" />
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-24 w-full max-w-sm rounded-2xl" />
        <Skeleton className="h-8 w-full max-w-xs rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-28 rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {repeat(2, (index) => (
          <div key={index} className="bg-admin-card border border-gray-800 rounded-[1.5rem] p-5 sm:p-6 space-y-4">
            <Skeleton className="h-3.5 w-3/4 rounded-md" />
            <Skeleton className="h-9 sm:h-12 w-1/3 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="bg-admin-card border border-gray-800 rounded-[1.5rem] p-5 sm:p-6 space-y-4">
        <Skeleton className="h-3.5 w-1/3 rounded-md" />
        <Skeleton className="h-10 w-1/5 rounded-lg" />
      </div>
    </Loading>
  );
}

function PublishPage() {
  return (
    <Loading className="min-h-[100dvh] py-8 flex flex-col items-center justify-center pb-24 md:pb-0">
      <Skeleton className="w-16 h-16 rounded-3xl mb-6" />
      <Skeleton className="h-8 sm:h-10 w-64 max-w-full rounded-lg mb-3" />
      <Skeleton className="h-10 w-80 max-w-full rounded-md mb-8 sm:mb-10" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {repeat(2, (index) => (
          <div key={index} className="bg-admin-card border border-gray-800 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 flex flex-col items-center">
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-4 sm:mb-5" />
            <Skeleton className="h-5 w-40 rounded-md mb-3" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

function PostsPage() {
  return (
    <div className="space-y-6">
      <Loading className="space-y-6">
        <div className="bg-admin-card border border-gray-800 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-4">
          <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
          <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
          <Skeleton className="h-12 w-full md:w-96 rounded-2xl" />
        </div>
        <Skeleton className="h-28 sm:h-[72px] w-full rounded-[1.5rem] sm:rounded-[1.8rem]" />
      </Loading>
      <PostGridSkeleton />
    </div>
  );
}

function RequestsPage() {
  return (
    <div className="space-y-6">
      <Loading>
        <Skeleton className="h-14 w-full rounded-[1.5rem]" />
      </Loading>
      <ListSkeleton />
    </div>
  );
}

function PartnersPage() {
  return (
    <div className="space-y-6">
      <Loading className="space-y-6">
        <div className="bg-admin-card border border-gray-800 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-3">
          <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
          <Skeleton className="h-3.5 w-full max-w-md rounded-md" />
        </div>
        <Skeleton className="h-14 w-full rounded-[1.5rem]" />
      </Loading>
      <CardGridSkeleton />
    </div>
  );
}

function AccountsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      <Loading className="space-y-6">
        <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
        <Skeleton className="h-24 w-full max-w-md mx-auto rounded-2xl" />
        <div className="bg-admin-card border border-gray-800 rounded-[1.5rem] p-5 max-w-md mx-auto space-y-4">
          <Skeleton className="h-4 w-40 mx-auto rounded-md" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </Loading>
      <div className="max-w-md mx-auto w-full">
        <ChannelGridSkeleton />
      </div>
    </div>
  );
}

function EditorPage() {
  return (
    <Loading className="bg-admin-card border border-gray-800 rounded-[1.5rem] p-6 sm:p-8 max-w-md mx-auto mt-4 flex flex-col items-center gap-4">
      <Skeleton className="h-24 w-48 rounded-xl" />
      <Skeleton className="h-7 w-44 rounded-lg" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-11 w-40 rounded-xl" />
    </Loading>
  );
}

function PlainPage() {
  return (
    <Loading className="max-w-3xl mx-auto p-6 sm:p-10 space-y-4">
      <Skeleton className="h-8 w-2/3 rounded-lg" />
      {repeat(8, (index) => <Skeleton key={index} className={`h-3.5 rounded-md ${index % 3 === 2 ? 'w-3/5' : 'w-full'}`} />)}
    </Loading>
  );
}

const PAGES = {
  '/profile': ProfilePage,
  '/publish': PublishPage,
  '/posts': PostsPage,
  '/requests': RequestsPage,
  '/partners': PartnersPage,
  '/accounts': AccountsPage,
  '/watermark': EditorPage,
  '/signatures': EditorPage,
};

// Показывается, пока загружается файл страницы: форма блоков соответствует открываемому разделу.
export function RouteSkeleton() {
  const { pathname } = useLocation();
  const Page = PAGES[pathname] || PlainPage;
  return <Page />;
}
