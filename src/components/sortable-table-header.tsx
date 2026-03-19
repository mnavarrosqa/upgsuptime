import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface SortableTableHeaderProps {
  column: string;
  label: string;
  currentSort: { field: string; direction: "asc" | "desc" };
  onSort: (field: string) => void;
  className?: string;
}

export function SortableTableHeader({
  column,
  label,
  currentSort,
  onSort,
  className = "",
}: SortableTableHeaderProps) {
  const isSorted = currentSort.field === column;
  const direction = isSorted ? currentSort.direction : "none";

  function getAriaSort(): "none" | "ascending" | "descending" {
    if (direction === "asc") return "ascending";
    if (direction === "desc") return "descending";
    return "none";
  }

  function getSortIcon() {
    switch (direction) {
      case "asc":
        return <ChevronUp className="h-4 w-4 text-text-muted" />;
      case "desc":
        return <ChevronDown className="h-4 w-4 text-text-muted" />;
      default:
        return <ChevronsUpDown className="h-4 w-4 text-text-muted" />;
    }
  }

  return (
    <th
      className={`px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:bg-bg-page select-none ${className}`}
      aria-sort={getAriaSort()}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="inline-flex items-center">{getSortIcon()}</span>
      </div>
    </th>
  );
}
