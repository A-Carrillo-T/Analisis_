export function Badge({ children, status = 'neutral' }) {
  const styles = {
    neutral: "border-carbon-ink text-carbon-ink",
    success: "bg-voltage-lime border-voltage-lime text-true-black",
    danger: "bg-red-100 border-red-200 text-red-800"
  };

  return (
    <span className={`inline-flex items-center px-4 py-2 rounded-[9999px] border text-[14px] font-medium ${styles[status]}`}>
      {children}
    </span>
  );
}