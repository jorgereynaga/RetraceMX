import { useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { AuditLog, PrintLog } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";

export function HistoryPage() {
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [prints, setPrints] = useState<PrintLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [printPage, setPrintPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [printPageSize, setPrintPageSize] = useState(10);
  const [auditSortKey, setAuditSortKey] = useState<"action" | "entity" | "created_at">("created_at");
  const [auditSortDirection, setAuditSortDirection] = useState<"asc" | "desc">("desc");
  const [printSortKey, setPrintSortKey] = useState<"printer_name" | "is_reprint" | "status">("printer_name");
  const [printSortDirection, setPrintSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    api.auditLogs().then(setAudits).catch(() => setAudits([]));
    api.printLogs().then(setPrints).catch(() => setPrints([]));
  }, []);

  const sortedAudits = useMemo(() => {
    const accessors = {
      action: (audit: AuditLog) => audit.action,
      entity: (audit: AuditLog) => `${audit.entity_type}:${audit.entity_id}`,
      created_at: (audit: AuditLog) => audit.created_at,
    } satisfies Record<typeof auditSortKey, (audit: AuditLog) => string | number>;
    return sortByValue(audits, accessors[auditSortKey], auditSortDirection);
  }, [audits, auditSortDirection, auditSortKey]);
  const sortedPrints = useMemo(() => {
    const accessors = {
      printer_name: (printLog: PrintLog) => printLog.printer_name || "",
      is_reprint: (printLog: PrintLog) => (printLog.is_reprint ? 1 : 0),
      status: (printLog: PrintLog) => printLog.status,
    } satisfies Record<typeof printSortKey, (printLog: PrintLog) => string | number>;
    return sortByValue(prints, accessors[printSortKey], printSortDirection);
  }, [prints, printSortDirection, printSortKey]);
  const paginatedAudits = useMemo(() => paginate(sortedAudits, auditPage, auditPageSize), [auditPage, auditPageSize, sortedAudits]);
  const paginatedPrints = useMemo(() => paginate(sortedPrints, printPage, printPageSize), [printPage, printPageSize, sortedPrints]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditPageSize]);

  useEffect(() => {
    setPrintPage(1);
  }, [printPageSize]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditSortDirection, auditSortKey]);

  useEffect(() => {
    setPrintPage(1);
  }, [printSortDirection, printSortKey]);

  function toggleAuditSort(nextKey: typeof auditSortKey) {
    if (nextKey === auditSortKey) {
      setAuditSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setAuditSortKey(nextKey);
    setAuditSortDirection("asc");
  }

  function togglePrintSort(nextKey: typeof printSortKey) {
    if (nextKey === printSortKey) {
      setPrintSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setPrintSortKey(nextKey);
    setPrintSortDirection("asc");
  }

  return (
    <Page title="Historial de operaciones">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section>
          <h3>Auditoria reciente</h3>
          <table className="table">
            <thead>
              <tr>
                <th><SortableHeader label="Acción" active={auditSortKey === "action"} direction={auditSortDirection} onClick={() => toggleAuditSort("action")} /></th>
                <th><SortableHeader label="Entidad" active={auditSortKey === "entity"} direction={auditSortDirection} onClick={() => toggleAuditSort("entity")} /></th>
                <th><SortableHeader label="Fecha" active={auditSortKey === "created_at"} direction={auditSortDirection} onClick={() => toggleAuditSort("created_at")} /></th>
              </tr>
            </thead>
            <tbody>
              {paginatedAudits.items.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.action}</td>
                  <td>
                    {audit.entity_type}:{audit.entity_id}
                  </td>
                  <td>{audit.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            {...paginatedAudits}
            onPageChange={setAuditPage}
            pageSize={auditPageSize}
            onPageSizeChange={setAuditPageSize}
          />
        </section>
        <section>
          <h3>Impresiones</h3>
          <table className="table">
            <thead>
              <tr>
                <th><SortableHeader label="Impresora" active={printSortKey === "printer_name"} direction={printSortDirection} onClick={() => togglePrintSort("printer_name")} /></th>
                <th><SortableHeader label="Reimpresión" active={printSortKey === "is_reprint"} direction={printSortDirection} onClick={() => togglePrintSort("is_reprint")} /></th>
                <th><SortableHeader label="Estado" active={printSortKey === "status"} direction={printSortDirection} onClick={() => togglePrintSort("status")} /></th>
              </tr>
            </thead>
            <tbody>
              {paginatedPrints.items.map((printLog) => (
                <tr key={printLog.id}>
                  <td>{printLog.printer_name || "-"}</td>
                  <td>{printLog.is_reprint ? "Si" : "No"}</td>
                  <td>{printLog.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            {...paginatedPrints}
            onPageChange={setPrintPage}
            pageSize={printPageSize}
            onPageSizeChange={setPrintPageSize}
          />
        </section>
      </div>
    </Page>
  );
}
