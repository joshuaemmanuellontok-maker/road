import { useState, useEffect } from "react";
import { Wrench } from "lucide-react";
import { AdminLoginModal } from "./AdminLoginModal";

interface LogoWithSecretProps {
  showText?: boolean;
  className?: string;
  iconContainerClassName?: string;
  iconClassName?: string;
  textClassName?: string;
}

export function LogoWithSecret({ 
  showText = true, 
  className = "",
  iconContainerClassName = "w-8 h-8",
  iconClassName = "w-5 h-5",
  textClassName = "text-xl font-bold"
}: LogoWithSecretProps) {
  const [clickCount, setClickCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (clickCount === 5) {
      setIsModalOpen(true);
      setClickCount(0);
    }
  }, [clickCount]);

  // Reset click count after 2 seconds of inactivity
  useEffect(() => {
    if (clickCount > 0 && clickCount < 5) {
      const timer = setTimeout(() => setClickCount(0), 2000);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const handleClick = () => {
    setClickCount((prev) => prev + 1);
  };

  return (
    <>
      <div
        className={`flex items-center gap-3 ${className}`}
      >
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClick();
          }}
          className={`${iconContainerClassName} group relative cursor-pointer overflow-hidden rounded-2xl border border-[#f6c177]/45 bg-[linear-gradient(135deg,#f97316_0%,#fbbf24_48%,#22d3ee_100%)] p-[1px] shadow-[0_14px_35px_rgba(249,115,22,0.26)]`}
          aria-label="Soteria logo"
        >
          <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#07111f]/92">
            <Wrench className={`${iconClassName} text-[#ffd08a] drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]`} />
          </div>
        </div>
        {showText && (
          <span className={`${textClassName} bg-[linear-gradient(110deg,#ffffff_0%,#ffe0ad_42%,#7dd3fc_100%)] bg-clip-text font-semibold tracking-[0.02em] text-transparent`}>
            Soteria
          </span>
        )}
      </div>
      
      <AdminLoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
