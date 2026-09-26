import { useState } from 'react';
import { LANGUAGES } from '../data';

interface Props {
  onDone: (lang: string) => void;
}

const slides = [
  {
    emoji: '🎧',
    title: 'Nghe thuyết minh\ntự động',
    desc: 'Bước vào khu ẩm thực Vĩnh Hy và để ứng dụng kể câu chuyện — ngay khi bạn đến gần địa điểm.',
    image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=900&fit=crop&auto=format',
  },
  {
    emoji: '📱',
    title: 'Quét QR\nmua vé dễ dàng',
    desc: 'Quét mã QR tại bảng thông tin hoặc từ email để kích hoạt vé và bắt đầu hành trình ngay lập tức.',
    image: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=900&fit=crop&auto=format',
  },
  {
    emoji: '🌏',
    title: '6 ngôn ngữ\ncho mọi du khách',
    desc: 'Thuyết minh bằng Tiếng Việt, English, 中文, 한국어, 日本語, và Français — chọn ngôn ngữ của bạn.',
    image: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&h=900&fit=crop&auto=format',
  },
];

export default function Onboarding({ onDone }: Props) {
  const [slide, setSlide] = useState(0);
  const [selectedLang, setSelectedLang] = useState('vi');
  const isLast = slide === 2;

  return (
    <div className="relative h-full flex flex-col overflow-hidden" style={{ background: '#f7fdf9' }}>
      {/* Hero image */}
      <div className="absolute inset-0">
        <img
          src={slides[slide].image}
          alt=""
          className="w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: 0.3 }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #f7fdf900 30%, #f7fdf9 80%)' }} />
      </div>

      {/* Skip */}
      {!isLast && (
        <button
          onClick={() => onDone(selectedLang)}
          className="absolute top-12 right-5 text-sm z-10 px-3 py-1.5 rounded-full"
          style={{ color: '#5a8a6e', background: '#f0fdf480', backdropFilter: 'blur(8px)' }}
        >
          Bỏ qua
        </button>
      )}

      {/* Dots */}
      <div className="absolute top-14 left-0 right-0 flex justify-center gap-2 z-10">
        {slides.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{ width: i === slide ? 24 : 6, height: 6, background: i === slide ? '#16a34a' : '#c8ead8' }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 justify-end px-6 pb-10">
        <div className="text-5xl mb-4">{slides[slide].emoji}</div>
        <h1 className="text-3xl font-extrabold mb-3 leading-tight" style={{ color: '#0f2d1e', whiteSpace: 'pre-line' }}>
          {slides[slide].title}
        </h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: '#5a8a6e' }}>
          {slides[slide].desc}
        </p>

        {/* Language selector on last slide */}
        {isLast && (
          <div className="mb-6">
            <p className="text-sm font-semibold mb-3" style={{ color: '#1a3d2b' }}>Chọn ngôn ngữ thuyết minh</p>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: selectedLang === lang.code ? '#dcfce7' : '#ffffff',
                    border: `1.5px solid ${selectedLang === lang.code ? '#16a34a' : '#c8ead8'}`,
                    color: selectedLang === lang.code ? '#16a34a' : '#5a8a6e',
                  }}
                >
                  <span>{lang.flag}</span>
                  <span className="truncate text-xs">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => (isLast ? onDone(selectedLang) : setSlide((s) => s + 1))}
          className="w-full py-4 rounded-2xl text-base font-bold transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white' }}
        >
          {isLast ? 'Bắt đầu khám phá →' : 'Tiếp theo'}
        </button>
      </div>
    </div>
  );
}
