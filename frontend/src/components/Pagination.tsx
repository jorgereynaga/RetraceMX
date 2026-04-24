type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function Pagination({ page, totalPages, totalItems, from, to, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  if (totalItems === 0) {
    return <div className="muted" style={{ marginTop: 12 }}>Sin registros para mostrar.</div>;
  }

  return (
    <div className="pagination-bar">
      <span className="muted">
        Mostrando {from}-{to} de {totalItems}
      </span>
      <div className="pagination-controls">
        <label className="pagination-size">
          Tamaño
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ghost-button" onClick={() => onPageChange(1)} disabled={page <= 1}>
          Primera
        </button>
        <button type="button" className="ghost-button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Anterior
        </button>
        <span className="muted">
          Página {page} de {totalPages}
        </span>
        <button type="button" className="ghost-button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Siguiente
        </button>
        <button type="button" className="ghost-button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
          Última
        </button>
      </div>
    </div>
  );
}
