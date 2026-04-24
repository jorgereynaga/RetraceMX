type SortDirection = "asc" | "desc";

type SortableHeaderProps = {
  label: string;
  active?: boolean;
  direction?: SortDirection;
  onClick: () => void;
};

export function SortableHeader({ label, active = false, direction = "asc", onClick }: SortableHeaderProps) {
  return (
    <button type="button" className={`sortable-header${active ? " active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <span className="sortable-header-indicator">{active ? (direction === "asc" ? "^" : "v") : "<>"}</span>
    </button>
  );
}
