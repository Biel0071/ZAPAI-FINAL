import React from "react";
import { Plus } from "@phosphor-icons/react";

interface AddAttendantCardProps {
  onAdd: () => void;
}

export const AddAttendantCard: React.FC<AddAttendantCardProps> = ({ onAdd }) => {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="attendant-card-add group flex flex-col items-center justify-center w-[165px] h-[155px] p-3 text-center cursor-pointer select-none shrink-0 rounded-[14px] transition-all duration-200"
      title="Criar Novo Atendente Digital"
    >
      <div className="h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-2 transition-all duration-200 group-hover:scale-110 group-hover:bg-emerald-500/25 group-hover:border-emerald-400">
        <Plus weight="bold" className="h-5 w-5" />
      </div>
      <h4 className="text-xs font-bold text-foreground group-hover:text-emerald-400 transition-colors leading-snug">
        Novo{" "}
        <br />
        Atendente
      </h4>
      <p className="text-[10px] text-muted-foreground mt-1">
        Criar funcionário digital
      </p>
    </button>
  );
};
