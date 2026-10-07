import { Routes, Route } from "react-router-dom";

import Dashboard from "./composantes/dashbord";
import Home from "./composantes/home";
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

function App() {
  return (
    <Routes>

      {/* ==========================================
          PAGES PUBLIQUES
      ========================================== */}

      <Route path="/" element={<Home />} />

      <Route
        path="/create-store"
        element={<CreateStore />}
      />


      {/* ==========================================
          DASHBOARD
      ========================================== */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />


      {/* ==========================================
          PRODUITS
      ========================================== */}

      <Route
        path="/products"
        element={
          <ProtectedRoute permission="products">
            <Produit />
          </ProtectedRoute>
        }
      />

      <Route
        path="/Addproducts"
        element={
          <ProtectedRoute permission="products">
            <AddProduct />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/:productId/edit"
        element={
          <ProtectedRoute permission="products">
            <AddProduct />
          </ProtectedRoute>
        }
      />

      {/* ==========================================
          STOCK
      ========================================== */}

      <Route
        path="/stock"
        element={
          <ProtectedRoute permission="stock">
            <Stock />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock/adjustment"
        element={
          <ProtectedRoute permission="stock">
            <Ajustement />
          </ProtectedRoute>
        }
      />


      {/* ==========================================
          POS / CAISSE
      ========================================== */}

      <Route
        path="/pos"
        element={
          <ProtectedRoute permission="pos">
            <POS />
          </ProtectedRoute>
        }
      />


      {/* ==========================================
          RAPPORTS
      ========================================== */}

      <Route
        path="/reports"
        element={
          <ProtectedRoute permission="reports">
            <Reports />
          </ProtectedRoute>
        }
      />


      {/* ==========================================
          PARAMÈTRES
      ========================================== */}

      <Route
        path="/settings"
        element={
          <ProtectedRoute permission="settings">
            <Settings />
          </ProtectedRoute>
        }
      />


      {/* ==========================================
          GESTION DES EMPLOYÉS
      ========================================== */}

      <Route
        path="/settings/employees"
        element={
          <ProtectedRoute permission="settings">
            <Employees />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales-history"
        element={
          <ProtectedRoute permission="pos">
            <SalesHistory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses"
        element={
          <ProtectedRoute permission="pos">
            <Expenses />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cash-closing"
        element={
          <ProtectedRoute permission="pos">
            <CashClosing />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/:productId"
        element={
          <ProtectedRoute permission="products">
            <ProductDetails />
          </ProtectedRoute>
        }
      />

       <Route
        path="/calendar"
        element={
          <ProtectedRoute permission="calendar">
            <Calendar />
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}

export default App;

