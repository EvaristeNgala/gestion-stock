import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./stock.module.css";

function Stock() {
  const navigate = useNavigate();

  // ==============================
  // SESSION MAGASIN
  // ==============================

  const savedSession = localStorage.getItem("storeSession");

  const session = savedSession
    ? JSON.parse(savedSession)
    : null;

  const storeId = session?.storeId || "";

  // ==============================
  // RECHERCHE
  // ==============================

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 10;

  // ==============================
  // PRODUITS FIREBASE
  // ==============================

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==============================
  // VARIANTE SELECTIONNEE
  // ==============================

  const [selectedVariants, setSelectedVariants] = useState({});

  // ==============================
  // CHARGER LES PRODUITS
  // ==============================

  useEffect(() => {
    // ==============================
    // AUCUN MAGASIN CONNECTE
    // ==============================

    if (!storeId) {
      console.warn(
        "Aucun magasin connecté pour charger le stock."
      );

      setProducts([]);
      setLoading(false);

      return;
    }

    // ==============================
    // PRODUITS DU MAGASIN UNIQUEMENT
    // ==============================

    const productsQuery = query(
      collection(db, "products"),

      // IMPORTANT :
      // on récupère uniquement les produits
      // appartenant au magasin connecté
      where("storeId", "==", storeId),

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

        setProducts([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  // ==============================
  // RECHERCHE
  // ==============================

  const filteredProducts = products.filter((product) => {
    const productName = product.productName || "";
    const categoryName = product.categoryName || product.category || "";
    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      productName.toLowerCase().includes(searchText) ||
      categoryName.toLowerCase().includes(searchText);

    const matchesCategory =
      selectedCategory === "all" || categoryName === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Catégories réellement présentes dans les produits du magasin
  const categories = [...new Set(
    products
      .map((product) => product.categoryName || product.category || "")
      .map((category) => category.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "fr"));

  // Pagination : 10 produits par page
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  // Revenir à la première page lorsque les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  // ==============================
  // CALCULS STOCK
  // ==============================

  const totalProducts =
    products.length;

  const lowStockProducts =
    products.filter((product) => {
      const stock =
        Number(product.stock || 0);

      const alertStock =
        Number(product.alertStock || 0);

      return (
        stock > 0 &&
        stock <= alertStock
      );
    }).length;

  const outOfStockProducts =
    products.filter((product) => {
      return Number(product.stock || 0) <= 0;
    }).length;

  const normalStockProducts =
    products.filter((product) => {
      const stock =
        Number(product.stock || 0);

      const alertStock =
        Number(product.alertStock || 0);

      return stock > alertStock;
    }).length;

  // ==============================
  // ETAT DU STOCK
  // ==============================

  const getStockStatus = (product) => {
    const stock =
      Number(product.stock || 0);

    const alertStock =
      Number(product.alertStock || 0);

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
  // CHANGER DE VARIANTE
  // ==============================

  const handleVariantChange = (
    productId,
    value
  ) => {
    setSelectedVariants((previous) => ({
      ...previous,
      [productId]: value,
    }));
  };

  // ==============================
  // OBTENIR LA VARIANTE SELECTIONNEE
  // ==============================

  const getSelectedVariant = (product) => {
    const variants =
      Array.isArray(product.variants)
        ? product.variants
        : [];

    const selectedValue =
      selectedVariants[product.id];

    if (
      selectedValue === undefined ||
      selectedValue === ""
    ) {
      return null;
    }

    const variantIndex =
      Number(selectedValue);

    if (
      Number.isNaN(variantIndex) ||
      !variants[variantIndex]
    ) {
      return null;
    }

    return variants[variantIndex];
  };

  // ==============================
  // AFFICHER LE STOCK
  // ==============================

  const formatStock = (product) => {
    const stock =
      Number(product.stock || 0);

    const stockUnit =
      product.stockUnit || "unité";

    const variant =
      getSelectedVariant(product);

    // ==============================
    // UNITE PRINCIPALE
    // ==============================

    if (!variant) {
      return (
        <>
          <strong>
            {stock.toLocaleString()}
          </strong>{" "}
          {stockUnit}
        </>
      );
    }

    const quantity =
      Number(variant.quantity || 0);

    const variantType =
      variant.type?.trim() || "unité";

    // ==============================
    // VARIANTE INVALIDE
    // ==============================

    if (quantity <= 0) {
      return (
        <>
          <strong>
            {stock.toLocaleString()}
          </strong>{" "}
          {stockUnit}
        </>
      );
    }

    // ==============================
    // CALCUL
    // ==============================

    const completeUnits =
      Math.floor(stock / quantity);

    const remainder =
      stock % quantity;

    // ==============================
    // STOCK EXACT
    // ==============================

    if (remainder === 0) {
      return (
        <>
          <strong>
            {completeUnits.toLocaleString()}
          </strong>{" "}
          {variantType}
        </>
      );
    }

    // ==============================
    // STOCK AVEC RESTE
    // ==============================

    return (
      <>
        <strong>
          {completeUnits.toLocaleString()}
        </strong>{" "}
        {variantType}

        {" + "}

        <strong>
          {remainder.toLocaleString()}
        </strong>{" "}
        {stockUnit}
      </>
    );
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
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ←
        </button>

        <h1>
          Gestion du stock
        </h1>

      </header>

      {/* ==========================
          BOUTON AJUSTEMENT
      =========================== */}

      <button
        className={styles.adjustButton}
        onClick={() =>
          navigate("/stock/adjustment")
        }
      >
        Ajustement
      </button>

      {/* ==========================
          RESUME
      =========================== */}

      <section className={styles.summary}>

        <div className={styles.summaryCard}>

          <div>
            <strong>
              {totalProducts}
            </strong>

            <p>
              Produits
            </p>
          </div>

        </div>

        <div className={styles.summaryCard}>

          <div>
            <strong>
              {normalStockProducts}
            </strong>

            <p>
              Normal
            </p>
          </div>

        </div>

        <div className={styles.summaryCard}>

          <div>
            <strong>
              {lowStockProducts}
            </strong>

            <p>
              Stock faible
            </p>
          </div>

        </div>

        <div className={styles.summaryCard}>

          <div>
            <strong>
              {outOfStockProducts}
            </strong>

            <p>
              Rupture
            </p>
          </div>

        </div>

      </section>

      {/* ==========================
          RECHERCHE ET FILTRE
      =========================== */}

      <div className={styles.filtersRow}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterContainer}>
          <label htmlFor="stock-category-filter">Catégorie</label>
          <select
            id="stock-category-filter"
            className={styles.categoryFilter}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

            {/* ==========================
          TITRE
      =========================== */}

      <div className={styles.titleSection}>

        <div>

          <h2>
            État du stock
          </h2>

          <p>
            Consultez et ajustez les quantités disponibles.
          </p>

        </div>

        <span>

          {filteredProducts.length} produit
          {filteredProducts.length > 1
            ? "s"
            : ""}

        </span>

      </div>

      {/* ==========================
          CHARGEMENT
      =========================== */}

      {loading ? (

        <div className={styles.empty}>

          <span>
            ⏳
          </span>

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

              <p>
                {search || selectedCategory !== "all"
                  ? "Aucun produit ne correspond aux filtres sélectionnés"
                  : "Aucun produit enregistré"}
              </p>

            </div>

          ) : (

            <table
              className={styles.stockTable}
            >

              <thead>

                <tr>

                  <th>
                    Produit
                  </th>

                  <th>
                    Catégorie
                  </th>

                  <th>
                    Stock
                  </th>

                  <th>
                    Seuil
                  </th>

                  <th>
                    État
                  </th>

                  <th>
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {paginatedProducts.map(
                  (product) => {

                    const status =
                      getStockStatus(
                        product
                      );

                    const variants =
                      Array.isArray(
                        product.variants
                      )
                        ? product.variants
                        : [];

                    return (

                      <tr
                        key={product.id}
                      >

                        {/* ======================
                            PRODUIT
                        ======================= */}

                        <td>

                          <div
                            className={
                              styles.productCell
                            }
                          >

                            <div
                              className={
                                styles.productIcon
                              }
                            >

                              {product.image ? (

                                <img
                                  src={
                                    product.image
                                  }
                                  alt={
                                    product.productName
                                  }
                                />

                              ) : (

                                <span>
                                
                                </span>

                              )}

                            </div>

                            <div>

                              <strong>
                                {
                                  product.productName
                                }
                              </strong>

                              <small>
                                {
                                  product.stockUnit ||
                                  "unité"
                                }
                              </small>

                            </div>

                          </div>

                        </td>

                        {/* ======================
                            CATEGORIE
                        ======================= */}

                        <td>

                          {
                            product.categoryName ||
                            product.category ||
                            "—"
                          }

                        </td>

                        {/* ======================
                            STOCK
                        ======================= */}

                        <td>

                          <div
                            className={
                              styles.stockVariantContainer
                            }
                          >

                            {/* SELECT */}

                            <select
                              className={
                                styles.stockVariantSelect
                              }
                              value={
                                selectedVariants[
                                  product.id
                                ] ?? ""
                              }
                              onChange={(e) =>
                                handleVariantChange(
                                  product.id,
                                  e.target.value
                                )
                              }
                            >

                              <option value="">
                                {
                                  product.stockUnit ||
                                  "Unité principale"
                                }
                              </option>

                              {variants.map(
                                (
                                  variant,
                                  index
                                ) => {

                                  const quantity =
                                    Number(
                                      variant.quantity ||
                                      0
                                    );

                                  const type =
                                    variant.type?.trim();

                                  // Ne pas afficher
                                  // les variantes invalides

                                  if (
                                    !type ||
                                    quantity <= 0
                                  ) {
                                    return null;
                                  }

                                  return (

                                    <option
                                      key={index}
                                      value={index}
                                    >

                                      {type} (
                                      {quantity}{" "}
                                      {
                                        product.stockUnit ||
                                        "unité"
                                      }
                                      )

                                    </option>

                                  );

                                }
                              )}

                            </select>

                            {/* ======================
                                STOCK CALCULE
                            ======================= */}

                            <div
                              className={
                                styles.stockDisplay
                              }
                            >

                              {formatStock(
                                product
                              )}

                            </div>

                          </div>

                        </td>

                        {/* ======================
                            SEUIL
                        ======================= */}

                        <td>

                          <strong>
                            {Number(
                              product.alertStock ||
                              0
                            ).toLocaleString()}
                          </strong>{" "}

                          {
                            product.stockUnit ||
                            ""
                          }

                        </td>

                        {/* ======================
                            ETAT
                        ======================= */}

                        <td>

                          <span
                            className={
                              status.className
                            }
                          >
                            {status.label}
                          </span>

                        </td>

                        {/* ======================
                            ACTION
                        ======================= */}

                        <td>

                          <button
                            className={
                              styles.adjustButtonTable
                            }
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

                  }
                )}

              </tbody>

            </table>

          )}

        </div>

      )}

      {!loading && filteredProducts.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Affichage de {((currentPage - 1) * PRODUCTS_PER_PAGE) + 1}
            {" à "}
            {Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)}
            {" sur "}{filteredProducts.length} produit(s)
          </span>

          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              aria-label="Page précédente"
            >
              ← Précédent
            </button>

            <span className={styles.pageNumber}>
              Page {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              aria-label="Page suivante"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Stock;

