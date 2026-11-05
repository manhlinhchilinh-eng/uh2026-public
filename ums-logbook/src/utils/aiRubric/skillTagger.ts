/**
 * Skill Tagging Engine — chuyển 1:1 từ ums_growth_hub/app/core/skill_tagger.py.
 */

import { CATEGORY_PRIORS, SKILL_TAXONOMY } from './skillTaxonomy';
import { detectLanguage, findEvidenceSnippet } from './nlpEngine';
import { WB_AFTER, WB_BEFORE, escapeRegExp, pyRound } from './pyCompat';

export interface SkillTag {
  skill_id: string;
  skill_name: string;
  category: string;
  cluster: string;
  confidence: number;
  evidence: string;
}

interface Scored extends SkillTag {
  match_count: number;
}

export function normalizeCategory(category: string): string {
  const c = category.toLowerCase();
  let norm = 'general';
  for (const key of Object.keys(CATEGORY_PRIORS)) {
    if (c.includes(key)) {
      norm = key;
      break;
    }
  }
  if (norm === 'general') {
    if (c.includes('english') || c.includes('debate') || c.includes('pres')) norm = 'english_presentation';
    else if (c.includes('stem') || c.includes('iot') || c.includes('sci')) norm = 'stem_scientific';
    else if (c.includes('social') || c.includes('human') || c.includes('cultur')) norm = 'social_humanities';
  }
  return norm;
}

const ASCII_KW = /^[a-zA-Z0-9\s-]+$/;

export function extractSkills(
  content: string,
  reflection: string | null | undefined,
  category = 'general',
  minSkills = 3,
  maxSkills = 6,
  confidenceThreshold = 0.65
): SkillTag[] {
  const combined = `${content || ''}\n\n${reflection || ''}`.trim();
  const lower = combined.toLowerCase();
  const reflLower = (reflection || '').toLowerCase();
  const normCat = normalizeCategory(category);
  const priorsForCat = CATEGORY_PRIORS[normCat] || [];

  const scored: Scored[] = [];
  for (const [skillId, meta] of Object.entries(SKILL_TAXONOMY)) {
    const all = [...meta.keywords_en, ...meta.keywords_vi];
    const matches = all.filter((kw) =>
      ASCII_KW.test(kw) ? new RegExp(WB_BEFORE + escapeRegExp(kw) + WB_AFTER, 'u').test(lower) : lower.includes(kw)
    );
    const reflHits = all.filter((kw) => reflLower.includes(kw));
    const isPrior = priorsForCat.includes(skillId);
    if (!(matches.length || reflHits.length || isPrior)) continue;

    const base = isPrior ? 0.68 : 0.65;
    const matchBonus = Math.min(matches.length * 0.05, 0.2);
    const reflBonus = Math.min(reflHits.length * 0.06, 0.12);
    const confidence = pyRound(Math.min(base + matchBonus + reflBonus, 0.98), 2);

    const kws = matches.length ? matches : [...meta.keywords_en.slice(0, 2), ...meta.keywords_vi.slice(0, 2)];
    let evidence = findEvidenceSnippet(combined, kws, meta.name);
    if (!evidence || evidence.trim().length < 10) {
      evidence = detectLanguage(combined) === 'en' ? meta.default_evidence_en : meta.default_evidence_vi;
    }
    scored.push({
      skill_id: skillId,
      skill_name: meta.name,
      category: meta.cluster,
      cluster: meta.cluster,
      confidence,
      evidence,
      match_count: matches.length + reflHits.length + (isPrior ? 2 : 0),
    });
  }

  // Python: sorted(key=(confidence, match_count), reverse=True) — ổn định, giữ thứ tự gốc khi bằng nhau
  const sorted = [...scored].sort((a, b) => b.confidence - a.confidence || b.match_count - a.match_count);
  const qualified = sorted.filter((s) => s.confidence >= confidenceThreshold);

  if (qualified.length < minSkills) {
    const prior = CATEGORY_PRIORS[normCat] ?? CATEGORY_PRIORS.general;
    const backup = ['skill_self_directed_learning', 'skill_problem_solving', 'skill_teamwork_collaboration', 'skill_academic_integrity', 'skill_critical_analysis'];
    const fallback = [...prior, ...backup.filter((b) => !prior.includes(b))];
    const existing = new Set(qualified.map((s) => s.skill_id));
    const lang = detectLanguage(combined);
    for (const id of fallback) {
      if (!existing.has(id)) {
        const meta = SKILL_TAXONOMY[id];
        const def = lang === 'en' ? meta.default_evidence_en : meta.default_evidence_vi;
        let evidence = findEvidenceSnippet(combined, [...meta.keywords_en.slice(0, 2), ...meta.keywords_vi.slice(0, 2)], meta.name);
        if (!evidence || evidence.trim().length < 10) evidence = def;
        qualified.push({
          skill_id: id,
          skill_name: meta.name,
          category: meta.cluster,
          cluster: meta.cluster,
          confidence: prior.includes(id) ? 0.78 : 0.72,
          evidence,
          match_count: 1,
        });
        existing.add(id);
      }
      if (qualified.length >= minSkills) break;
    }
  }

  return qualified.slice(0, maxSkills).map(({ match_count: _m, ...tag }) => tag);
}
