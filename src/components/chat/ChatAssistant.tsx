import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, ChevronRight, MessageSquare, RotateCcw, 
  Loader2, Maximize2, Feather, Zap, Send
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface ChatAssistantProps {
  chatPanelWidth: number;
  isChatOpen: boolean;
  setIsChatOpen: (show: boolean) => void;
  startResizingChat: (e: React.MouseEvent) => void;
  chatMessages: any[];
  handleRollback: (idx: number) => void;
  isChatLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  activeQuickActionMenu: string | null;
  setActiveQuickActionMenu: (menu: string | null) => void;
  activeId: number | 'plan';
  handleQuickAction: (type: string, subType?: string) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleSendMessage: () => void;
}

export const ChatAssistant = ({
  chatPanelWidth, isChatOpen, setIsChatOpen, startResizingChat,
  chatMessages, handleRollback, isChatLoading, messagesEndRef,
  activeQuickActionMenu, setActiveQuickActionMenu, activeId,
  handleQuickAction, chatInput, setChatInput, handleSendMessage
}: ChatAssistantProps) => {
  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.aside
          key="ai-assistant-panel"
          initial={{ x: chatPanelWidth }}
          animate={{ x: 0 }}
          exit={{ x: chatPanelWidth }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          style={{ width: chatPanelWidth }}
          className="border-l border-[#141414]/10 bg-white flex flex-col shadow-2xl relative shrink-0"
        >
          <div onMouseDown={startResizingChat} className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-[#5A5A40]/30 transition-colors z-50" />
          <div className="p-4 border-b border-[#141414]/10 flex items-center justify-between bg-[#F5F5F0]/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5A5A40]" />
              <span className="text-sm font-bold uppercase tracking-wider">AI 编辑助手</span>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-[#141414]/5 rounded-full"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F0]/10">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-[#5A5A40]" />
                </div>
                <p className="text-xs text-[#141414]/50 px-6">您可以要求我修改文章内容，例如：“帮我把第二段改得更通俗易懂”。</p>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-[#5A5A40] text-white rounded-tr-none' : 'bg-white border border-[#141414]/10 text-[#141414] rounded-tl-none shadow-sm'}`}>
                  {msg.content}
                </div>
                {msg.isModification && (
                  <button onClick={() => handleRollback(idx)} className="mt-1 flex items-center gap-1 text-[10px] text-[#5A5A40] hover:underline px-1">
                    <RotateCcw className="w-2.5 h-2.5" /> 撤销修改
                  </button>
                )}
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#141414]/10 p-3 rounded-2xl rounded-tl-none shadow-sm"><Loader2 className="w-4 h-4 animate-spin text-[#5A5A40]" /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[#141414]/10 bg-white">
            <div className="flex flex-wrap items-center gap-2 mb-3 relative">
              <div className="relative">
                <Tooltip text="修改长度">
                  <button onClick={() => setActiveQuickActionMenu(activeQuickActionMenu === 'length' ? null : 'length')} disabled={activeId === 'plan'} className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${activeId === 'plan' ? 'bg-[#F5F5F0] text-[#141414]/20' : activeQuickActionMenu === 'length' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#141414]/60'}`}><Maximize2 className="w-3.5 h-3.5" /></button>
                </Tooltip>
                <AnimatePresence>
                  {activeQuickActionMenu === 'length' && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 mb-2 w-24 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-50 overflow-hidden">
                      <button onClick={() => handleQuickAction('length', 'polish')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] border-b border-[#141414]/5">润色</button>
                      <button onClick={() => handleQuickAction('length', 'shorten')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] border-b border-[#141414]/5">精简</button>
                      <button onClick={() => handleQuickAction('length', 'expand')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0]">扩充</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Tooltip text="智能建议">
                <button onClick={() => handleQuickAction('suggest')} disabled={activeId === 'plan'} className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${activeId === 'plan' ? 'bg-[#F5F5F0] text-[#141414]/20' : 'bg-[#F5F5F0] text-[#141414]/60'}`}><Zap className="w-3.5 h-3.5" /></button>
              </Tooltip>
            </div>
            <div className="relative">
              <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="输入修改指令..." className="w-full p-3 pr-12 bg-[#F5F5F0] rounded-xl text-sm outline-none resize-none h-20" />
              <button onClick={() => handleSendMessage()} disabled={!chatInput.trim() || isChatLoading} className="absolute bottom-3 right-3 p-2 bg-[#5A5A40] text-white rounded-lg disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
