import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Paperclip, Loader2, CheckCircle2, AlertCircle, Settings2, 
  Fingerprint, Share2, Compass, LayoutDashboard, Plus, 
  Sparkles, Download, FolderArchive, Wand2, RotateCcw, Send,
  FileText, FolderOpen
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { cleanTitle } from '../../utils';
import { Chapter } from '../../types';

interface SidebarProps {
  sidebarWidth: number;
  isPdfLoading: boolean;
  isGeneratingPlan: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  uploadError: string | null;
  isPlanGenerated: boolean;
  projectPath: string;
  setShowSystemModal: (show: boolean) => void;
  setShowBrandModal: (show: boolean) => void;
  setShowPublisherModal: (show: boolean) => void;
  setShowStrategyModal: (show: boolean) => void;
  serialPlan: string;
  activeId: number | 'plan';
  setActiveId: (id: number | 'plan') => void;
  issues: Chapter[];
  planApproved: boolean;
  approvePlan: () => void;
  isPlanLoading: boolean;
  isGeneratingSingle: boolean;
  isGeneratingAll: boolean;
  showIssueSelector: boolean;
  setShowIssueSelector: (show: boolean) => void;
  issueSelectorRef: React.RefObject<HTMLDivElement>;
  generateIssue: (id: number) => void;
  showConfirmAll: boolean;
  setShowConfirmAll: (show: boolean) => void;
  confirmAllRef: React.RefObject<HTMLDivElement>;
  generateAll: () => void;
  publishMenuRef: React.RefObject<HTMLDivElement>;
  showPublishMenu: boolean;
  setShowPublishMenu: (show: boolean) => void;
  publishToDrafts: (type: 'current' | 'all') => void;
  downloadMenuRef: React.RefObject<HTMLDivElement>;
  showDownloadMenu: boolean;
  setShowDownloadMenu: (show: boolean) => void;
  downloadMarkdown: (type: 'current' | 'all', silent?: boolean) => void;
  handleLoadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
  startResizingSidebar: (e: React.MouseEvent) => void;
  setIsChatOpen: (show: boolean) => void;
  setIsVisualSidebarOpen: (show: boolean) => void;
  isExtractingVisuals: boolean;
  activeIssue: any;
  getWordCount: (text: string) => number;
}

