import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ImageIcon, ChevronRight, Plus, X, RefreshCw, 
  Sparkles, Loader2, History, ChevronUp, ChevronDown, 
  CheckCircle2, Layers, Zap, LineChart, AlertCircle, Save
} from 'lucide-react';
import { VisualAsset } from '../../types';

interface VisualSidebarProps {
  chatPanelWidth: number;
  isVisualSidebarOpen: boolean;
  setIsVisualSidebarOpen: (show: boolean) => void;
  startResizingChat: (e: React.MouseEvent) => void;
  selectedStyleId: string;
  handleSelectStyle: (id: string) => void;
  STYLE_PRESETS: any[];
  showCustomArchitect: boolean;
  setShowCustomArchitect: (show: boolean) => void;
  customStyleName: string;
  setCustomStyleName: (name: string) => void;
  architectParams: any;
  setArchitectParams: React.Dispatch<React.SetStateAction<any>>;
  customStyleDNA: string;
  setCustomStyleDNA: (dna: string) => void;
  handleSaveCustomStyle: (update: boolean) => void;
  setCustomStyles: React.Dispatch<React.SetStateAction<any[]>>;
  isExtractingVisuals: boolean;
  extractionMode: string | null;
  handleExtractVisuals: (mode: 'cover' | 'infographic' | 'all', extraRequirement?: string, targetCount?: number) => void;
  pendingVisuals: VisualAsset[];
  setPendingVisuals: React.Dispatch<React.SetStateAction<VisualAsset[]>>;
  activeId: number | 'plan';
  activeIssue: any;
  generatingVisualIds: string[];
  generationAbortControllers: React.RefObject<Record<string, AbortController>>;
  handleGenerateVisual: (v: VisualAsset) => void;
  openHistoryId: string | null;
  setOpenHistoryId: (id: string | null) => void;
  resolveAssetUrl: (path: string, key?: number) => string;
  assetRefreshKey: number;
  handleRestoreHistory: (v: VisualAsset, entry: any) => void;
  compareItems: any[];
  setCompareItems: React.Dispatch<React.SetStateAction<any[]>>;
  setShowComparisonModal: (show: boolean) => void;
  isBatchGenerating: boolean;
  handleGenerateAllInfographics: () => void;
  
  // Passed hooks states
  collapsedTypes: string[];
  setCollapsedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  coverExtraPrompt: string;
  setCoverExtraPrompt: (prompt: string) => void;
  infographicExtraPrompt: string;
  setInfographicExtraPrompt: (prompt: string) => void;
  infographicTargetCount: number;
  setInfographicTargetCount: React.Dispatch<React.SetStateAction<number>>;
  extractionAbortControllerRef: React.RefObject<AbortController | null>;
  extractedVisualsError?: string | null;
  setExtractedVisualsError?: (err: string | null) => void;
}

