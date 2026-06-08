import { Chapter } from '../types';

export const TONE_OPTIONS = [
  { id: 'professional', label: '专业严谨', desc: '适合深度行业报告，用词考究，逻辑严密' },
  { id: 'insightful', label: '犀利洞察', desc: '观点鲜明，直击痛点，适合评论或深度解析' },
  { id: 'popular', label: '通俗易懂', desc: '化繁为简，多用比喻，适合大众科普或初学者' },
  { id: 'humorous', label: '幽默风趣', desc: '金句频出，轻松活泼，适合社交媒体传播' },
];

export const DEFAULT_SERIAL_PLAN = "";

export const INITIAL_ISSUES: Chapter[] = [];

export const getChapterFolderName = (id: string | number) => {
  const idStr = String(id);
  const numPart = idStr.replace('issue-', '');
  return `Issue_${numPart}`;
};