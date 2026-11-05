import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { LanguageToggle } from '../common/LanguageToggle';
import { Bi } from '../common/Bi';
import { BRAND_CONFIG } from '../../config/brand';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Sun, Moon, Building2 } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export type CampusThemeMode = 'original' | 'dark';

const LOGIN_THEME_STORAGE_KEY = 'ums_login_theme_mode';

const SLOGAN_PARTS_VI = ['Một nền tảng', 'Bốn vai trò', 'Một trường học thông minh'];
const SLOGAN_PARTS_EN = ['One platform', 'Four roles', 'Our smart school'];

// 30 ô cửa sổ phối cảnh thực tế trên Tòa A2 (cánh trái + cánh phải) & Tòa A1 (hệ tọa độ 941x522)
const CAMPUS_WINDOWS: Array<{
  points: string;
  delay: string;
  dur: string;
  warm?: boolean;
  zone: 'a2' | 'sides';
}> = [
  { points: '612,204 627,195 629,212 610,224', delay: '2.2s', dur: '4.8s', warm: true, zone: 'a2' },
  { points: '312,223 333,229 332,244 309,238', delay: '2.5s', dur: '5.4s', zone: 'a2' },
  { points: '344,233 365,239 363,253 342,247', delay: '2.8s', dur: '4.6s', warm: true, zone: 'a2' },
  { points: '546,248 556,242 557,256 545,264', delay: '2.4s', dur: '5.2s', zone: 'a2' },
  { points: '403,251 421,256 420,269 402,264', delay: '2.1s', dur: '5.8s', warm: true, zone: 'a2' },
  { points: '430,259 446,263 446,277 429,272', delay: '3.1s', dur: '4.9s', zone: 'a2' },
  { points: '456,266 471,271 471,283 455,279', delay: '2.6s', dur: '5.5s', warm: true, zone: 'a2' },
  { points: '479,274 493,278 493,290 479,285', delay: '3.4s', dur: '4.7s', zone: 'a2' },
  { points: '528,288 538,282 538,297 528,303', delay: '2.3s', dur: '5.1s', warm: true, zone: 'a2' },
  { points: '649,294 671,285 674,308 650,317', delay: '2.7s', dur: '4.5s', warm: true, zone: 'a2' },
  { points: '454,292 470,296 470,309 453,305', delay: '3.0s', dur: '5.6s', zone: 'a2' },
  { points: '619,307 638,299 640,321 620,329', delay: '2.1s', dur: '5.0s', zone: 'a2' },
  { points: '529,316 538,311 539,327 528,332', delay: '3.6s', dur: '4.8s', warm: true, zone: 'a2' },
  { points: '293,315 317,320 315,338 289,333', delay: '2.5s', dur: '5.3s', warm: true, zone: 'a2' },
  { points: '855,322 867,322 871,335 855,336', delay: '2.9s', dur: '4.9s', zone: 'sides' },
  { points: '478,325 493,329 493,342 477,338', delay: '3.2s', dur: '5.4s', zone: 'a2' },
  { points: '548,338 560,333 561,350 548,356', delay: '2.4s', dur: '4.7s', warm: true, zone: 'a2' },
  { points: '423,342 442,346 441,361 422,358', delay: '2.2s', dur: '5.2s', zone: 'a2' },
  { points: '595,354 612,348 614,369 595,375', delay: '2.8s', dur: '4.6s', warm: true, zone: 'a2' },
  { points: '324,356 347,360 345,379 320,375', delay: '3.3s', dur: '5.1s', warm: true, zone: 'a2' },
  { points: '549,370 561,366 562,385 549,388', delay: '2.5s', dur: '5.7s', zone: 'a2' },
  { points: '421,373 439,375 439,392 420,390', delay: '2.1s', dur: '4.9s', warm: true, zone: 'a2' },
  { points: '625,385 646,379 649,404 627,408', delay: '2.9s', dur: '5.3s', zone: 'a2' },
  { points: '278,387 306,391 303,410 274,409', delay: '2.6s', dur: '4.8s', warm: true, zone: 'a2' },
  { points: '572,398 587,395 589,415 572,418', delay: '2.3s', dur: '5.5s', zone: 'a2' },
  { points: '662,421 688,417 692,446 665,449', delay: '2.4s', dur: '4.7s', warm: true, zone: 'a2' },
  { points: '599,432 619,429 621,453 601,455', delay: '3.1s', dur: '5.2s', zone: 'a2' },
  { points: '349,434 373,436 370,457 346,455', delay: '2.2s', dur: '4.9s', warm: true, zone: 'a2' },
  { points: '416,440 435,441 435,460 414,459', delay: '2.7s', dur: '5.4s', zone: 'a2' },
];

const LOTUS_FIREFLIES = [
  { cx: 118, cy: 486, r: 2.3, delay: '2.2s' },
  { cx: 152, cy: 472, r: 1.9, delay: '2.8s' },
  { cx: 196, cy: 480, r: 2.5, delay: '3.4s' },
  { cx: 224, cy: 465, r: 1.8, delay: '2.5s' },
  { cx: 468, cy: 410, r: 2.1, delay: '2.6s' },
  { cx: 542, cy: 408, r: 2.2, delay: '3.7s' },
  { cx: 830, cy: 445, r: 2.0, delay: '2.4s' },
  { cx: 882, cy: 430, r: 2.3, delay: '3.1s' },
];

