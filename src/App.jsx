import { Routes, Route } from "react-router-dom";
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

const guard = (element, permission) => (
  <ProtectedRoute permission={permission}>{element}</ProtectedRoute>
);
function App() {
  return <Routes>
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
  </Routes>;
}
export default App;
