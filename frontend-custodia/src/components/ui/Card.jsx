export function Card({ children, className = '' }) {
  return (
    <div className={`bg-liquid-kelp rounded-[16px] p-[36px] border border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(0,130,124,0.4)] hover:border-white/10 ${className}`}>
      {children}
    </div>
  );
}