/**
 * Nền Kiến trúc 2D UMS Campus × Antigravity 2.0 (4 lớp WebP GPU 60fps-120fps):
 * - Chờ tải & giải mã (decode) xong 4 lớp ảnh WebP (~124KB tổng cộng) rồi mới kích hoạt frame 0,
 *   đảm bảo hiệu ứng Tòa nhà mở cánh & trồi lên luôn chạy mượt 100% không bị hụt nhịp đầu.
 * - Kịch bản 5 nhịp rõ ràng (kéo dài 3.5 giây):
 *   1) Tia sáng phác thảo khung kiến trúc (Blueprint Sketch Outline) từ chân móng lên mái (0.0s - 2.1s).
 *   2) Lớp 1 (campus-*-rotunda.webp): Sảnh vòm trung tâm "Create Opportunities Together" trồi lên (0.12s - 1.77s).
 *   3) Lớp 2 (campus-*-a2.webp): Tòa nhà A2 chữ V vừa mở cánh từ trục giữa ra 2 bên vừa trồi lên (0.40s - 2.45s).
 *   4) Lớp 3 (campus-*-sides.webp): Đầm sen & Hành lang (trái) + Tòa A1 (phải) mở bung ra 2 biên & trồi lên (1.00s - 2.95s).
 *   5) Lớp 4 (campus-*-skyline.webp): Quần thể Skyline Hồng/Tím Pastel trồi lên từ phía sau mái Tòa A2 (1.50s - 3.45s).
 */
