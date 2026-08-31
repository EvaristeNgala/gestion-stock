import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./composantes/dashbord";
import Home from "./composantes/home";
import Produit from "./composantes/produit/produit";
import AddProduct from "./composantes/produit/AddProduct";


function App () {

  return (
      <Routes> 
        <Route path="/" element={<Home/>}/>
        <Route path="/dashboard" element={<Dashboard/>}/>
        <Route path="/products" element={<Produit />} />
        <Route path="/Addproducts" element={<AddProduct />} />
      </Routes>
  )
}

export default App;