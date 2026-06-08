import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  className?: string;
}

export const Tooltip = ({ children, text, className = "" }: TooltipProps) => {
  const [show, setShow] = useState(false);
  return (
    <div 
      className={`relative flex items-center ${className}`} 
      onMouseEnter={() => setShow(true)} 
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#141414] text-white text-[10px] rounded shadow-lg whitespace-nowrap pointer-events-none z-[60]"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#141414]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
