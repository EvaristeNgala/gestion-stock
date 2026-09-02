import { Routes, Route } from "react-router-dom";
import Dashboard from "./composantes/dashbord";
import Home from "./composantes/home";
import Produit from "./composantes/produit/produit";
import AddProduct from "./composantes/produit/AddProduct";
import Stock from "./composantes/stock/stock";
import Ajustement from "./composantes/stock/Ajustement";
import POS from "./composantes/pos/pos";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/products" element={<Produit />} />
      <Route path="/Addproducts" element={<AddProduct />} />
      <Route path="/stock" element={<Stock />} />
      <Route path="/stock/adjustment" element={<Ajustement />} />
      <Route path="/pos" element={<POS />} />
    </Routes>
  );
}

export default App;
