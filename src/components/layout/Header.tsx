import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, History, Lock, Unlock, Save, Eye, 
  Type as TypeIcon, Lightbulb, Sparkles, ChevronRight,
  X
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { cleanTitle } from '../../utils';

interface HeaderProps {
  activeId: number | 'plan';
  activeIssue: any;
  isDirty: boolean;
  showVersionMenu: boolean;
  setShowVersionMenu: (show: boolean) => void;
  versionMenuRef: React.RefObject<HTMLDivElement>;
  restoreVersion: (v: any) => void;
  saveVersion: () => void;
  ctaMode: 'none' | 'generate' | 'exact';
  generateCtaTemplate: string;
  exactCtaTemplate: string;
  setGenerateCtaTemplate: (t: string) => void;
  setExactCtaTemplate: (t: string) => void;
  showRawMd: boolean;
  setShowRawMd: (show: boolean) => void;
  showTip: boolean;
  setShowTip: (show: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (show: boolean) => void;
  setIsVisualSidebarOpen: (show: boolean) => void;
}

export const Header = ({
  activeId, activeIssue, isDirty,
  showVersionMenu, setShowVersionMenu, versionMenuRef,
  restoreVersion, saveVersion,
  ctaMode, generateCtaTemplate, exactCtaTemplate,
  setGenerateCtaTemplate, setExactCtaTemplate,
  showRawMd, setShowRawMd,
  showTip, setShowTip,
  isChatOpen, setIsChatOpen,
  setIsVisualSidebarOpen
}: HeaderProps) => {
  return (
    <header className="h-16 relative z-[100] border-b border-[#141414]/10 bg-white/80 backdrop-blur-md flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[#141414]/60">
          <FileText className="w-4 h-4" />
          <span>{activeId === 'plan' ? activeIssue.title : cleanTitle(activeIssue.title)}</span>
          {activeIssue.versions && activeIssue.versions.length > 0 && (
            <div className="relative" ref={versionMenuRef}>
              <button 
                onClick={() => setShowVersionMenu(!showVersionMenu)}
                className="ml-2 px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] rounded-full font-bold flex items-center gap-1 hover:bg-[#5A5A40]/20 transition-colors"
              >
                V{(() => {
                  const match = activeIssue.versions.slice().reverse().find((v: any) => v.content === activeIssue.content);
                  return match ? match.version : (activeIssue.versions[activeIssue.versions.length - 1].version + ' (已编辑)');
                })()}
                <History className="w-2.5 h-2.5" />
              </button>
              
              <AnimatePresence>
                {showVersionMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-[100] overflow-hidden"
                  >
                    <div className="p-2 border-b border-[#141414]/5 bg-[#F5F5F0]/30">
                      <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">版本历史</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {[...activeIssue.versions].reverse().map((v, idx) => (
                        <button
                          key={idx}
                          onClick={() => restoreVersion(v)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F5F5F0] transition-colors group"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-bold text-[#5A5A40]">V{v.version}</span>
                            <span className="text-[9px] text-[#141414]/30">{new Date(v.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[9px] text-[#141414]/50 line-clamp-1 italic">
                            {v.content.substring(0, 30).replace(/\n/g, ' ')}...
                          </p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 ml-4">
          {activeId === 'plan' && (() => {
            const globalCta = (ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate).trim();
            const match = activeIssue.content.match(/## 3\.?\s*引流模板\s*([\s\S]*?)(?=##|$)/);
            const planCta = match ? match[1].trim() : '';
            const isCtaLocked = globalCta.length > 0 && planCta === globalCta;
            
            return (
              <button
                onClick={() => {
                  if (planCta) {
                    if (ctaMode === 'generate') {
                       setGenerateCtaTemplate(planCta);
                    } else {
                       setExactCtaTemplate(planCta);
                    }
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 bg-white border rounded-full text-[10px] font-bold transition-all shadow-sm ${isCtaLocked ? 'border-emerald-200 text-emerald-600' : 'border-[#141414]/10 text-[#141414]/60 hover:bg-[#F5F5F0]'}`}
                title={isCtaLocked ? "引流参数目前已完全同步" : "提取当前大纲中的引流模板并锁定为全局参数"}
              >
                {isCtaLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {isCtaLocked ? '引流已锁定' : '提取引流模板'}
              </button>
            );
          })()}
          <motion.button 
            onClick={saveVersion}
            animate={isDirty ? { 
              scale: [1, 1.05, 1],
              backgroundColor: ['#5A5A40', '#8B8B60', '#5A5A40'],
              boxShadow: [
                '0 0 0px rgba(90, 90, 64, 0)',
                '0 0 15px rgba(90, 90, 64, 0.5)',
                '0 0 0px rgba(90, 90, 64, 0)'
              ]
            } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#5A5A40] text-white rounded-full text-[10px] font-bold hover:bg-[#5A5A40]/90 transition-all shadow-sm relative overflow-hidden"
          >
            {isDirty && (
              <motion.span 
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute inset-0 bg-white/20 skew-x-12"
              />
            )}
            <Save className="w-3 h-3" />
            保存版本
          </motion.button>
          {isDirty && (
            <div className="flex items-center gap-2">
              <Save className="w-3.5 h-3.5 text-[#5A5A40] animate-pulse" />
              <span className="text-[10px] text-[#5A5A40] font-medium">自动保存中</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center bg-[#F5F5F0] p-1 rounded-full border border-[#141414]/5">
        <div className="flex bg-[#E4E3E0] p-0.5 rounded-full mr-2">
          <button
            onClick={() => setShowRawMd(false)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
              !showRawMd ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
            }`}
          >
            <Eye className="w-3 h-3" />
            预览
          </button>
          <button
            onClick={() => setShowRawMd(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
              showRawMd ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
            }`}
          >
            <TypeIcon className="w-3 h-3" />
            源码
          </button>
        </div>
        <button
          onClick={() => setShowTip(!showTip)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            showTip ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#141414]/50 hover:text-[#141414]'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          技巧
        </button>
        <div className="w-px h-4 bg-[#141414]/10 mx-1" />
        <Tooltip text={isChatOpen ? "关闭 AI 助手" : "打开 AI 助手"}>
          <button
            onClick={() => {
              if (!isChatOpen) setIsVisualSidebarOpen(false);
              setIsChatOpen(!isChatOpen);
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
              isChatOpen ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#141414]/50 hover:bg-[#141414]/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
