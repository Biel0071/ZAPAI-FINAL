import { useNavigate } from "react-router-dom";
import { ArrowLeft, House, Wrench } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface UnderConstructionProps {
  title?: string;
  description?: string;
}

export function UnderConstruction({
  title = "Módulo em Desenvolvimento",
  description = "Esta funcionalidade está em fase de construção pela nossa equipe de engenharia e estará disponível em breve no ambiente SaaS consolidado.",
}: UnderConstructionProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)] border border-amber-500/20">
        <Wrench className="h-10 w-10 animate-bounce" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500"></span>
        </span>
      </div>
      <h3 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        🚧 {title}
      </h3>
      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Button
          variant="outline"
          className="gap-2 rounded-xl h-11 px-5"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          className="gap-2 rounded-xl h-11 px-5 shadow-glow"
          onClick={() => navigate("/dashboard")}
        >
          <House className="h-4 w-4" />
          Dashboard
        </Button>
      </div>
    </div>
  );
}
