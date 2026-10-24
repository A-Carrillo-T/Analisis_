export function Button({ children, variant = 'primary', className = '', ...props }) {
  const baseStyles = "inline-flex items-center justify-center rounded-[6px] px-[22px] py-[16px] text-[14px] font-arial uppercase tracking-[0.08em] font-medium transition-all duration-300";
  
  const variants = {
    primary: "bg-aurora text-[#222222] hover:opacity-90 hover:scale-[1.02]",
    ghost: "bg-transparent text-silver-mist hover:text-platinum",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}