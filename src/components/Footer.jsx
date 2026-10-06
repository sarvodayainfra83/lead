import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full py-1.5 md:py-1 border-t border-sky-100 bg-white/95 backdrop-blur-xs shrink-0 z-20 shadow-[0_-1px_3px_rgba(0,0,0,0.03)] pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-[11px] md:text-xs font-semibold text-sky-700 select-none flex items-center justify-center gap-1">
          <span>Powered By</span>
          <a
            href="https://www.botivate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:text-sky-800 font-bold hover:underline transition-all"
          >
            Botivate
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;