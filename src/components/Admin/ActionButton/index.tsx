import { ReactNode } from "react";

interface TypeButton {
  onClick: () => void;
  icon: ReactNode;
  bgColor: string;
  label: ReactNode;
  textColor: string;
  hoverShadowColor: string;
}

export function ActionButton({
  icon,
  label,
  onClick,
  bgColor,
  textColor,
  hoverShadowColor,
}: TypeButton) {
  return (
    <button
      onClick={() => onClick()}
      className={`border ${bgColor} dark:bg-[#222] ${textColor} rounded-lg py-5 px-2 text-center flex flex-col items-center justify-center transition duration-200 hover:shadow-[0px_0px_8px_1px_rgba(0,_0,_0,_0.1)] ${hoverShadowColor} active:shadow-none`}
    >
      <div className="mb-2">{icon}</div>
      <span className="font-medium">{label}</span>
    </button>
  );
}
