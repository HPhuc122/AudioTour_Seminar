export interface Location {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  description: string;
  descriptionLong: string;
  image: string;
  images: string[];
  menuImages: string[];
  lat: number;
  lng: number;
  stopNumber?: number;
}

export interface Tour {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  duration: number;
  description: string;
  stops: string[];
  image: string;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  duration: number;
  isFree: boolean;
  areas: string[];
  languages: string[];
  features: string[];
}

export const CATEGORIES = ['Tất cả', 'Hải sản', 'Quán cà phê', 'Đặc sản', 'Di tích', 'Chợ'];

export const LOCATIONS: Location[] = [
  {
    id: 'loc-1',
    name: 'Bến Cá Vĩnh Hy',
    nameEn: 'Vinh Hy Fishing Harbor',
    category: 'Hải sản',
    description: 'Bến cá sầm uất với hải sản tươi sống đặc trưng của vịnh Vĩnh Hy',
    descriptionLong:
      'Bến cá Vĩnh Hy là trái tim ẩm thực của khu vực, nơi ngư dân mang tôm hùm, cá mú và hải sản tươi sống thẳng từ biển lên. Không khí buổi sáng ở đây rất đặc biệt — tiếng sóng, mùi biển mặn, và những chiếc thuyền gỗ xanh đỏ neo đậu san sát.',
    image: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&h=500&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&h=500&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=500&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=500&fit=crop&auto=format',
    ],
    menuImages: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop&auto=format',
    ],
    lat: 11.7432,
    lng: 109.2523,
    stopNumber: 1,
  },
  {
    id: 'loc-2',
    name: 'Quán Bà Tư Lobster',
    nameEn: 'Ba Tu Lobster Restaurant',
    category: 'Hải sản',
    description: 'Quán tôm hùm nướng nức tiếng, gia đình kinh doanh 3 thế hệ',
    descriptionLong:
      'Bà Tư đã bán tôm hùm nướng mỡ hành tại góc ngã tư này từ năm 1978. Bí quyết gia truyền không bao giờ được tiết lộ, nhưng mùi tỏi phi thơm lừng đã dẫn bước hàng ngàn du khách.',
    image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=500&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=500&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop&auto=format',
    ],
    menuImages: [
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3b84?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1559742811-822873691df8?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop&auto=format',
    ],
    lat: 11.7445,
    lng: 109.2541,
    stopNumber: 2,
  },
  {
    id: 'loc-3',
    name: 'Chợ Đêm Vĩnh Hy',
    nameEn: 'Vinh Hy Night Market',
    category: 'Chợ',
    description: 'Chợ đêm sôi động với các gian hàng đặc sản vùng biển',
    descriptionLong:
      'Sau 6 giờ chiều, con phố ven biển bừng sáng ánh đèn lồng đỏ. Hàng chục xe đẩy bày ra các món ăn vặt: bánh căn nhân mực, chả cá thu nướng than, và nước dừa lạnh mát.',
    image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=500&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=500&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&h=500&fit=crop&auto=format',
    ],
    menuImages: [
      'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1484980972926-edee96e0960d?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400&h=300&fit=crop&auto=format',
    ],
    lat: 11.7421,
    lng: 109.251,
    stopNumber: 3,
  },
  {
    id: 'loc-4',
    name: 'Đình Thần Vĩnh Hy',
    nameEn: 'Vinh Hy Village Temple',
    category: 'Di tích',
    description: 'Ngôi đình cổ thờ thần biển, xây dựng năm 1847',
    descriptionLong:
      'Ngôi đình được xây dựng theo kiến trúc đình làng Nam Trung Bộ, với mái ngói lưu ly và cột gỗ lim chạm trổ tinh xảo. Lễ hội cầu ngư hàng năm vào tháng 3 âm lịch thu hút hàng ngàn người dân và du khách.',
    image: 'https://images.unsplash.com/photo-1574303903621-1e9b56534f4d?w=800&h=500&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1574303903621-1e9b56534f4d?w=800&h=500&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&h=500&fit=crop&auto=format',
    ],
    menuImages: [],
    lat: 11.741,
    lng: 109.2498,
    stopNumber: 4,
  },
  {
    id: 'loc-5',
    name: 'Cà Phê Sóng Biển',
    nameEn: 'Ocean Wave Café',
    category: 'Quán cà phê',
    description: 'Cà phê view biển tuyệt đẹp, cà phê trứng và muối đặc trưng',
    descriptionLong:
      'Ngồi trên ban công gỗ chìa ra mặt vịnh Vĩnh Hy xanh ngắt trong khi thưởng thức cốc cà phê trứng béo ngậy — đây là trải nghiệm mà khách quay lại lần thứ hai, thứ ba vẫn tìm kiếm.',
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&h=500&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&h=500&fit=crop&auto=format',
    ],
    menuImages: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1497636577773-f1231844b336?w=400&h=300&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1504630083234-14187a9df0f5?w=400&h=300&fit=crop&auto=format',
    ],
    lat: 11.7455,
    lng: 109.2535,
  },
  {
    id: 'loc-6',
    name: 'Làng Chài Cổ',
    nameEn: 'Ancient Fishing Village',
    category: 'Di tích',
    description: 'Làng chài truyền thống với những ngôi nhà lá mái và nghề đan lưới cổ truyền',
    descriptionLong:
      'Làng chài này tồn tại từ thế kỷ 18, khi những ngư dân đầu tiên từ Bình Định vào lập nghiệp. Những ngôi nhà lá mái thấp, nền đất, với chiếc thuyền thúng chai bên hông — tất cả vẫn được gìn giữ gần như nguyên vẹn.',
    image: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=500&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=500&fit=crop&auto=format',
    ],
    menuImages: [],
    lat: 11.7398,
    lng: 109.248,
  },
];

