import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { PartiesPage } from "./pages/PartiesPage";
import { CentersPage } from "./pages/CentersPage";
import { RoutesPage } from "./pages/RoutesPage";
import { PriceListsPage } from "./pages/PriceListsPage";
import { ProcessTypesPage } from "./pages/ProcessTypesPage";
import { OperationsPage } from "./pages/OperationsPage";
import { PurchasePage } from "./pages/PurchasePage";
import { ProcessingPage } from "./pages/ProcessingPage";
import { WeighingPage } from "./pages/WeighingPage";
import { TicketPage } from "./pages/TicketPage";
import { CashierPage } from "./pages/CashierPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SalesPage } from "./pages/SalesPage";
import { LogisticsPage } from "./pages/LogisticsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SalesHistoryPage } from "./pages/SalesHistoryPage";
import { UsersPage } from "./pages/UsersPage";
import { DevicesPage } from "./pages/DevicesPage";

export function App() {
  const { token } = useAuth();

  if (!token) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/parties" element={<PartiesPage />} />
        <Route path="/centers" element={<CentersPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/price-lists" element={<PriceListsPage />} />
        <Route path="/process-types" element={<ProcessTypesPage />} />
        <Route path="/compra" element={<PurchasePage />} />
        <Route path="/processing" element={<ProcessingPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/weighing" element={<WeighingPage />} />
        <Route path="/ticket" element={<TicketPage />} />
        <Route path="/cashier" element={<CashierPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/logistics" element={<LogisticsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/sales-history" element={<SalesHistoryPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
    </Routes>
  );
}
