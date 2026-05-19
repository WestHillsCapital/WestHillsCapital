export function LogoD() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10 px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">D — Corner Fold</p>

      {/* On light */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 shrink-0">
          <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Page body */}
            <path d="M6 4h18l6 6v22H6V4z" fill="#0E1D4A" />
            {/* Fold triangle */}
            <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
            {/* Lines suggesting form fields */}
            <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            {/* Gold check in bottom right */}
            <circle cx="26" cy="28" r="5" fill="#C49A38" />
            <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-[#0E1D4A]">
          Docuplete<span className="text-[#C49A38]">.</span>
        </span>
      </div>

      {/* Icon alone — zoomed in */}
      <div className="w-20 h-20">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M6 4h18l6 6v22H6V4z" fill="#0E1D4A" />
          <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
          <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <circle cx="26" cy="28" r="5" fill="#C49A38" />
          <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* On dark */}
      <div className="flex items-center gap-3 bg-[#0E1D4A] rounded-2xl px-8 py-5">
        <div className="w-9 h-9 shrink-0">
          <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M6 4h18l6 6v22H6V4z" fill="white" opacity="0.15" />
            <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
            <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <circle cx="26" cy="28" r="5" fill="#C49A38" />
            <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Docuplete<span className="text-[#C49A38]">.</span>
        </span>
      </div>
    </div>
  );
}