export const TOURS: Tour[] = [
  {
    id: 'tour-1',
    code: 'T01',
    name: 'Hành Trình Hải Sản Vĩnh Hy',
    nameEn: 'Vinh Hy Seafood Journey',
    duration: 90,
    description:
      'Khám phá toàn bộ tinh hoa ẩm thực biển Vĩnh Hy — từ bến cá lúc bình minh, đến những quán hải sản gia truyền và chợ đêm lung linh',
    stops: ['loc-1', 'loc-2', 'loc-3'],
    image: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&h=500&fit=crop&auto=format',
  },
  {
    id: 'tour-2',
    code: 'T02',
    name: 'Di Sản Làng Chài',
    nameEn: 'Fishing Village Heritage',
    duration: 60,
    description:
      'Tìm hiểu lịch sử 300 năm của làng chài Vĩnh Hy qua những câu chuyện về đình thần, nghề đan lưới và cuộc sống ngư dân',
    stops: ['loc-4', 'loc-6'],
    image: 'https://images.unsplash.com/photo-1574303903621-1e9b56534f4d?w=800&h=500&fit=crop&auto=format',
  },
  {
    id: 'tour-3',
    code: 'T03',
    name: 'Toàn Khu Vĩnh Hy',
    nameEn: 'Full Vinh Hy Experience',
    duration: 150,
    description:
      'Tour đầy đủ nhất — ẩm thực, di tích, và cà phê view biển. Bao gồm tất cả 6 điểm dừng trong hành trình trải nghiệm trọn vẹn nhất',
    stops: ['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5', 'loc-6'],
    image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=500&fit=crop&auto=format',
  },
];

export const PACKAGES: Package[] = [
  {
    id: 'pkg-free',
    name: 'Khám phá miễn phí',
    price: 0,
    duration: 30,
    isFree: true,
    areas: ['Khu vực A — Bến cá'],
    languages: ['Tiếng Việt'],
    features: ['1 địa điểm', 'Thuyết minh tiếng Việt', 'Hiệu lực 30 phút'],
  },
  {
    id: 'pkg-basic',
    name: 'Gói Hải Sản',
    price: 49000,
    duration: 120,
    isFree: false,
    areas: ['Toàn bộ khu ẩm thực', 'Bến cá & chợ đêm'],
    languages: ['Tiếng Việt', 'English', '中文'],
    features: ['4 địa điểm', '3 ngôn ngữ', 'Hiệu lực 2 giờ', 'GPS tự động phát'],
  },
  {
    id: 'pkg-full',
    name: 'Gói Toàn Khu',
    price: 99000,
    duration: 360,
    isFree: false,
    areas: ['Toàn bộ khu Vĩnh Hy', 'Tất cả điểm tham quan'],
    languages: ['Tiếng Việt', 'English', '中文', '한국어', '日本語', 'Français'],
    features: ['6 địa điểm', '6 ngôn ngữ', 'Hiệu lực 6 giờ', 'GPS tự động phát', 'Offline mode', 'Tải về để nghe lại'],
  },
];

export const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];