export const VisualSidebar = ({
  chatPanelWidth, isVisualSidebarOpen, setIsVisualSidebarOpen, startResizingChat,
  selectedStyleId, handleSelectStyle, STYLE_PRESETS,
  showCustomArchitect, setShowCustomArchitect, customStyleName, setCustomStyleName,
  architectParams, setArchitectParams, customStyleDNA, setCustomStyleDNA,
  handleSaveCustomStyle, setCustomStyles,
  isExtractingVisuals, extractionMode, handleExtractVisuals,
  pendingVisuals, setPendingVisuals, activeId, activeIssue,
  generatingVisualIds, generationAbortControllers, handleGenerateVisual,
  openHistoryId, setOpenHistoryId, resolveAssetUrl, assetRefreshKey,
  handleRestoreHistory, compareItems, setCompareItems, setShowComparisonModal,
  isBatchGenerating, handleGenerateAllInfographics,
  collapsedTypes, setCollapsedTypes,
  coverExtraPrompt, setCoverExtraPrompt,
  infographicExtraPrompt, setInfographicExtraPrompt,
  infographicTargetCount, setInfographicTargetCount,
  extractionAbortControllerRef,
  extractedVisualsError, setExtractedVisualsError
}: VisualSidebarProps) => {
  return (
    <AnimatePresence>
      {isVisualSidebarOpen && (
        <motion.aside
          key="visual-assets-sidebar"
          initial={{ x: chatPanelWidth }}
          animate={{ x: 0 }}
          exit={{ x: chatPanelWidth }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          style={{ width: chatPanelWidth }}
          className="border-l border-[#141414]/10 bg-white flex flex-col shadow-2xl relative shrink-0"
        >
          <div onMouseDown={startResizingChat} className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-[#5A5A40]/30 transition-colors z-50" />
          <div className="p-4 border-b border-[#141414]/10 flex items-center justify-between bg-[#F5F5F0]/30 text-[#141414]">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]">配图策划</span>
            </div>
            <button onClick={() => setIsVisualSidebarOpen(false)} className="p-1 hover:bg-[#141414]/5 rounded-full"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Style Selector Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">风格预设</label>
                <button onClick={() => setShowCustomArchitect(!showCustomArchitect)} className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  {showCustomArchitect ? '取消' : '定制'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {STYLE_PRESETS.map((style) => (
                  <div key={style.id} className="relative group">
                    <button onClick={() => handleSelectStyle(style.id)} className={`w-full flex flex-col items-center p-2 rounded-xl border transition-all ${selectedStyleId === style.id ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-[#141414]/5 bg-white'}`}>
                      <div className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: style.color }} />
                      <span className="text-[9px] font-bold truncate w-full text-center">{style.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Style DNA Architect Panel */}
            <AnimatePresence>
              {showCustomArchitect && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-4"
                >
                  <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-30 ml-1">风格名称</label>
                        <input 
                          type="text"
                          value={customStyleName}
                          onChange={(e) => setCustomStyleName(e.target.value)}
                          className="w-full bg-white border border-emerald-200/20 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                          placeholder="例如：极客黑金"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase opacity-30 ml-1">配色方案</label>
                          <select 
                            value={architectParams.palette}
                            onChange={(e) => setArchitectParams((p: any) => ({ ...p, palette: e.target.value }))}
                            className="w-full bg-white border border-emerald-200/20 rounded-lg px-2 py-1.5 text-[10px] outline-none"
                          >
                            <option>现代商务 (Modern Corporate)</option>
                            <option>高对比赛博 (High-contrast Cyber)</option>
                            <option>自然有机 (Natural Organic)</option>
                            <option>黑白技术 (Monochrome Technical)</option>
                            <option>活力创意 (Vibrant Creative)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase opacity-30 ml-1">背景材质</label>
                          <select 
                            value={architectParams.background}
                            onChange={(e) => setArchitectParams((p: any) => ({ ...p, background: e.target.value }))}
                            className="w-full bg-white border border-emerald-200/20 rounded-lg px-2 py-1.5 text-[10px] outline-none"
                          >
                            <option>技术网格 (Technical Grid)</option>
                            <option>平滑玻璃 (Smooth Glass)</option>
                            <option>再生纸张 (Recycled Paper)</option>
                            <option>碳纤维 (Carbon Fiber)</option>
                            <option>点阵矩阵 (Dot Matrix)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase opacity-30 ml-1">材质风格</label>
                          <select 
                            value={architectParams.material}
                            onChange={(e) => setArchitectParams((p: any) => ({ ...p, material: e.target.value }))}
                            className="w-full bg-white border border-emerald-200/20 rounded-lg px-2 py-1.5 text-[10px] outline-none"
                          >
                            <option>玻璃与铬合金 (Glass & Chrome)</option>
                            <option>磨砂金属 (Brushed Metal)</option>
                            <option>极简黑线 (Minimalist Ink)</option>
                            <option>发光网格 (Glowing Mesh)</option>
                            <option>全息流体 (Holographic Fluid)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase opacity-30 ml-1">构图视角</label>
                          <select 
                            value={architectParams.composition}
                            onChange={(e) => setArchitectParams((p: any) => ({ ...p, composition: e.target.value }))}
                            className="w-full bg-white border border-emerald-200/20 rounded-lg px-2 py-1.5 text-[10px] outline-none"
                          >
                            <option>等轴测 (Isometric)</option>
                            <option>平面透视 (Flat Perspective)</option>
                            <option>3D 架构图 (3D Schematic)</option>
                            <option>正上俯视图 (Top-down View)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-30 ml-1">结构化 DNA (Baoyu Skill Style)</label>
                        <textarea 
                          value={customStyleDNA}
                          onChange={(e) => setCustomStyleDNA(e.target.value)}
                          className="w-full h-32 bg-white border border-emerald-200/20 rounded-xl p-3 text-[10px] leading-relaxed focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none transition-all font-mono"
                          placeholder="# Role: DNA Architect..."
                        />
                      </div>

                      <div className="pt-2 flex gap-2">
                        {selectedStyleId.startsWith('custom-') ? (
                          <>
                            <button 
                              onClick={() => handleSaveCustomStyle(true)}
                              className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                            >
                              <Save className="w-3 h-3" />
                              更新当前风格
                            </button>
                            <button 
                              onClick={() => handleSaveCustomStyle(false)}
                              className="px-4 py-2 border border-emerald-200 text-emerald-600 bg-white rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all"
                            >
                              另存为新风格
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleSaveCustomStyle(false)}
                            className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2"
                          >
                            <Save className="w-3 h-3" />
                            保存为新风格 (不影响预设)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-px bg-[#141414]/5" />

            {/* Error Message Panel */}
            {extractedVisualsError && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setExtractedVisualsError && setExtractedVisualsError(null)}
                    className="text-[9px] font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    清空错误
                  </button>
                </div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-red-700">策划出错</p>
                      <p className="text-[10px] text-red-600/70 mt-1 leading-relaxed">{extractedVisualsError}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cover Section */}
            <div className="space-y-2">
              <button 
                onClick={() => {
                  if (pendingVisuals.some(v => v.type === 'cover' && v.chapterId === activeIssue?.id)) {
                    setCollapsedTypes(prev => prev.includes('cover') ? prev.filter(t => t !== 'cover') : [...prev, 'cover']);
                  } else {
                    handleExtractVisuals('cover');
                  }
                }}
                className={`w-full group flex items-center justify-between bg-white border border-[#141414]/5 rounded-2xl p-4 text-left transition-all ${
                  pendingVisuals.some(v => v.type === 'cover' && v.chapterId === activeIssue?.id) ? 'border-amber-400/30' : 'hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    pendingVisuals.some(v => v.type === 'cover' && v.chapterId === activeIssue?.id) ? 'bg-amber-100 text-amber-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {(isExtractingVisuals && (extractionMode === 'cover' || extractionMode === 'all')) ? (
                      <div className="relative group/cancel">
                        <Loader2 className="w-5 h-5 animate-spin p-0.5" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (extractionAbortControllerRef.current) extractionAbortControllerRef.current.abort();
                          }}
                          className="absolute -top-1 -right-1 bg-white shadow-sm border border-red-200 rounded-full p-0.5 text-red-500 opacity-0 group-hover/cancel:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : <ImageIcon className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#141414]">头图策划</p>
                    <p className="text-[10px] opacity-40 mt-0.5">策划文章核心隐喻与封面意境</p>
                  </div>
                </div>
                {pendingVisuals.some(v => v.type === 'cover' && v.chapterId === activeIssue?.id) && (
                  <div className="p-1 hover:bg-[#141414]/5 rounded-lg transition-colors">
                    {collapsedTypes.includes('cover') ? <ChevronRight className="w-4 h-4 opacity-30" /> : <ChevronDown className="w-4 h-4 opacity-30" />}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {!collapsedTypes.includes('cover') && (
                  <>
                    {/* Cover Regeneration Dashboard */}
                    {pendingVisuals.filter(v => v.type === 'cover' && v.chapterId === activeIssue?.id).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-amber-50/20 border border-amber-200/20 rounded-2xl space-y-3 mb-4"
                      >
                        <div className="flex flex-col gap-2">
                          <textarea 
                            value={coverExtraPrompt}
                            onChange={(e) => setCoverExtraPrompt(e.target.value)}
                            placeholder="头图策划调优提示（选填，如：加强工业琥珀的质感，突出OpenClaw标志...）"
                            className="w-full h-16 bg-white border border-amber-200/20 rounded-lg p-2 text-[10px] focus:ring-1 focus:ring-amber-500/20 outline-none resize-none transition-all placeholder:opacity-30"
                          />
                          <button 
                            onClick={() => handleExtractVisuals('cover', coverExtraPrompt)}
                            disabled={isExtractingVisuals}
                            className="w-full py-2 bg-amber-600 text-white rounded-xl text-[10px] font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                          >
                            {isExtractingVisuals ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            重新生成头图策划
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {pendingVisuals.filter(v => v.type === 'cover' && v.chapterId === activeIssue?.id).map((visual, idx) => (
                      <motion.div 
                        key={visual.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-amber-50/10 border border-amber-200/30 rounded-2xl space-y-4 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-700/60 uppercase">头图方案 {idx + 1}</span>
                            <button className="text-[10px] text-red-500/40 font-bold hover:text-red-500 transition-colors" onClick={() => setPendingVisuals(prev => prev.filter(v => v.id !== visual.id))}>删除方案</button>
                          </div>
                          
                          <div className="space-y-3">
                            <textarea 
                              value={visual.description}
                              onChange={(e) => setPendingVisuals(prev => prev.map(v => v.id === visual.id ? { ...v, description: e.target.value } : v))}
                              className="w-full h-24 bg-white border border-amber-200/20 rounded-xl p-3 text-[11px] leading-relaxed focus:ring-1 focus:ring-amber-500/20 outline-none resize-none transition-all"
                              placeholder="头图概念描述..."
                            />
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-30 ml-1">配图文字标签</label>
                              <input 
                                type="text"
                                value={visual.labels}
                                onChange={(e) => setPendingVisuals(prev => prev.map(v => v.id === visual.id ? { ...v, labels: e.target.value } : v))}
                                className="w-full bg-white border border-amber-200/20 rounded-lg px-3 py-2 text-[10px] focus:ring-1 focus:ring-amber-500/20 outline-none transition-all"
                                placeholder="主标题、副标题等..."
                              />
                            </div>
                          </div>

                          {generatingVisualIds.includes(visual.id) ? (
                            <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 select-none relative overflow-hidden">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-500/40" />
                              <span>正在生成...</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (generationAbortControllers.current[visual.id]) {
                                    generationAbortControllers.current[visual.id].abort();
                                  }
                                }}
                                className="absolute right-3 p-1.5 hover:bg-[#141414]/10 rounded-lg text-red-500 transition-all flex items-center gap-1.5 z-50 cursor-pointer pointer-events-auto"
                                title="停止生成"
                              >
                                <X className="w-3 h-3" />
                                <span className="text-[10px]">停止</span>
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleGenerateVisual(visual)}
                              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                visual.generated 
                                  ? 'bg-white border border-amber-500 text-amber-600 hover:bg-amber-50'
                                  : 'bg-amber-500 text-white hover:bg-amber-600'
                              }`}
                            >
                              {visual.generated ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                              {visual.generated ? `重新生成头图 ${idx + 1}` : `生成头图 ${idx + 1}`}
                            </button>
                          )}

                          {/* History Gallery for Cover */}
                          {visual.history && visual.history.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-amber-200/20">
                              <button 
                                onClick={() => setOpenHistoryId(openHistoryId === visual.id ? null : visual.id)}
                                className="flex items-center gap-1.5 text-[9px] font-bold text-amber-700/40 hover:text-amber-700 transition-colors uppercase tracking-wider"
                              >
                                <History className="w-2.5 h-2.5" />
                                历史版本 ({visual.history.length})
                                {openHistoryId === visual.id ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                              </button>
                              
                              <AnimatePresence>
                                {openHistoryId === visual.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden mt-3"
                                  >
                                    <div className="grid grid-cols-2 gap-2">
                                      {visual.history.map((entry, eIdx) => (
                                        <div 
                                          key={eIdx} 
                                          className={`group relative aspect-video bg-white border ${(entry.isCurrent || (visual.activeTimestampPath === entry.path)) ? 'border-amber-500 shadow-sm ring-1 ring-amber-500/20' : 'border-amber-200/30'} rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer`}
                                          onClick={() => handleRestoreHistory(visual, entry)}
                                          title="点击还原此版本"
                                        >
                                          <img src={resolveAssetUrl(entry.path, assetRefreshKey)} alt={`V${visual.history.length - eIdx}`} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                            <RefreshCw className="w-3 h-3 text-white" />
                                            <span className="text-[8px] text-white font-bold">还原 V{visual.history.length - eIdx}</span>
                                          </div>
                                          <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 rounded text-[7px] text-white font-bold">
                                            {(entry.isCurrent || (visual.activeTimestampPath === entry.path)) ? '当前版本' : `V${visual.history.length - eIdx}`}
                                          </div>
                                          {(entry.isCurrent || (visual.activeTimestampPath === entry.path)) && (
                                            <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-lg ring-1 ring-white/50 z-10">
                                              <CheckCircle2 className="w-2.5 h-2.5" />
                                            </div>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const isSelected = compareItems.some(i => i.path === entry.path);
                                              if (isSelected) {
                                                setCompareItems(prev => prev.filter(i => i.path !== entry.path));
                                              } else {
                                                if (compareItems.length >= 2) {
                                                  setCompareItems([compareItems[1], entry]);
                                                } else {
                                                  setCompareItems(prev => [...prev, entry]);
                                                }
                                              }
                                              if (compareItems.length === 1 && !isSelected) setShowComparisonModal(true);
                                            }}
                                            className={`absolute bottom-1 right-1 p-1 rounded-md transition-all ${compareItems.some(i => i.path === entry.path) ? 'bg-amber-500 text-white' : 'bg-white/80 text-amber-900 opacity-0 group-hover:opacity-100'}`}
                                            title="加入对比"
                                          >
                                            <Layers className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Infographic Section */}
            <div className="space-y-2">
              <button 
                onClick={() => {
                  if (pendingVisuals.some(v => v.type === 'infographic' && v.chapterId === activeIssue?.id)) {
                    setCollapsedTypes(prev => prev.includes('infographic') ? prev.filter(t => t !== 'infographic') : [...prev, 'infographic']);
                  } else {
                    handleExtractVisuals('infographic');
                  }
                }}
                className={`w-full group flex items-center justify-between bg-white border border-[#141414]/5 rounded-2xl p-4 text-left transition-all ${
                  pendingVisuals.some(v => v.type === 'infographic' && v.chapterId === activeIssue?.id) ? 'border-blue-400/30' : 'hover:border-blue-400 hover:shadow-lg hover:shadow-blue-900/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    pendingVisuals.some(v => v.type === 'infographic' && v.chapterId === activeIssue?.id) ? 'bg-amber-100 text-amber-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {(isExtractingVisuals && (extractionMode === 'infographic' || extractionMode === 'all')) ? (
                      <div className="relative group/cancel">
                        <Loader2 className="w-5 h-5 animate-spin p-0.5" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (extractionAbortControllerRef.current) extractionAbortControllerRef.current.abort();
                          }}
                          className="absolute -top-1 -right-1 bg-white shadow-sm border border-red-200 rounded-full p-0.5 text-red-500 opacity-0 group-hover/cancel:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : <LineChart className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#141414]">信息图策划</p>
                    <p className="text-[10px] opacity-40 mt-0.5">将复杂逻辑与架构转化为专家图表</p>
                  </div>
                </div>
                {pendingVisuals.some(v => v.type === 'infographic' && v.chapterId === activeIssue?.id) && (
                  <div className="p-1 hover:bg-[#141414]/5 rounded-lg transition-colors">
                    {collapsedTypes.includes('infographic') ? <ChevronRight className="w-4 h-4 opacity-30" /> : <ChevronDown className="w-4 h-4 opacity-30" />}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {!collapsedTypes.includes('infographic') && (
                  <>
                    {/* Infographic Regeneration Dashboard */}
                    {pendingVisuals.filter(v => v.type === 'infographic' && v.chapterId === activeIssue?.id).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 bg-[#141414]/5 border border-[#141414]/10 rounded-2xl space-y-3 mb-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <textarea 
                            value={infographicExtraPrompt}
                            onChange={(e) => setInfographicExtraPrompt(e.target.value)}
                            placeholder="调优提示（选填，如：风格更极简...）"
                            className="flex-1 h-10 bg-white border border-[#141414]/10 rounded-lg p-2 text-[10px] focus:ring-1 focus:ring-blue-500/20 outline-none resize-none transition-all placeholder:opacity-30"
                          />
                          <div className="flex items-center bg-white px-2 py-1 rounded-lg border border-[#141414]/10 h-10 shrink-0">
                            <label className="text-[8px] font-bold text-gray-400 mr-2">数量</label>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => setInfographicTargetCount(Math.max(1, infographicTargetCount - 1))}
                                className="w-4 h-4 flex items-center justify-center text-[10px] hover:bg-gray-100 rounded"
                              >-</button>
                              <span className="text-[10px] font-bold min-w-[12px] text-center">{infographicTargetCount}</span>
                              <button 
                                onClick={() => setInfographicTargetCount(Math.min(5, infographicTargetCount + 1))}
                                className="w-4 h-4 flex items-center justify-center text-[10px] hover:bg-gray-100 rounded"
                              >+</button>
                            </div>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleExtractVisuals('infographic', infographicExtraPrompt, infographicTargetCount)}
                          disabled={isExtractingVisuals}
                          className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                          {isExtractingVisuals ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          重新提取全篇信息图
                        </button>
                      </motion.div>
                    )}

                    {pendingVisuals.filter(v => v.type === 'infographic' && v.chapterId === activeIssue?.id).map((visual, idx) => (
                      <motion.div 
                        key={visual.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-amber-50/10 border border-amber-200/30 rounded-2xl space-y-4 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-700/60 uppercase">信息图 {idx + 1} 方案</span>
                            <button className="text-[10px] text-red-500/40 font-bold hover:text-red-500 transition-colors" onClick={() => setPendingVisuals(prev => prev.filter(v => v.id !== visual.id))}>删除方案</button>
                          </div>
                          
                          <div className="space-y-3">
                            <textarea 
                              value={visual.description}
                              onChange={(e) => setPendingVisuals(prev => prev.map(v => v.id === visual.id ? { ...v, description: e.target.value } : v))}
                              className="w-full h-20 bg-white border border-amber-200/20 rounded-xl p-3 text-[11px] leading-relaxed focus:ring-1 focus:ring-amber-500/20 outline-none resize-none transition-all"
                              placeholder="视觉描述..."
                            />
                            <input 
                              type="text"
                              value={visual.labels}
                              onChange={(e) => setPendingVisuals(prev => prev.map(v => v.id === visual.id ? { ...v, labels: e.target.value } : v))}
                              className="w-full bg-white border border-amber-200/20 rounded-lg px-3 py-2 text-[10px] focus:ring-1 focus:ring-amber-500/20 outline-none transition-all"
                              placeholder="关键标签/文字内容..."
                            />
                          </div>

                          {generatingVisualIds.includes(visual.id) ? (
                            <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 select-none relative overflow-hidden">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-500/40" />
                              <span>正在生成...</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (generationAbortControllers.current[visual.id]) {
                                    generationAbortControllers.current[visual.id].abort();
                                  }
                                }}
                                className="absolute right-3 p-1.5 hover:bg-[#141414]/10 rounded-lg text-red-500 transition-all flex items-center gap-1.5 z-50 cursor-pointer pointer-events-auto"
                                title="停止生成"
                              >
                                <X className="w-3 h-3" />
                                <span className="text-[10px]">停止</span>
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleGenerateVisual(visual)}
                              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                visual.generated 
                                  ? 'bg-white border border-amber-500 text-amber-600 hover:bg-amber-50'
                                  : 'bg-amber-500 text-white hover:bg-amber-600'
                              }`}
                            >
                              {visual.generated ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                              {visual.generated ? `重新生成图表 ${idx + 1}` : `生成信息图 ${idx + 1}`}
                            </button>
                          )}

                          {/* History Gallery for Infographic */}
                          {visual.history && visual.history.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-blue-200/20">
                              <button 
                                onClick={() => setOpenHistoryId(openHistoryId === visual.id ? null : visual.id)}
                                className="flex items-center gap-1.5 text-[9px] font-bold text-blue-700/40 hover:text-blue-700 transition-colors uppercase tracking-wider"
                              >
                                <History className="w-2.5 h-2.5" />
                                历史版本 ({visual.history.length})
                                {openHistoryId === visual.id ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                              </button>
                              
                              <AnimatePresence>
                                {openHistoryId === visual.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden mt-3"
                                  >
                                    <div className="grid grid-cols-2 gap-2">
                                      {visual.history.map((entry, eIdx) => (
                                        <div 
                                          key={eIdx} 
                                          className={`group relative aspect-video bg-white border ${(entry.isCurrent || (visual.activeTimestampPath === entry.path)) ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/20' : 'border-blue-200/30'} rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer`}
                                          onClick={() => handleRestoreHistory(visual, entry)}
                                          title="点击还原此版本"
                                        >
                                          <img src={resolveAssetUrl(entry.path, assetRefreshKey)} alt={`V${visual.history.length - eIdx}`} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                            <RefreshCw className="w-3 h-3 text-white" />
                                            <span className="text-[8px] text-white font-bold">还原 V{visual.history.length - eIdx}</span>
                                          </div>
                                          <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 rounded text-[7px] text-white font-bold">
                                            {(entry.isCurrent || (visual.activeTimestampPath === entry.path)) ? '当前版本' : `V${visual.history.length - eIdx}`}
                                          </div>
                                          {(entry.isCurrent || (visual.activeTimestampPath === entry.path)) && (
                                            <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-lg ring-1 ring-white/50 z-10">
                                              <CheckCircle2 className="w-2.5 h-2.5" />
                                            </div>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const isSelected = compareItems.some(i => i.path === entry.path);
                                              if (isSelected) {
                                                setCompareItems(prev => prev.filter(i => i.path !== entry.path));
                                              } else {
                                                if (compareItems.length >= 2) {
                                                  setCompareItems([compareItems[1], entry]);
                                                } else {
                                                  setCompareItems(prev => [...prev, entry]);
                                                }
                                              }
                                              if (compareItems.length === 1 && !isSelected) setShowComparisonModal(true);
                                            }}
                                            className={`absolute bottom-1 right-1 p-1 rounded-md transition-all ${compareItems.some(i => i.path === entry.path) ? 'bg-blue-500 text-white' : 'bg-white/80 text-blue-900 opacity-0 group-hover:opacity-100'}`}
                                            title="加入对比"
                                          >
                                            <Layers className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    <button 
                      onClick={handleGenerateAllInfographics}
                      disabled={isBatchGenerating}
                      className="w-full mt-4 group flex items-center gap-4 bg-blue-600 rounded-2xl p-4 text-left hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                        {isBatchGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">一键生成所有信息图</p>
                        <p className="text-[10px] opacity-60 text-white/70 mt-0.5">并行启动生成任务</p>
                      </div>
                    </button>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