export const Sidebar = ({
  sidebarWidth, isPdfLoading, isGeneratingPlan, handleFileUpload,
  fileName, uploadError, isPlanGenerated, projectPath,
  setShowSystemModal, setShowBrandModal, setShowPublisherModal, setShowStrategyModal,
  serialPlan, activeId, setActiveId, issues,
  planApproved, approvePlan, isPlanLoading,
  isGeneratingSingle, isGeneratingAll,
  showIssueSelector, setShowIssueSelector, issueSelectorRef, generateIssue,
  showConfirmAll, setShowConfirmAll, confirmAllRef, generateAll,
  publishMenuRef, showPublishMenu, setShowPublishMenu, publishToDrafts,
  downloadMenuRef, showDownloadMenu, setShowDownloadMenu, downloadMarkdown,
  handleLoadProject, startResizingSidebar,
  setIsChatOpen, setIsVisualSidebarOpen, isExtractingVisuals,
  activeIssue, getWordCount
}: SidebarProps) => {
  const normPath = projectPath ? projectPath.replace(/\\/g, '/') : '';
  // Last folder name = project name
  const projectFolderName = normPath ? normPath.split('/').filter(Boolean).pop() || '' : '';
  // Short path = last 2 segments
  const shortPath = normPath ? normPath.split('/').slice(-2).join('/') : '';
  // Effective report label: saved fileName OR project folder name
  const reportLabel = fileName || projectFolderName;

  return (
    <aside 
      style={{ width: sidebarWidth }}
      className="bg-[#F5F5F0] border-r border-[#141414]/10 flex flex-col relative shrink-0"
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 shadow-sm rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-[#141414]/10 bg-white">
            <img src="/favicon_v2.png" alt="PostOS Pro Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-base font-serif italic font-bold leading-tight">PostOS Pro</h1>
            <p className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Editorial OS</p>
          </div>
        </div>

        <div className="mb-4 space-y-2">
          <Tooltip text="上传 PDF/Word 报告" className="w-full relative group">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isPdfLoading || isGeneratingPlan}
            />
            <div 
              className={`flex items-center justify-center gap-2 w-full h-11 rounded-xl transition-all shadow-sm border ${
                isPdfLoading || isGeneratingPlan 
                  ? 'bg-white/50 text-[#141414]/20 border-[#141414]/5' 
                  : 'bg-[#141414] text-white border-transparent hover:bg-[#141414]/90 hover:shadow-lg active:scale-[0.98]'
              }`}
            >
              {isPdfLoading || isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              <span className="text-xs font-bold tracking-tight">导入分析报告</span>
            </div>
          </Tooltip>

          {/* Report status panel — show whenever loading, or have report/project info */}
          {(isPdfLoading || isGeneratingPlan || reportLabel || uploadError) && (
            <div className="px-3 py-2.5 bg-white rounded-xl border border-[#141414]/8 shadow-sm space-y-1.5">
              {/* Phase: PDF parsing */}
              {isPdfLoading && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-[#5A5A40] shrink-0" />
                  <span className="text-[9px] font-bold text-[#5A5A40] truncate">正在解析 PDF...</span>
                </div>
              )}
              {/* Phase: AI plan generation */}
              {!isPdfLoading && isGeneratingPlan && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                  <span className="text-[9px] font-bold text-amber-600 truncate">AI 正在分析报告，生成规划...</span>
                </div>
              )}
              {/* Report / project label row */}
              {reportLabel && !isPdfLoading && !isGeneratingPlan && (
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[#5A5A40] text-[9px] flex items-center gap-1 font-bold truncate">
                    <FileText className="w-2.5 h-2.5 shrink-0" />
                    {reportLabel}
                  </p>
                  {isPlanGenerated && (
                    <span className="text-emerald-600 text-[8px] font-bold uppercase tracking-tighter shrink-0 border border-emerald-100 px-1 rounded bg-emerald-50">规划就绪</span>
                  )}
                </div>
              )}
              {/* Project path row */}
              {shortPath && !isPdfLoading && !isGeneratingPlan && (
                <div className="flex items-center gap-1">
                  <FolderOpen className="w-2.5 h-2.5 shrink-0 text-[#141414]/30" />
                  <p className="text-[#141414]/40 text-[8px] truncate font-medium" title={projectPath}>
                    {shortPath}
                  </p>
                  <span className="text-[7px] font-bold uppercase tracking-tight text-blue-500 border border-blue-100 px-1 rounded bg-blue-50 shrink-0">已加载</span>
                </div>
              )}
              {/* Error row */}
              {uploadError && (
                <p className="text-red-500 text-[9px] flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {uploadError}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 pt-3">
            <Tooltip text="系统设置 (AI 模型)">
              <button onClick={() => setShowSystemModal(true)} className="flex items-center justify-center aspect-square h-10 rounded-xl transition-all bg-white border border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50 hover:border-[#141414]/20 shadow-sm"><Settings2 className="w-4 h-4" /></button>
            </Tooltip>
            <Tooltip text="品牌与引流策略">
              <button onClick={() => setShowBrandModal(true)} className="flex items-center justify-center aspect-square h-10 rounded-xl transition-all bg-white border border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50 hover:border-[#141414]/20 shadow-sm"><Fingerprint className="w-4 h-4" /></button>
            </Tooltip>
            <Tooltip text="微信发布设置">
              <button onClick={() => setShowPublisherModal(true)} className="flex items-center justify-center aspect-square h-10 rounded-xl transition-all bg-white border border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50 hover:border-[#141414]/20 shadow-sm"><Share2 className="w-4 h-4" /></button>
            </Tooltip>
            <Tooltip text="连载生成策略">
              <button onClick={() => setShowStrategyModal(true)} className="flex items-center justify-center aspect-square h-10 rounded-xl transition-all bg-white border border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50 hover:border-[#141414]/20 shadow-sm"><Compass className="w-4 h-4" /></button>
            </Tooltip>
          </div>
        </div>
      </div>

      {serialPlan && (
        <div className="px-4 pb-2 border-b border-[#141414]/5 mb-2 shrink-0">
          <button
            onClick={() => setActiveId('plan')}
            className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeId === 'plan' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#141414]/60 hover:bg-[#141414]/5'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-sm font-bold truncate flex-1 text-left">连载规划</span>
          </button>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto min-h-0">
        <div className="pt-2 pb-2 px-4">
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">连载篇目</p>
        </div>
        {issues.map((issue) => (
          <button
            key={issue.id}
            onClick={() => setActiveId(issue.id)}
            className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeId === issue.id ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#141414]/60 hover:bg-[#141414]/5'}`}
          >
            <span className={`text-[11px] font-bold ${activeId === issue.id ? 'text-white' : 'text-[#141414]/60'}`}>连载{issue.id}</span>
            <div className="flex-1 flex flex-col items-start min-w-0">
              <span className="text-sm font-bold truncate w-full text-left">{cleanTitle(issue.title)}</span>
              <span className={`text-[9px] mt-0.5 ${activeId === issue.id ? 'text-white/60' : 'text-[#141414]/30'}`}>{getWordCount(issue.content)} 字</span>
            </div>
            {(issue.versions || []).length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            {(issue.versions || []).length === 0 && issue.content && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[#141414]/10 space-y-2 relative">
        {activeId === 'plan' && !planApproved && serialPlan.trim() !== '' && (
          <button onClick={approvePlan} disabled={isPlanLoading} className="w-full flex items-center justify-center gap-2 py-3 bg-[#5A5A40] text-white rounded-full text-sm font-medium hover:bg-[#5A5A40]/90 transition-colors disabled:opacity-50">
            {isPlanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            批准并生成大纲
          </button>
        )}
        
        {planApproved && (
          <div className={`grid gap-1 relative ${activeId === 'plan' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {activeId === 'plan' ? (
              <>
                <div className="relative" ref={issueSelectorRef}>
                  <button onClick={() => setShowIssueSelector(!showIssueSelector)} disabled={isGeneratingSingle || isGeneratingAll} className="w-full flex items-center justify-center gap-1 py-3 bg-[#141414] text-white rounded-xl text-[10px] font-bold hover:bg-[#141414]/90 transition-colors disabled:opacity-50">
                    {isGeneratingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    生成一期
                  </button>
                  <AnimatePresence>
                    {showIssueSelector && (
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-[#141414]/10 rounded-2xl shadow-xl overflow-hidden z-[60]">
                        <div className="p-2 max-h-60 overflow-y-auto">
                          {issues.map((issue) => (
                            <button key={issue.id} onClick={() => generateIssue(issue.id)} className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#F5F5F0] flex items-center justify-between group">
                              <span className="truncate mr-2">连载{issue.id} - {cleanTitle(issue.title)}</span>
                              {issue.status !== 'pending' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative" ref={confirmAllRef}>
                  <button onClick={() => setShowConfirmAll(!showConfirmAll)} disabled={isGeneratingSingle || isGeneratingAll} className="w-full flex items-center justify-center gap-1 py-3 border border-[#141414] text-[#141414] rounded-xl text-[10px] font-bold hover:bg-gray-50 disabled:opacity-50">
                    {isGeneratingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    全部生成
                  </button>
                  <AnimatePresence>
                    {showConfirmAll && (
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-[#141414]/10 rounded-2xl shadow-xl p-4 z-[60]">
                        <div className="text-center">
                          <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                          <p className="text-[10px] text-[#141414]/60 leading-relaxed mb-3">确认全部生成？耗时约 2-3 分钟，系统将自动保存旧版本。</p>
                          <div className="flex gap-2">
                            <button onClick={generateAll} className="flex-1 py-1.5 bg-[#141414] text-white rounded-full text-[10px] font-bold">确认</button>
                            <button onClick={() => setShowConfirmAll(false)} className="flex-1 py-1.5 border border-[#141414]/10 text-[#141414]/60 rounded-full text-[10px] font-bold">取消</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex gap-2 mb-4">
                <button onClick={() => generateIssue(activeIssue.id)} disabled={isGeneratingSingle || isGeneratingAll} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-colors disabled:opacity-50 ${activeIssue.content ? 'border border-[#141414] text-[#141414] hover:bg-gray-50' : 'bg-[#141414] text-white hover:bg-[#141414]/90'}`}>
                  {isGeneratingSingle ? <Loader2 className="w-3 h-3 animate-spin" /> : activeIssue.content ? <RotateCcw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                  {activeIssue.content ? '重新生成' : '生成本篇'}
                </button>
                <button onClick={() => { setIsChatOpen(false); setIsVisualSidebarOpen(true); }} disabled={isExtractingVisuals || !activeIssue.content} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold hover:bg-emerald-50 disabled:opacity-40 shadow-sm">
                  <Wand2 className="w-3 h-3" />
                  本篇配图
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="relative" ref={publishMenuRef}>
            <button onClick={() => setShowPublishMenu(!showPublishMenu)} className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] border border-[#141414]/5">
              <Send className="w-3.5 h-3.5" />
              <span>发布</span>
            </button>
            <AnimatePresence>
              {showPublishMenu && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 mb-2 w-32 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-[60] overflow-hidden">
                  <button onClick={() => publishToDrafts('current')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0] border-b border-[#141414]/5">发布本篇</button>
                  <button onClick={() => publishToDrafts('all')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0]">发布全部</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative" ref={downloadMenuRef}>
            <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] border border-[#141414]/5">
              <Download className="w-3.5 h-3.5" />
              <span>保存</span>
            </button>
            <AnimatePresence>
              {showDownloadMenu && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full right-0 mb-2 w-32 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-[60] overflow-hidden">
                  <button onClick={() => downloadMarkdown('current')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0] border-b border-[#141414]/5">保存本篇</button>
                  <button onClick={() => downloadMarkdown('all')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0]">保存全部</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative">
            <input type="file" accept=".zip" onChange={handleLoadProject} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-[60]" />
            <div className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold border border-[#141414]/5">
              <FolderArchive className="w-3.5 h-3.5" />
              <span>加载</span>
            </div>
          </div>
        </div>
      </div>
      <div onMouseDown={startResizingSidebar} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#5A5A40]/30 transition-colors z-50" />
    </aside>
  );
};
