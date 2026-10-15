import { useEffect, useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import Produit from "./composantes/produit/produit";
import AddProduct from "./composantes/produit/AddProduct";
import Stock from "./composantes/stock/stock";
import Ajustement from "./composantes/stock/Ajustement";
import POS from "./composantes/pos/pos";
import Reports from "./composantes/report/Reports";
import Settings from "./composantes/setteing/Settings";
import CreateStore from "./composantes/CreateStore";
import Employees from "./composantes/employe/Employees";
import ProtectedRoute from "./components/ProtectedRoute";
import SalesHistory from "./composantes/pos/SalesHistory";
import Expenses from "./composantes/pos/Expenses";
import CashClosing from "./composantes/pos/CashClosing";
import ProductDetails from "./composantes/produit/ProductDetails";
import Calendar from "./composantes/calendror/Calendar";
import CashHistory from "./composantes/Cashhistory/CashHistory";
import Home from "./composantes/home";
import Dashboard from "./composantes/dashboard";
import PosDeviceLogin from "./composantes/pos/PosDeviceLogin";
import PosPin from "./composantes/pos/PosPin";

const guard = (element, permission) => <ProtectedRoute permission={permission}>{element}</ProtectedRoute>;
const native = Capacitor.isNativePlatform();

function RememberLastPage() {
  const location = useLocation();
  useEffect(() => {
    if (native || ["/", "/create-store"].includes(location.pathname)) return;
    try {
      const session = JSON.parse(localStorage.getItem("storeSession") || "null");
      if (!session?.storeId || !(session.uid || session.userId)) return;
      localStorage.setItem(`stockManagerLastPage:${session.storeId}:${session.uid || session.userId}`, location.pathname + location.search);
    } catch (error) { console.warn("Mémorisation impossible", error); }
  }, [location.pathname, location.search]);
  return null;
}

function NativeGate({ children, unlocked }) {
  if (!unlocked) return <Navigate to="/pin" replace />;
  return children;
}

function App() {
  // Mémoire vive uniquement : au redémarrage du processus Android, PIN obligatoire.
  const [unlocked, setUnlocked] = useState(false);
  if (native) return <Routes>
    <Route path="/" element={<PosDeviceLogin />} />
    <Route path="/pin" element={<PosPin onUnlock={() => setUnlocked(true)} onLock={() => setUnlocked(false)} />} />
    <Route path="/pos" element={<NativeGate unlocked={unlocked}>{guard(<POS />, "pos")}</NativeGate>} />
    <Route path="/cash-closing" element={<NativeGate unlocked={unlocked}>{guard(<CashClosing />, "pos")}</NativeGate>} />
    <Route path="/sales-history" element={<NativeGate unlocked={unlocked}>{guard(<SalesHistory />, "pos")}</NativeGate>} />
    <Route path="/expenses" element={<NativeGate unlocked={unlocked}>{guard(<Expenses />, "expenses")}</NativeGate>} />
    <Route path="/cash-history" element={<NativeGate unlocked={unlocked}>{guard(<CashHistory />, "cash-history")}</NativeGate>} />
    <Route path="/settings" element={<NativeGate unlocked={unlocked}>{guard(<Settings />, "settings")}</NativeGate>} />
    <Route path="*" element={<Navigate to="/pin" replace />} />
  </Routes>;
  return <><RememberLastPage /><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/create-store" element={<CreateStore />} />
    <Route path="/dashboard" element={guard(<Dashboard />)} />
    <Route path="/products" element={guard(<Produit />, "products")} />
    <Route path="/Addproducts" element={guard(<AddProduct />, "products")} />
    <Route path="/products/:productId/edit" element={guard(<AddProduct />, "products")} />
    <Route path="/products/:productId" element={guard(<ProductDetails />, "products")} />
    <Route path="/stock" element={guard(<Stock />, "stock")} />
    <Route path="/stock/adjustment" element={guard(<Ajustement />, "stockAdjustment")} />
    <Route path="/pos" element={guard(<POS />, "pos")} />
    <Route path="/reports" element={guard(<Reports />, "reports")} />
    <Route path="/settings" element={guard(<Settings />, "settings")} />
    <Route path="/settings/employees" element={guard(<Employees />, "adminOnly")} />
    <Route path="/sales-history" element={guard(<SalesHistory />, "sales")} />
    <Route path="/expenses" element={guard(<Expenses />, "expenses")} />
    <Route path="/cash-closing" element={guard(<CashClosing />, "pos")} />
    <Route path="/calendar" element={guard(<Calendar />, "calendar")} />
    <Route path="/cash-history" element={guard(<CashHistory />, "cash-history")} />
  </Routes></>;
}
export default App;
