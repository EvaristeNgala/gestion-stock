
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./stock.module.css";

function Stock() {
  const navigate = useNavigate();

  // ==============================
  // RECHERCHE
  // ==============================

  const [search, setSearch] = useState("");

  // ==============================
  // PRODUITS FIREBASE
  // ==============================

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  // ==============================
  // CHARGER LES PRODUITS
  // ==============================

  useEffect(() => {
    const productsQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(productsList);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Erreur lors du chargement du stock :",
          error
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ==============================
  // RECHERCHE
  // ==============================

  const filteredProducts = products.filter((product) => {
    const productName = product.productName || "";
    const categoryName = product.categoryName || "";

    const searchText = search.toLowerCase();

    return (
      productName.toLowerCase().includes(searchText) ||
      categoryName.toLowerCase().includes(searchText)
    );
  });

  // ==============================
  // CALCULS STOCK
  // ==============================

  const totalProducts = products.length;

  const lowStockProducts = products.filter((product) => {
    const stock = Number(product.stock || 0);
    const alertStock = Number(product.alertStock || 0);

    return stock > 0 && stock <= alertStock;
  }).length;

  const outOfStockProducts = products.filter((product) => {
    return Number(product.stock || 0) <= 0;
  }).length;

  const normalStockProducts = products.filter((product) => {
    const stock = Number(product.stock || 0);
    const alertStock = Number(product.alertStock || 0);

    return stock > alertStock;
  }).length;

  // ==============================
  // ETAT DU STOCK
  // ==============================

  const getStockStatus = (product) => {
    const stock = Number(product.stock || 0);
    const alertStock = Number(product.alertStock || 0);

    if (stock <= 0) {
      return {
        label: "Rupture",
        className: styles.outOfStock,
      };
    }

    if (stock <= alertStock) {
      return {
        label: "Stock faible",
        className: styles.lowStock,
      };
    }

    return {
      label: "Normal",
      className: styles.stock,
    };
  };

  // ==============================
  // AFFICHAGE
  // ==============================

  return (
    <div className={styles.container}>

      {/* ==========================
          HEADER
      =========================== */}

      <header className={styles.header}>

        <button
          className={styles.backButton}
          onClick={() => navigate("/dashboard")}
        >
          ←
        </button>

        <h1>Gestion du stock</h1>


      </header>

      
        <button 
            className={styles.adjustButton} 
            onClick={() => navigate("/stock/adjustment")} 
        >
            Ajustement
        </button>

      {/* ==========================
          RESUME
      =========================== */}

      <section className={styles.summary}>

        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            📦
          </span>

          <div>
            <strong>{totalProducts}</strong>
            <p>Produits</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            🟢
          </span>

          <div>
            <strong>{normalStockProducts}</strong>
            <p>Normal</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            ⚠️
          </span>

          <div>
            <strong>{lowStockProducts}</strong>
            <p>Stock faible</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            🔴
          </span>

          <div>
            <strong>{outOfStockProducts}</strong>
            <p>Rupture</p>
          </div>
        </div>

      </section>

      {/* ==========================
          RECHERCHE
      =========================== */}

      <div className={styles.searchContainer}>

        <span>🔍</span>

        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>

      {/* ==========================
          TITRE
      =========================== */}

      <div className={styles.titleSection}>

        <div>
          <h2>État du stock</h2>

          <p>
            Consultez et ajustez les quantités disponibles.
          </p>
        </div>

        <span>
          {filteredProducts.length} produit
          {filteredProducts.length > 1 ? "s" : ""}
        </span>

      </div>

      {/* ==========================
          CHARGEMENT
      =========================== */}

      {loading ? (

        <div className={styles.empty}>

          <span>⏳</span>

          <p>
            Chargement du stock...
          </p>

        </div>

      ) : (

        /* ==========================
           TABLEAU
        =========================== */

        <div className={styles.tableContainer}>

          {filteredProducts.length === 0 ? (

            <div className={styles.empty}>

              <span>📦</span>

              <p>
                {search
                  ? "Aucun produit trouvé"
                  : "Aucun produit enregistré"}
              </p>

            </div>

          ) : (

            <table className={styles.stockTable}>

              <thead>

                <tr>

                  <th>Produit</th>

                  <th>Catégorie</th>

                  <th>Stock</th>

                  <th>Seuil</th>

                  <th>État</th>

                  <th>Action</th>

                </tr>

              </thead>

              <tbody>

                {filteredProducts.map((product) => {

                  const status =
                    getStockStatus(product);

                  return (

                    <tr key={product.id}>

                      {/* PRODUIT */}

                      <td>

                        <div className={styles.productCell}>

                          <div className={styles.productIcon}>

                            {product.image ? (

                              <img
                                src={product.image}
                                alt={product.productName}
                              />

                            ) : (

                              <span>📦</span>

                            )}

                          </div>

                          <div>

                            <strong>
                              {product.productName}
                            </strong>

                            <small>
                              {product.stockUnit || "unité"}
                            </small>

                          </div>

                        </div>

                      </td>

                      {/* CATEGORIE */}

                      <td>

                        {product.categoryName ||
                          product.category ||
                          "—"}

                      </td>

                      {/* STOCK */}

                      <td>

                        <strong>
                          {Number(
                            product.stock || 0
                          ).toLocaleString()}
                        </strong>{" "}

                        {product.stockUnit || ""}

                      </td>

                      {/* SEUIL */}

                      <td>

                        {Number(
                          product.alertStock || 0
                        ).toLocaleString()}

                      </td>

                      {/* ETAT */}

                      <td>

                        <span
                          className={
                            status.className
                          }
                        >
                          {status.label}
                        </span>

                      </td>

                      {/* ACTION */}

                      <td>

                        <button
                          className={styles.adjustButtonTable}
                          onClick={() =>
                            navigate(
                              `/stock/adjustment/${product.id}`
                            )
                          }
                        >
                          Ajuster
                        </button>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          )}

        </div>

      )}

    </div>
  );
}

export default Stock;