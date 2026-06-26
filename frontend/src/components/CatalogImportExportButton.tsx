import { useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CatalogImportExecuteResponse, CatalogImportPreviewResponse } from "../api/resources";

type Scope = "all" | "filtered" | "selected";
type DownloadFormat = "csv" | "xlsx";
type ImportMode = "create" | "update" | "upsert";

type Props = {
  catalog: string;
  catalogTitle?: string;
  label?: string;
  search?: string;
  selectedIds?: string[];
  extraQueryParams?: Record<string, string | undefined>;
  canExport?: boolean;
  canImport?: boolean;
  onComplete?: () => void | Promise<void>;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function joinDefined(entries: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value != null && value !== ""));
}

export function CatalogImportExportButton({
  catalog,
  catalogTitle,
  label = "Importar / Exportar",
  search,
  selectedIds = [],
  extraQueryParams = {},
  canExport = true,
  canImport = true,
  onComplete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CatalogImportPreviewResponse["preview"] | null>(null);
  const [previewJob, setPreviewJob] = useState<CatalogImportPreviewResponse["job"] | null>(null);
  const [result, setResult] = useState<CatalogImportExecuteResponse["result"] | null>(null);
  const previewSummary = preview?.summary;
  const previewRows = preview?.rows ?? [];
  const missingHeaders = previewSummary?.missing_headers ?? [];
  const canExecuteImport = Boolean(previewJob) && (previewSummary?.valid_rows ?? 0) > 0;
  const catalogLabel = catalogTitle ?? catalog;

  const filters = useMemo(
    () =>
      joinDefined({
        search: search?.trim() || undefined,
        ...extraQueryParams,
      }),
    [extraQueryParams, search],
  );

  async function download(scope: Scope, format: DownloadFormat, kind: "export" | "template" | "report", jobId?: string) {
    setError(null);
    setBusy(true);
    try {
      const params: Record<string, string | undefined> = { file_format: format };
      if (scope === "selected" && selectedIds.length) {
        params.ids = selectedIds.join(",");
      } else if (scope === "filtered") {
        Object.assign(params, filters);
      }
      const response =
        kind === "export"
          ? await api.catalogExport(catalog, params)
          : kind === "template"
            ? await api.catalogTemplate(catalog, params)
            : jobId
              ? await api.catalogImportReport(catalog, jobId, params)
              : null;
      if (!response) return;
      downloadBlob(response.blob, response.filename ?? `${catalog}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la importacion.");
    } finally {
      setBusy(false);
    }
  }

  async function previewImport() {
    if (!file) {
      setError("Selecciona un archivo CSV o XLSX.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const payload = new FormData();
      payload.append("mode", mode);
      payload.append("file", file);
      const response = await api.catalogImportPreview(catalog, payload);
      setPreview(response.preview);
      setPreviewJob(response.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la importacion.");
    } finally {
      setBusy(false);
    }
  }

  async function executeImport() {
    if (!previewJob) {
      setError("Primero genera la vista previa.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.catalogImportExecute(catalog, previewJob.id);
      setResult(response.result);
      await onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la importacion.");
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setOpen(false);
    setFile(null);
    setMode("upsert");
    setBusy(false);
    setError(null);
    setPreview(null);
    setPreviewJob(null);
    setResult(null);
  }

  return (
    <>
      <button type="button" className="ghost-button" onClick={() => setOpen(true)}>
        Exportar / Importar - {catalogLabel}
      </button>

      {open ? (
        <div className="catalog-dialog-backdrop" role="presentation" onClick={closeModal}>
          <div className="catalog-dialog" role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
            <div className="catalog-dialog-header">
              <div>
                <strong>{label}</strong>
                <div className="muted">Catalogo: {catalogLabel}</div>
              </div>
              <button type="button" className="ghost-button" onClick={closeModal}>
                Cerrar
              </button>
            </div>

            {error ? <div className="error-banner">{error}</div> : null}

            <div className="catalog-dialog-grid">
              <section className="section-panel">
                <div className="section-panel-header">
                  <h3>Exportar y plantillas</h3>
                  <span className="muted">{selectedIds.length ? `${selectedIds.length} seleccionado(s)` : "Sin seleccion"}</span>
                </div>
                <div className="section-panel-body catalog-dialog-actions">
                  <button type="button" className="btn-secondary" onClick={() => void download("all", "csv", "export")} disabled={!canExport || busy}>
                    Exportar CSV
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("all", "xlsx", "export")} disabled={!canExport || busy}>
                    Exportar Excel
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("filtered", "csv", "export")} disabled={!canExport || busy}>
                    Exportar filtrados CSV
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("filtered", "xlsx", "export")} disabled={!canExport || busy}>
                    Exportar filtrados Excel
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("selected", "csv", "export")} disabled={!canExport || busy || !selectedIds.length}>
                    Exportar seleccionados CSV
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("selected", "xlsx", "export")} disabled={!canExport || busy || !selectedIds.length}>
                    Exportar seleccionados Excel
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("all", "csv", "template")} disabled={!canExport || busy}>
                    Plantilla CSV
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void download("all", "xlsx", "template")} disabled={!canExport || busy}>
                    Plantilla Excel
                  </button>
                </div>
              </section>

              <section className="section-panel">
                <div className="section-panel-header">
                  <h3>ImportaciÃ³n</h3>
                  <span className="muted">Cargar, validar, previsualizar y ejecutar</span>
                </div>
                <div className="section-panel-body catalog-dialog-import">
                  <label>
                    Archivo CSV / XLSX
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xlsm"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null);
                        setPreview(null);
                        setPreviewJob(null);
                        setResult(null);
                      }}
                    />
                  </label>
                  <label>
                    Modo
                    <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}>
                      <option value="create">Crear nuevos</option>
                      <option value="update">Actualizar existentes</option>
                      <option value="upsert">Crear o actualizar</option>
                    </select>
                  </label>
                  <div className="catalog-dialog-actions">
                    <button type="button" className="btn-primary" onClick={() => void previewImport()} disabled={busy || !canImport}>
                      Vista previa
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setFile(null)} disabled={busy || !file}>
                      Limpiar archivo
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {preview ? (
              <section className="section-panel">
                <div className="section-panel-header">
                  <h3>Vista previa</h3>
                  <span className="muted">
                    {previewSummary?.valid_rows ?? 0} vÃ¡lidas Â· {previewSummary?.invalid_rows ?? 0} invÃ¡lidas Â· {previewSummary?.duplicates ?? 0} duplicadas
                  </span>
                </div>
                <div className="section-panel-body catalog-dialog-preview">
                  <div className="catalog-dialog-summary">
                    <span>Total: <strong>{previewSummary?.total_rows ?? 0}</strong></span>
                    <span>Encabezados faltantes: <strong>{missingHeaders.length ? missingHeaders.join(", ") : "Ninguno"}</strong></span>
                    <span>Encontradas: <strong>{previewSummary?.found_rows ?? 0}</strong></span>
                    <span>Omitidas: <strong>{previewSummary?.omitted_rows ?? 0}</strong></span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Fila</th>
                          <th>Accion</th>
                          <th>Estado</th>
                          <th>Errores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.row_number}>
                            <td>{row.row_number}</td>
                            <td>{row.action}</td>
                            <td>
                              <span className={`badge ${row.status === "valid" ? "badge-green" : row.status === "omitted" ? "badge-yellow" : "badge-red"}`}>{row.status}</span>
                            </td>
                            <td>{(row.errors ?? []).length ? (row.errors ?? []).join(" - ") : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {previewJob ? (
              <div className="catalog-dialog-footer">
                <button type="button" className="btn-primary" onClick={() => void executeImport()} disabled={busy || !canExecuteImport}>
                  Confirmar importaciÃ³n
                </button>
                {!canExecuteImport ? <span className="muted">No hay filas vÃ¡lidas para ejecutar.</span> : null}
              </div>
            ) : null}

            {result ? (
              <section className="section-panel">
                <div className="section-panel-header">
                  <h3>Resultado</h3>
                  <span className="muted">{result.summary.processed} procesadas</span>
                </div>
                <div className="section-panel-body catalog-dialog-summary">
                  <span>Encontradas: <strong>{result.summary.found}</strong></span>
                  <span>Creadas: <strong>{result.summary.created}</strong></span>
                  <span>Actualizadas: <strong>{result.summary.updated}</strong></span>
                  <span>Omitidas: <strong>{result.summary.omitted}</strong></span>
                  <span>Rechazadas: <strong>{result.summary.rejected}</strong></span>
                  <span>Errores: <strong>{result.summary.errors}</strong></span>
                  <div className="catalog-dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => void download("all", "csv", "report", result.job_id)} disabled={busy}>
                      Reporte CSV
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => void download("all", "xlsx", "report", result.job_id)} disabled={busy}>
                      Reporte Excel
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

