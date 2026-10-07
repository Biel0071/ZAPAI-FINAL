import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/core/lib/utils";

export interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  children?: React.ReactNode;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 1,
  pageSize,
  onPageChange,
  className,
  children,
}) => {
  if (children) {
    return (
      <nav
        role="navigation"
        aria-label="Paginação"
        className={cn("mx-auto flex w-full justify-center", className)}
      >
        {children}
      </nav>
    );
  }

  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1 && onPageChange) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages && onPageChange) onPageChange(currentPage + 1);
  };

  // Generate page numbers with ellipsis for desktop
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Paginação"
      className={cn("flex items-center justify-between sm:justify-center gap-1.5 select-none py-2", className)}
    >
      {/* Previous Button */}
      <button
        type="button"
        onClick={handlePrev}
        disabled={currentPage <= 1}
        aria-label="Página anterior"
        className={cn(
          "h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors",
          currentPage <= 1
            ? "border-border/40 text-muted-foreground/40 cursor-not-allowed bg-transparent"
            : "border-border/70 text-foreground bg-card hover:bg-muted/40 hover:border-emerald-500/50 cursor-pointer shadow-xs"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Anterior</span>
      </button>

      {/* Mobile view: "Página X de Y" */}
      <div className="flex sm:hidden items-center px-2 text-xs font-mono text-muted-foreground">
        <span>
          Página <strong className="text-foreground">{currentPage}</strong> de{" "}
          <strong className="text-foreground">{totalPages}</strong>
        </span>
      </div>

      {/* Desktop view: Page number buttons */}
      <div className="hidden sm:flex items-center gap-1">
        {pageNumbers.map((page, idx) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground font-mono"
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer",
                isActive
                  ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
                  : "border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-border"
              )}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        type="button"
        onClick={handleNext}
        disabled={currentPage >= totalPages}
        aria-label="Próxima página"
        className={cn(
          "h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors",
          currentPage >= totalPages
            ? "border-border/40 text-muted-foreground/40 cursor-not-allowed bg-transparent"
            : "border-border/70 text-foreground bg-card hover:bg-muted/40 hover:border-emerald-500/50 cursor-pointer shadow-xs"
        )}
      >
        <span className="hidden sm:inline">Próxima</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
};

export const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
  )
);
PaginationContent.displayName = "PaginationContent";

export const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />
);
PaginationItem.displayName = "PaginationItem";

export const PaginationLink = ({ className, isActive, size = "icon", ...props }: any) => (
  <button
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer",
      isActive
        ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
        : "border border-border/60 bg-card text-muted-foreground hover:text-foreground",
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

export const PaginationPrevious = ({ className, ...props }: any) => (
  <button
    className={cn("h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 border border-border/70 text-foreground bg-card hover:bg-muted/40", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Anterior</span>
  </button>
);
PaginationPrevious.displayName = "PaginationPrevious";

export const PaginationNext = ({ className, ...props }: any) => (
  <button
    className={cn("h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 border border-border/70 text-foreground bg-card hover:bg-muted/40", className)}
    {...props}
  >
    <span>Próxima</span>
    <ChevronRight className="h-4 w-4" />
  </button>
);
PaginationNext.displayName = "PaginationNext";

export const PaginationEllipsis = ({ className, ...props }: any) => (
  <span className={cn("h-8 w-8 flex items-center justify-center text-xs text-muted-foreground font-mono", className)} {...props}>
    ...
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export default Pagination;
