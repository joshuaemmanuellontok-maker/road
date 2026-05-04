import { useState, useEffect } from "react";
import { Car } from "lucide-react";
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
        className={`flex items-center gap-2 ${className}`}
      >
        <div 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClick();
          }}
          className={`${iconContainerClassName} cursor-pointer bg-[#ff6b3d] rounded-lg flex items-center justify-center`}
        >
          <Car className={`${iconClassName} text-white`} />
        </div>
        {showText && <span className={`${textClassName} text-white`}>Soteria</span>}
      </div>
      
      <AdminLoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
