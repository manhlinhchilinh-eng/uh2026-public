/**
 * UMS SmartConnect - Hệ sinh thái phân hệ
 * Một chỗ để mọi vai trò thấy và mở các phân hệ của nền tảng.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowRight, Hammer, LayoutGrid } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Bi } from '../components/common/Bi';
import { BrandMark } from '../components/common/BrandMark';
import { Modal } from '../components/common/Modal';
import { BRAND_CONFIG } from '../config/brand';
import { MODULE_GROUPS, modulesForRole, type ModuleStatus, type PlatformModule } from '../config/modules';

const STATUS_BADGE: Record<ModuleStatus, { label: string; labelEn: string; className: string }> = {
  live: { label: 'Đang chạy', labelEn: 'Live', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  internal: { label: 'Chạy nội bộ', labelEn: 'Internal', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  building: { label: 'Đang phát triển', labelEn: 'Building', className: 'bg-amber-50 text-amber-800 border-amber-200' },
};

export const AppsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const [toolsOpen, setToolsOpen] = useState(false);
  const visible = modulesForRole(activeRole);
  // Ô riêng ở lưới; các công cụ học tập/đánh giá gom vào một thẻ, bấm mới hiện — mỗi vai trò chỉ thấy lối vào của mình
  const modules = visible.filter((m) => !m.group);
  const groups = MODULE_GROUPS.map((g) => ({ ...g, items: visible.filter((m) => m.group === g.id) })).filter(
    (g) => g.items.length > 0
  );
  const openModule = (m: PlatformModule) => {
    if (m.path) navigate(m.path);
    else if (m.externalUrl) window.open(m.externalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#8B1A4A] to-[#6B1338] text-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="p-1.5 bg-white rounded-2xl shadow-sm shrink-0">
          <BrandMark app="umsplus" size={44} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight">
            <Bi
              vi={`Hệ sinh thái ${BRAND_CONFIG.platformName} (${BRAND_CONFIG.platformShort})`}
              en={`${BRAND_CONFIG.platformName} Ecosystem (${BRAND_CONFIG.platformShort})`}
              layout="inline"
              secondaryClassName="text-white/80 opacity-85"
            />
          </h2>
          <p className="text-xs sm:text-sm text-white/85 mt-1">{BRAND_CONFIG.sloganVi}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map((m) => {
          const badge = STATUS_BADGE[m.status];
          const canOpen = Boolean(m.path || m.externalUrl);
          const open = () => openModule(m);
          return (
            <div
              key={m.id}
              data-testid={`module-${m.id}`}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-1 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
                    <BrandMark app={m.logoSlug || 'umsplus'} size={36} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 pt-0.5 min-w-0 flex-1">
                    <Bi vi={m.name} en={m.nameEn || m.name} wrap className="w-full" />
                  </h3>
                </div>
                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.className}`}>
                  <Bi vi={badge.label} en={badge.labelEn} layout="inline" />
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 flex-1">{m.description}</p>
              {canOpen ? (
                <button
                  type="button"
                  onClick={open}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-ums-50 text-[#8B1A4A] hover:bg-rose-100 transition-colors"
                >
                  {m.externalUrl ? (
                    <>
                      <Bi vi="Mở ứng dụng" en="Open App" layout="inline" /> <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <Bi vi="Vào phân hệ" en="Open Module" layout="inline" /> <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              ) : (
                <span className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-50 text-slate-400">
                  <Hammer className="w-3.5 h-3.5" /> Sắp có trong {BRAND_CONFIG.platformShort}
                </span>
              )}
            </div>
          );
        })}
        {groups.length > 0 && (
          <div
            data-testid="module-group-k9"
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-1 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
                  <BrandMark app="homeroom9" size={36} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 pt-0.5 min-w-0 flex-1">
                  <Bi vi="Học tập & Đánh giá" en="Learning & Assessment" wrap className="w-full" />
                </h3>
              </div>
              <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_BADGE.live.className}`}>
                <Bi vi={STATUS_BADGE.live.label} en={STATUS_BADGE.live.labelEn} layout="inline" />
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 flex-1">
              Kiểm tra định kì, luyện tập, sổ điểm, chấm trắc nghiệm theo môn. Đang thí điểm: Tiếng Anh khối 9.
            </p>
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-ums-50 text-[#8B1A4A] hover:bg-rose-100 transition-colors"
            >
              <Bi vi={`Mở ${groups.reduce((n, g) => n + g.items.length, 0)} công cụ`} en="Open tools" layout="inline" /> <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={toolsOpen}
        onClose={() => setToolsOpen(false)}
        maxWidth="2xl"
        title={<Bi vi="Học tập & Đánh giá" en="Learning & Assessment" layout="inline" />}
      >
        <div data-testid="module-group-tools" className="space-y-4">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                <Bi vi={g.name} en={g.nameEn} layout="inline" />
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {g.items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`module-${m.id}`}
                    onClick={() => openModule(m)}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 text-left hover:bg-ums-50 hover:border-rose-200 transition-colors"
                  >
                    <BrandMark app={m.logoSlug || 'umsplus'} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-800">
                        <Bi vi={m.shortName || m.name} en={m.shortNameEn || m.nameEn || m.name} layout="inline" />
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-2">{m.description}</span>
                    </span>
                    {m.externalUrl ? (
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