const EcosystemNetworkBg: React.FC<{ mode: CampusThemeMode; revealSeq: number }> = ({
  mode,
  revealSeq,
}) => {
  const isOriginal = mode === 'original';
  const prefix = isOriginal ? 'orig' : 'dark';

  // Đảm bảo cả 4 lớp ảnh WebP đã được trình duyệt decode vào GPU trước khi bắt đầu hiệu ứng
  const [layersReady, setLayersReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urls = [
      `/campus-${prefix}-rotunda.webp`,
      `/campus-${prefix}-a2.webp`,
      `/campus-${prefix}-sides.webp`,
      `/campus-${prefix}-skyline.webp`,
    ];

    Promise.all(
      urls.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            if (typeof img.decode === 'function') {
              img.decode().then(() => resolve()).catch(() => resolve());
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    ).then(() => {
      if (!cancelled) {
        setLayersReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const cometPaths = [
    { d: 'M 180 185 C 290 85, 465 110, 565 245', delay: '0s' },
    { d: 'M 330 125 C 425 55, 535 120, 588 245', delay: '0.7s' },
    { d: 'M 475 90 C 535 45, 585 130, 600 245', delay: '1.4s' },
    { d: 'M 725 90 C 665 45, 615 130, 600 245', delay: '0.35s' },
    { d: 'M 870 125 C 775 55, 665 120, 612 245', delay: '1.1s' },
    { d: 'M 1020 185 C 910 85, 735 110, 635 245', delay: '1.85s' },
  ];

  // Đường phác thảo khung kiến trúc (Blueprint Sketch) tự vẽ từ chân móng lên khi tòa nhà bắt đầu mở
  const blueprintPaths = [
    'M 434 520 L 441 424 L 468 413 L 543 413 L 570 424 L 577 520',
    'M 218 520 L 300 189 L 503 252 L 661 150 L 721 181 L 784 520',
    'M 503 252 L 503 413',
    'M 48 520 L 48 453 Q 140 443 235 436 M 748 296 L 792 296 C 800 268, 828 268, 836 296 L 930 296 L 930 520',
  ];

  // Tia sáng chạy dọc theo mái nhà sau khi tòa nhà đã hiện lên
  const archTracePaths = [
    {
      d: 'M 218 520 L 300 189 L 503 252 L 661 150 L 721 181 L 784 520',
      delay: '2.2s',
      stroke: isOriginal ? 'url(#orig-trace-burgundy)' : 'url(#ums-comet-gold)',
      width: 2.3,
    },
    {
      d: 'M 271 253 L 303 197 L 503 259 L 661 158 L 718 189 M 503 252 L 503 413',
      delay: '2.8s',
      stroke: isOriginal ? 'url(#orig-trace-lavender)' : 'url(#ums-orbit-red)',
      width: 1.8,
    },
    {
      d: 'M 434 520 L 441 424 L 468 413 L 543 413 L 570 424 L 577 520',
      delay: '2.0s',
      stroke: isOriginal ? 'url(#orig-trace-burgundy)' : 'url(#ums-comet-gold)',
      width: 2.1,
    },
    {
      d: 'M 48 453 Q 140 443 235 436 M 748 296 L 792 296 C 800 268, 828 268, 836 296 L 930 296',
      delay: '3.2s',
      stroke: isOriginal ? 'url(#orig-trace-lavender)' : 'url(#ums-orbit-red)',
      width: 1.7,
    },
  ];

  return (
    <div
      className="login-anim-bg pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
      data-testid="login-network-bg"
      data-theme-mode={mode}
    >
      {/* 1. Nền bầu trời: Chế độ Sáng (#FCF6F6 Kem Hồng Phấn) hoặc Chế độ Đêm (#090206 Đêm Đỏ Đô) */}
      {isOriginal ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 34%, #FFFFFF 0%, #FDF7F8 45%, #F9ECEF 80%, #F5E1E7 100%)',
            }}
          />
          <div
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[780px] h-[460px] rounded-full blur-3xl opacity-75"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(246, 203, 214, 0.55) 0%, rgba(223, 213, 232, 0.45) 52%, transparent 78%)',
            }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 38%, rgba(190, 24, 60, 0.38) 0%, rgba(139, 26, 74, 0.24) 36%, rgba(20, 5, 12, 0.96) 70%, #090206 100%)',
            }}
          />
          <div
            className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[680px] h-[420px] rounded-full blur-3xl opacity-55"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.30) 0%, rgba(225, 29, 72, 0.20) 52%, transparent 78%)',
            }}
          />
        </>
      )}

      {/* 2. Vòng cung quỹ đạo & Sao băng hội tụ trên bầu trời UMS */}
      <svg
        className="w-full h-full absolute inset-0 z-10"
        viewBox="0 0 1200 720"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="ums-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={isOriginal ? '3.2' : '4.5'} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="orig-orbit-burgundy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7B173B" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#C81E5D" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#F472B6" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="orig-orbit-lavender" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.08" />
            <stop offset="55%" stopColor="#9333EA" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7B173B" stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id="orig-comet-rose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" stopOpacity="0.05" />
            <stop offset="60%" stopColor="#C81E5D" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#7B173B" stopOpacity="0.92" />
          </linearGradient>

          <linearGradient id="ums-orbit-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF3B30" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#E11D48" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#8B1A4A" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="ums-comet-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB923C" stopOpacity="0.05" />
            <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.98" />
          </linearGradient>
        </defs>

        <g className="animate-orbit-cw" filter="url(#ums-neon-glow)">
          <circle
            cx="600"
            cy="310"
            r="250"
            fill="none"
            stroke={isOriginal ? 'url(#orig-orbit-burgundy)' : 'url(#ums-orbit-red)'}
            strokeWidth={isOriginal ? '1.8' : '2.1'}
            strokeLinecap="round"
            strokeDasharray="220 210 130 280"
          />
        </g>
        <g className="animate-orbit-ccw" filter="url(#ums-neon-glow)">
          <circle
            cx="600"
            cy="310"
            r="315"
            fill="none"
            stroke={isOriginal ? 'url(#orig-orbit-lavender)' : 'url(#ums-comet-gold)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="160 280 110 340"
            opacity={isOriginal ? '0.75' : '0.68'}
          />
        </g>
        <g className="animate-orbit-cw" style={{ animationDuration: '40s' }}>
          <circle
            cx="600"
            cy="310"
            r="380"
            fill="none"
            stroke={isOriginal ? 'url(#orig-orbit-burgundy)' : 'url(#ums-orbit-red)'}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="90 360 140 380"
            opacity={isOriginal ? '0.45' : '0.38'}
          />
        </g>

        {cometPaths.map((comet, idx) => (
          <g key={`comet-${idx}`}>
            <path
              d={comet.d}
              fill="none"
              stroke={
                isOriginal
                  ? 'rgba(123, 23, 59, 0.08)'
                  : 'rgba(251, 146, 60, 0.09)'
              }
              strokeWidth="1"
            />
            <path
              d={comet.d}
              fill="none"
              stroke={isOriginal ? 'url(#orig-comet-rose)' : 'url(#ums-comet-gold)'}
              strokeWidth="2.1"
              strokeLinecap="round"
              filter="url(#ums-neon-glow)"
              className="animate-comet-trail"
              style={{ animationDelay: comet.delay }}
            />
          </g>
        ))}
      </svg>

      {/* 3. TỔ HỢP 4 LỚP KIẾN TRÚC GPU (WEBP): MỞ CÁNH TỪ TÂM & TRỒI TỪ DƯỚI ĐẤT LÊN */}
      {layersReady && (
        <div
          key={`campus-stage-${revealSeq}-${mode}`}
          className="absolute inset-x-0 bottom-0 z-10 flex justify-center items-end overflow-hidden"
          data-testid="ums-campus-unfold-stage"
        >
          <div
            className="relative w-full max-w-[1360px] aspect-[941/522] max-h-[83vh]"
            style={{
              filter: isOriginal
                ? 'drop-shadow(0 -4px 18px rgba(123, 23, 59, 0.11))'
                : 'drop-shadow(0 -6px 24px rgba(225, 29, 72, 0.26))',
            }}
          >
            {/* LỚP 4 (Xa nhất — 1.50s..3.45s): Quần thể Skyline Hồng Pastel & Tím Lavender trồi lên từ sau mái Tòa A2 */}
            <div className="absolute inset-0 z-10 animate-ums-layer-skyline-rise">
              <img
                src={`/campus-${prefix}-skyline.webp`}
                alt=""
                decoding="sync"
                className="w-full h-full object-contain object-bottom"
              />
            </div>

            {/* LỚP 3 (Hai cánh phụ — 1.00s..2.95s): Đầm sen & Hành lang (Trái) + Tòa A1 (Phải) mở bung ra 2 biên & trồi lên */}
            <div className="absolute inset-0 z-20 animate-ums-layer-sides-rise">
              <div className="w-full h-full animate-ums-layer-sides-unfold">
                <img
                  src={`/campus-${prefix}-sides.webp`}
                  alt=""
                  decoding="sync"
                  className="w-full h-full object-contain object-bottom"
                />
              </div>
            </div>

            {/* LỚP 2 (Tòa nhà chính A2 chữ V — 0.40s..2.45s): Vừa mở cánh từ trục giữa (x=53.5%) ra 2 bên vừa trồi từ dưới đất lên */}
            <div className="absolute inset-0 z-30 animate-ums-layer-a2-rise">
              <div className="w-full h-full animate-ums-layer-a2-unfold">
                <img
                  src={`/campus-${prefix}-a2.webp`}
                  alt=""
                  decoding="sync"
                  className="w-full h-full object-contain object-bottom"
                />
              </div>
            </div>

            {/* LỚP 1 (Trung tâm mặt tiền — 0.12s..1.77s): Sảnh vòm "Create Opportunities Together" trồi lên đầu tiên */}
            <div className="absolute inset-0 z-40 animate-ums-layer-rotunda">
              <img
                src={`/campus-${prefix}-rotunda.webp`}
                alt="Kiến trúc Tòa nhà A2 - A1 Trường THCS Ngoại ngữ UMS"
                decoding="sync"
                className="w-full h-full object-contain object-bottom"
              />
            </div>

            {/* LỚP 5 (Vector SVG 941x522): Phác thảo tia sáng (Blueprint Sketch), 2 Cổng ánh sáng mở cánh, 30 Cửa sổ & Đom đóm */}
            <svg
              viewBox="0 0 941 522"
              preserveAspectRatio="xMidYMax meet"
              className="absolute inset-0 z-50 w-full h-full overflow-visible"
            >
              <defs>
                <linearGradient id="orig-win-warm" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.82" />
                  <stop offset="55%" stopColor="#F9A8D4" stopOpacity="0.62" />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity="0.28" />
                </linearGradient>
                <linearGradient id="orig-win-pastel" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F5D0FE" stopOpacity="0.78" />
                  <stop offset="60%" stopColor="#DDD6FE" stopOpacity="0.62" />
                  <stop offset="100%" stopColor="#9333EA" stopOpacity="0.26" />
                </linearGradient>
                <linearGradient id="orig-trace-burgundy" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7B173B" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#E11D48" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#F472B6" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="orig-trace-lavender" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9333EA" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#C81E5D" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#7B173B" stopOpacity="0.95" />
                </linearGradient>

                <linearGradient id="win-warm-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.72" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.32" />
                </linearGradient>
                <linearGradient id="win-rose-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FECDD3" stopOpacity="0.62" />
                  <stop offset="100%" stopColor="#FB7185" stopOpacity="0.25" />
                </linearGradient>

                <linearGradient id="curtain-beam-orig" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#C81E5D" stopOpacity="0" />
                  <stop offset="30%" stopColor="#C81E5D" stopOpacity="0.7" />
                  <stop offset="75%" stopColor="#7B173B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#9333EA" stopOpacity="0.25" />
                </linearGradient>
                <linearGradient id="curtain-beam-dark" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0" />
                  <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.85" />
                  <stop offset="75%" stopColor="#E11D48" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#8B1A4A" stopOpacity="0.25" />
                </linearGradient>
              </defs>

              {/* 5.1) Bản vẽ khung kiến trúc bằng tia sáng (Blueprint Sketch) tự vẽ từ chân móng lên (0.0s - 2.1s) */}
              {blueprintPaths.map((d, idx) => (
                <path
                  key={`bp-${idx}`}
                  d={d}
                  fill="none"
                  stroke={isOriginal ? 'url(#orig-trace-burgundy)' : 'url(#ums-comet-gold)'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-ums-blueprint"
                />
              ))}

              {/* 5.2) Tia sáng nền móng & 2 Cổng ánh sáng đứng quét mở 2 cánh tòa nhà */}
              <g className="animate-ums-foundation">
                <line
                  x1="35"
                  y1="519"
                  x2="910"
                  y2="519"
                  stroke={isOriginal ? 'url(#orig-trace-burgundy)' : 'url(#ums-comet-gold)'}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>
              <g className="animate-ums-curtain-left">
                <line
                  x1="503"
                  y1="145"
                  x2="503"
                  y2="520"
                  stroke={isOriginal ? 'url(#curtain-beam-orig)' : 'url(#curtain-beam-dark)'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>
              <g className="animate-ums-curtain-right">
                <line
                  x1="503"
                  y1="145"
                  x2="503"
                  y2="520"
                  stroke={isOriginal ? 'url(#curtain-beam-orig)' : 'url(#curtain-beam-dark)'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>

              {/* 5.3) 30 Ô cửa sổ lớp học Tòa A2 & A1 bật sáng ấm áp sau khi tòa nhà trồi lên */}
              {CAMPUS_WINDOWS.map((win, idx) => (
                <polygon
                  key={`win-${idx}`}
                  points={win.points}
                  fill={
                    isOriginal
                      ? win.warm
                        ? 'url(#orig-win-warm)'
                        : 'url(#orig-win-pastel)'
                      : win.warm
                      ? 'url(#win-warm-gold)'
                      : 'url(#win-rose-glow)'
                  }
                  className="animate-campus-window"
                  style={{
                    animationDelay: win.delay,
                    animationDuration: win.dur,
                  }}
                />
              ))}

              {/* 5.4) Tia sáng lướt dọc theo mái chữ V Tòa A2, Sảnh Rotunda, Hành lang Đầm sen & Tòa A1 */}
              {archTracePaths.map((tr, idx) => (
                <path
                  key={`trace-${idx}`}
                  d={tr.d}
                  fill="none"
                  stroke={tr.stroke}
                  strokeWidth={tr.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-campus-trace"
                  style={{ animationDelay: tr.delay }}
                />
              ))}

              {/* 5.5) Cánh chim & Đom đóm đầm sen */}
              <g className="animate-campus-birds" opacity="0.88">
                <path
                  d="M 358 158 Q 364 152 370 157 Q 376 152 382 158"
                  fill="none"
                  stroke={isOriginal ? '#7B173B' : '#FDE68A'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 386 149 Q 391 144 396 148 Q 401 144 406 149"
                  fill="none"
                  stroke={isOriginal ? '#C81E5D' : '#FDA4AF'}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </g>

              {LOTUS_FIREFLIES.map((f, idx) => (
                <circle
                  key={`firefly-${idx}`}
                  cx={f.cx}
                  cy={f.cy}
                  r={f.r}
                  fill={isOriginal ? '#C81E5D' : '#FDE68A'}
                  className="animate-campus-firefly"
                  style={{ animationDelay: f.delay }}
                />
              ))}
            </svg>
          </div>

          {/* Lớp sương mờ chuyển tiếp dưới chân tòa nhà */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-12"
            style={{
              background: isOriginal
                ? 'linear-gradient(to top, rgba(252, 246, 246, 0.85) 0%, rgba(252, 246, 246, 0.25) 55%, transparent 100%)'
                : 'linear-gradient(to top, rgba(9, 2, 6, 0.92) 0%, rgba(9, 2, 6, 0.35) 55%, transparent 100%)',
            }}
          />
        </div>
      )}
    </div>
  );
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login, error, isLoading, clearError } = useAuth();
  const { t, language } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorSeq, setErrorSeq] = useState(0);

  // Chế độ giao diện Sáng ('original') / Đêm ('dark') có lưu vào localStorage
  const [themeMode, setThemeMode] = useState<CampusThemeMode>(() => {
    try {
      const saved = localStorage.getItem(LOGIN_THEME_STORAGE_KEY);
      if (saved === 'original' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'original';
  });
  const isOriginal = themeMode === 'original';

  // Chu kỳ hiệu ứng Tòa nhà mở cánh & trồi lên (chạy khi vào trang + lặp tự động mỗi 12s khi chưa gõ phím + bấm nút xem lại)
  const [revealSeq, setRevealSeq] = useState(0);

  const handleSelectThemeMode = (nextMode: CampusThemeMode) => {
    setThemeMode(nextMode);
    setRevealSeq((s) => s + 1);
    try {
      localStorage.setItem(LOGIN_THEME_STORAGE_KEY, nextMode);
    } catch {
      // Ignore storage write errors
    }
  };

  useEffect(() => {
    // Tự động lặp lại màn trình diễn "Tòa nhà mở cánh & trồi lên" mỗi 12 giây (nếu người dùng đang dừng ở màn hình chờ)
    const interval = setInterval(() => {
      if (!username && !password) {
        setRevealSeq((s) => s + 1);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [username, password]);

  // Motion 1: Chuyển chữ UMS+ <-> UMS SmartConnect
  const [brandExpanded, setBrandExpanded] = useState(false);

  // Motion 2: Khẩu hiệu lần lượt hiện từng vế (0 -> 1 -> 2), sau đó hiện full (3)
  const [sloganStage, setSloganStage] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const runBrandCycle = (expanded: boolean) => {
      setBrandExpanded(expanded);
      timeoutId = setTimeout(
        () => runBrandCycle(!expanded),
        expanded ? 4600 : 1800
      );
    };
    timeoutId = setTimeout(() => runBrandCycle(true), 1400);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const durations: Record<0 | 1 | 2 | 3, number> = {
      0: 1100,
      1: 1100,
      2: 1200,
      3: 3600,
    };
    const timer = setTimeout(() => {
      setSloganStage((prev) => ((prev + 1) % 4) as 0 | 1 | 2 | 3);
    }, durations[sloganStage]);
    return () => clearTimeout(timer);
  }, [sloganStage]);

  const sloganParts = language === 'vi' ? SLOGAN_PARTS_VI : SLOGAN_PARTS_EN;

  // Chỉ bản dev (import.meta.env.DEV)
  const DEMO_ACCOUNTS = import.meta.env.DEV
    ? [
        { label: 'BGH — Cô Huyền Trang (Hiệu trưởng)', u: 'mshuyentrangums', p: 'Demo@2026' },
        { label: 'BGH — Thầy Bình (Phó Hiệu trưởng)', u: 'mrbinhums', p: 'Demo@2026' },
        { label: 'Tổ trưởng — Cô Mai (Tổ Tự nhiên)', u: 'msmaiums', p: 'Demo@2026' },
        { label: 'GVCN 9A1 — Cô Ngọc Anh', u: 'msngocanhums', p: 'Demo@2026' },
        { label: 'GVBM Toán — Thầy Linh', u: 'mrlinhums', p: 'Demo@2026' },
        { label: 'Học sinh 9A1 — Nguyễn Mai An', u: 'hs9a1_01', p: 'Demo@2026' },
        { label: 'Phụ huynh 9A1 — PH em Minh Anh', u: 'ph_hs9a1_01', p: 'Demo@2026' },
      ]
    : [];

  const handleQuickSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedU = e.target.value;
    if (!selectedU) return;
    const acc = DEMO_ACCOUNTS.find((a) => a.u === selectedU);
    if (acc) {
      setUsername(acc.u);
      setPassword(acc.p);
      setLocalError(null);
      if (clearError) clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError('Vui lòng nhập tên đăng nhập.');
      setErrorSeq((s) => s + 1);
      return;
    }
    if (!password) {
      setLocalError('Vui lòng nhập mật khẩu.');
      setErrorSeq((s) => s + 1);
      return;
    }

    try {
      await login(username.trim(), password);
      if (onSuccess) onSuccess();
    } catch {
      setErrorSeq((s) => s + 1);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-center py-8 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-500 ${
        isOriginal ? 'bg-[#FCF6F6] text-[#4A0E24]' : 'bg-[#090206] text-white'
      }`}
    >
      {/* Animated Orbital, Comet & 4-Layer 2D UMS Campus Unfold-and-Rise Background */}
      <EcosystemNetworkBg mode={themeMode} revealSeq={revealSeq} />

      {/* Bộ chuyển đổi 2 chế độ Giao diện Sáng / Đêm + Nút kích hoạt hiệu ứng Tòa nhà ở góc trái trên */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div
          role="group"
          aria-label="Chế độ giao diện Sáng hoặc Đêm"
          data-testid="login-theme-switcher"
          className={`inline-flex items-center rounded-full p-1 text-xs font-semibold backdrop-blur-md shadow-sm border transition-all ${
            isOriginal
              ? 'bg-white/90 border-[#7B173B]/20 text-[#7B173B]'
              : 'bg-black/45 border-white/15 text-amber-100'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSelectThemeMode('original')}
            data-testid="theme-mode-original"
            aria-pressed={isOriginal}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              isOriginal
                ? 'bg-[#7B173B] text-white shadow-sm'
                : 'text-amber-100/80 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Light' : 'Sáng'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectThemeMode('dark')}
            data-testid="theme-mode-dark"
            aria-pressed={!isOriginal}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              !isOriginal
                ? 'bg-gradient-to-r from-[#8B1A4A] to-[#d9532f] text-white shadow-sm'
                : 'text-[#7B173B]/75 hover:text-[#7B173B]'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Night' : 'Đêm'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setRevealSeq((s) => s + 1)}
          data-testid="replay-campus-unfold"
          title={
            language === 'en'
              ? 'Replay UMS Campus unfold & rise animation'
              : 'Xem hiệu ứng Tòa nhà UMS mở cánh & trồi lên'
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-sm border transition-all cursor-pointer ${
            isOriginal
              ? 'bg-white/90 border-[#7B173B]/20 text-[#7B173B] hover:bg-[#7B173B] hover:text-white'
              : 'bg-black/45 border-white/15 text-amber-100 hover:bg-white/15'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {language === 'en' ? 'Campus Motion' : 'Hiệu ứng Tòa nhà'}
          </span>
        </button>
      </div>

      {/* Nút ngôn ngữ góc phải trên */}
      <div className="absolute top-4 right-4 z-30">
        <LanguageToggle variant={isOriginal ? 'dark' : 'light'} />
      </div>

      {/* Cụm tiêu đề tối giản: Logo -> Motion UMS+ thành UMS SmartConnect -> Khẩu hiệu tuần tự */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center px-4 relative z-20 animate-login-card">
        <div className="flex justify-center mb-3.5">
          <div
            className={`relative p-2 rounded-2xl shadow-xl inline-block ${
              isOriginal
                ? 'bg-white border-2 border-[#7B173B]/20 shadow-[#7B173B]/15'
                : 'bg-white/95 border border-amber-200/60'
            }`}
          >
            <img
              src={BRAND_CONFIG.logoPath}
              alt="UMS Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Motion 1: Chuyển mượt từ "UMS+" sang "UMS SmartConnect" */}
        <div
          className="inline-flex items-baseline justify-center"
          data-testid="login-kinetic-title"
        >
          <span
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isOriginal
                ? 'text-[#6B1236] drop-shadow-[0_2px_10px_rgba(255,255,255,0.95)]'
                : 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]'
            }`}
          >
            UMS
          </span>

          {/* Dấu "+" thu xoay mượt khi bung chữ SmartConnect */}
          <span
            className={`inline-block font-extrabold text-2xl sm:text-3xl bg-clip-text text-transparent transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] origin-left overflow-hidden ${
              isOriginal
                ? 'bg-gradient-to-tr from-[#7B173B] via-[#C81E5D] to-[#9333EA]'
                : 'bg-gradient-to-tr from-amber-300 via-orange-400 to-rose-400'
            } ${
              brandExpanded
                ? 'max-w-0 opacity-0 scale-50 -rotate-45 blur-[3px]'
                : 'max-w-[32px] opacity-100 scale-100 rotate-0 blur-0 ml-0.5'
            }`}
          >
            +
          </span>

          {/* Cụm "SmartConnect" trượt mở mượt từ vị trí dấu "+" */}
          <span
            className={`inline-block font-extrabold text-2xl sm:text-3xl tracking-tight bg-clip-text text-transparent transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden whitespace-nowrap ${
              isOriginal
                ? 'bg-gradient-to-r from-[#8B1A4A] via-[#C81E5D] to-[#7E22CE]'
                : 'bg-gradient-to-r from-amber-200 via-orange-300 to-rose-300'
            } ${
              brandExpanded
                ? 'max-w-[260px] opacity-100 translate-x-0 blur-0 ml-2'
                : 'max-w-0 opacity-0 -translate-x-2 blur-[4px] ml-0'
            }`}
          >
            SmartConnect
          </span>

          <span
            className={`w-0.5 h-5 inline-block self-center ml-1.5 animate-caret-blink ${
              isOriginal ? 'bg-[#C81E5D]' : 'bg-amber-400'
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Vệt tia sáng laser mảnh dưới tiêu đề */}
        <div
          className={`relative mx-auto mt-1.5 h-[1.5px] w-44 overflow-hidden rounded-full ${
            isOriginal ? 'bg-[#7B173B]/15' : 'bg-white/10'
          }`}
        >
          <div
            className={`h-full w-full animate-laser-sweep ${
              isOriginal
                ? 'bg-gradient-to-r from-transparent via-[#C81E5D] to-transparent'
                : 'bg-gradient-to-r from-transparent via-amber-400 to-transparent'
            }`}
          />
        </div>

        {/* Motion 2: Khẩu hiệu lần lượt hiện từng vế rồi hiện full khẩu hiệu */}
        <div
          data-testid="login-slogan-motion"
          className="mt-2.5 h-6 flex items-center justify-center overflow-hidden"
        >
          {sloganStage < 3 ? (
            <span
              key={`part-${sloganStage}`}
              className={`text-xs sm:text-sm font-bold tracking-wide animate-kinetic-word ${
                isOriginal
                  ? 'text-[#7B173B] drop-shadow-[0_1px_6px_rgba(255,255,255,0.95)]'
                  : 'text-amber-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]'
              }`}
            >
              {sloganParts[sloganStage]}
            </span>
          ) : (
            <div
              key="slogan-full"
              className={`inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-bold tracking-wide animate-kinetic-word whitespace-nowrap ${
                isOriginal
                  ? 'text-[#7B173B] drop-shadow-[0_1px_6px_rgba(255,255,255,0.95)]'
                  : 'text-amber-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]'
              }`}
            >
              <span>{sloganParts[0]}</span>
              <span className={isOriginal ? 'text-[#C81E5D]' : 'text-amber-400'}>•</span>
              <span>{sloganParts[1]}</span>
              <span className={isOriginal ? 'text-[#C81E5D]' : 'text-amber-400'}>•</span>
              <span>{sloganParts[2]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Thẻ đăng nhập Glassmorphism trong suốt vừa đủ để tôn vinh kiến trúc Tòa A2 phía sau */}
      <div
        className="mt-4 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-20 animate-login-card"
        style={{ animationDelay: '70ms' }}
      >
        <div
          className="pointer-events-none absolute -inset-1 rounded-3xl opacity-60 blur-xl"
          style={{
            background: isOriginal
              ? 'linear-gradient(135deg, rgba(244, 114, 182, 0.28), rgba(223, 213, 232, 0.45), rgba(123, 23, 59, 0.22))'
              : 'linear-gradient(135deg, rgba(251, 146, 60, 0.25), rgba(225, 29, 72, 0.25), rgba(139, 26, 74, 0.28))',
          }}
          aria-hidden="true"
        />

        <div
          className={`relative backdrop-blur-xl py-6 px-5 rounded-2xl sm:px-8 border overflow-hidden transition-colors duration-500 ${
            isOriginal
              ? 'bg-white/80 border-[#7B173B]/20'
              : 'bg-[#14070e]/78 border-amber-300/25'
          }`}
          style={{
            boxShadow: isOriginal
              ? '0 24px 60px -15px rgba(123, 23, 59, 0.18), 0 0 32px -8px rgba(200, 30, 93, 0.14)'
              : '0 24px 60px -15px rgba(0, 0, 0, 0.85), 0 0 36px -8px rgba(249, 115, 22, 0.22)',
          }}
        >
          {/* Viền sáng hội tụ trên đỉnh thẻ */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px]"
            style={{
              background: isOriginal
                ? 'linear-gradient(90deg, transparent 5%, rgba(168, 85, 247, 0.55) 30%, rgba(123, 23, 59, 0.9) 50%, rgba(225, 29, 72, 0.65) 70%, transparent 95%)'
                : 'linear-gradient(90deg, transparent 5%, rgba(251, 146, 60, 0.7) 35%, rgba(254, 240, 138, 0.95) 50%, rgba(225, 29, 72, 0.7) 65%, transparent 95%)',
            }}
            aria-hidden="true"
          />

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Error Display */}
            {(error || localError) && (
              <div
                key={errorSeq}
                className={`rounded-xl p-3 border flex items-start space-x-2.5 animate-login-shake ${
                  isOriginal
                    ? 'bg-rose-50/95 border-rose-300 text-rose-900'
                    : 'bg-rose-950/80 border-rose-500/40 text-rose-100'
                }`}
                role="alert"
              >
                <AlertCircle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    isOriginal ? 'text-rose-600' : 'text-rose-400'
                  }`}
                />
                <div className="text-xs font-medium">{localError || error}</div>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label
                htmlFor="username-input"
                className={`block text-xs font-semibold mb-1.5 ${
                  isOriginal ? 'text-[#5A102B]' : 'text-amber-100/90'
                }`}
              >
                <Bi
                  vi="Tên đăng nhập"
                  en="Username"
                  layout="inline"
                  secondaryClassName={isOriginal ? 'text-[#7B173B]/65' : 'text-amber-200/60'}
                />
              </label>
              <div className="relative rounded-xl">
                <div
                  className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${
                    isOriginal ? 'text-[#7B173B]/65' : 'text-amber-300/60'
                  }`}
                >
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username-input"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (clearError) clearError();
                    setLocalError(null);
                  }}
                  placeholder={t.auth.usernamePlaceholder}
                  className={`block w-full pl-9 pr-3 py-2.5 sm:text-sm rounded-xl border transition-all ${
                    isOriginal
                      ? 'bg-white/90 text-[#3B0A1E] placeholder-[#7B173B]/40 border-[#7B173B]/25 focus:ring-2 focus:ring-[#C81E5D] focus:border-[#C81E5D] focus:bg-white'
                      : 'bg-black/35 text-white placeholder-rose-200/40 border-white/15 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-black/50'
                  }`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password-input"
                className={`block text-xs font-semibold mb-1.5 ${
                  isOriginal ? 'text-[#5A102B]' : 'text-amber-100/90'
                }`}
              >
                <Bi
                  vi="Mật khẩu"
                  en="Password"
                  layout="inline"
                  secondaryClassName={isOriginal ? 'text-[#7B173B]/65' : 'text-amber-200/60'}
                />
              </label>
              <div className="relative rounded-xl">
                <div
                  className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${
                    isOriginal ? 'text-[#7B173B]/65' : 'text-amber-300/60'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (clearError) clearError();
                    setLocalError(null);
                  }}
                  placeholder={t.auth.passwordPlaceholder}
                  className={`block w-full pl-9 pr-9 py-2.5 sm:text-sm rounded-xl border transition-all ${
                    isOriginal
                      ? 'bg-white/90 text-[#3B0A1E] placeholder-[#7B173B]/40 border-[#7B173B]/25 focus:ring-2 focus:ring-[#C81E5D] focus:border-[#C81E5D] focus:bg-white'
                      : 'bg-black/35 text-white placeholder-rose-200/40 border-white/15 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-black/50'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`focus:outline-none p-1 rounded-md ${
                      isOriginal
                        ? 'text-[#7B173B]/55 hover:text-[#7B173B]'
                        : 'text-amber-200/50 hover:text-amber-200'
                    }`}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                data-testid="login-submit-btn"
                className={`w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  isOriginal
                    ? 'border border-[#7B173B]/30 shadow-lg shadow-[#7B173B]/25 bg-gradient-to-r from-[#7B173B] via-[#A31D54] to-[#C81E5D] hover:from-[#651130] hover:via-[#8B1A4A] hover:to-[#B11850] focus:ring-2 focus:ring-[#C81E5D]'
                    : 'border border-amber-300/30 shadow-lg shadow-rose-950/60 bg-gradient-to-r from-[#8B1A4A] via-[#b8235a] to-[#d9532f] hover:from-[#a11f56] hover:via-[#cc2965] hover:to-[#ea623b] focus:ring-2 focus:ring-amber-400'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <Bi vi="Đang đăng nhập..." en="Signing in..." layout="inline" secondaryClassName="text-white/85" />
                  </span>
                ) : (
                  <>
                    <Bi vi="Đăng nhập" en="Sign in" layout="inline" secondaryClassName="text-white/85" />
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Chọn nhanh tài khoản thử nghiệm — chỉ bản dev */}
            {DEMO_ACCOUNTS.length > 0 && (
              <div
                className={`pt-2 border-t ${
                  isOriginal ? 'border-[#7B173B]/15' : 'border-white/10'
                }`}
              >
                <select
                  id="quick-select-account"
                  aria-label="Chọn nhanh tài khoản thử nghiệm"
                  onChange={handleQuickSelect}
                  defaultValue=""
                  className={`block w-full text-xs rounded-lg py-1.5 px-2.5 border cursor-pointer ${
                    isOriginal
                      ? 'bg-[#FDF7F8] border-[#7B173B]/20 text-[#5A102B] focus:border-[#C81E5D] focus:ring-[#C81E5D]'
                      : 'bg-black/30 border-white/10 text-amber-100/75 focus:border-amber-400 focus:ring-amber-400'
                  }`}
                >
                  <option
                    value=""
                    disabled
                    className={
                      isOriginal
                        ? 'bg-white text-[#7B173B]/70'
                        : 'bg-[#16070f] text-amber-200/70'
                    }
                  >
                    {language === 'vi'
                      ? '⚡ Chọn nhanh tài khoản thử nghiệm (Demo)...'
                      : '⚡ Quick-select demo account...'}
                  </option>
                  {DEMO_ACCOUNTS.map((acc) => (
                    <option
                      key={acc.u}
                      value={acc.u}
                      className={
                        isOriginal ? 'bg-white text-[#3B0A1E]' : 'bg-[#16070f] text-white'
                      }
                    >
                      {acc.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
