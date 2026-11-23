
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./produit.module.css";

function Produit() {
  const navigate = useNavigate();

  // ==============================
  // RECHERCHE
  // ==============================

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ==============================
  // PRODUITS
  // ==============================

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==============================
  // RÉCUPÉRER LA SESSION
  // ==============================

  const savedSession = localStorage.getItem("storeSession");

  const session = savedSession
    ? JSON.parse(savedSession)
    : null;

  const storeId = session?.storeId || "";

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = session?.role === "admin";

  // ==============================
  // CHARGER LES PRODUITS DU MAGASIN
  // ==============================

  useEffect(() => {
    if (!storeId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const productsRef = collection(db, "products");

    const productsQuery = query(
      productsRef,
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const productsList = snapshot.docs.map(
          (productDoc) => ({
            id: productDoc.id,
            ...productDoc.data(),
          })
        );

        setProducts(productsList);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Erreur lors du chargement des produits :",
          error
        );

        setLoading(false);

        alert(
          "Impossible de charger les produits."
        );
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  // ==============================
  // RECHERCHE
  // ==============================

  // Liste unique des catégories disponibles
  const categories = [
    ...new Set(
      products
        .map((product) =>
          (product.categoryName || product.category || "").trim()
        )
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  // Recherche + filtre par catégorie
  const filteredProducts = products.filter((product) => {
    const searchValue = search.toLowerCase().trim();
    const productName = (product.productName || "").toLowerCase();
    const categoryName = (
      product.categoryName || product.category || ""
    ).toLowerCase();

    const matchesSearch =
      !searchValue ||
      productName.includes(searchValue) ||
      categoryName.includes(searchValue);

    const productCategory =
      (product.categoryName || product.category || "").trim();

    const matchesCategory =
      selectedCategory === "all" ||
      productCategory === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Pagination : 10 produits par page
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  );

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Revenir à la première page quand un filtre change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  // Corriger la page si un produit est supprimé
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ==============================
  // ACTIVER / DESACTIVER PRODUIT
  // ==============================

  const toggleProductStatus = async (
    product
  ) => {
    // Sécurité côté interface
    if (!isAdmin) {
      alert(
        "Seul l'administrateur peut modifier l'état d'un produit."
      );
      return;
    }

    const currentStatus =
      product.isActive !== false;

    const newStatus = !currentStatus;

    const actionText = newStatus
      ? "activer"
      : "désactiver";

    const confirmed = window.confirm(
      `Voulez-vous vraiment ${actionText} le produit "${product.productName}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await updateDoc(
        doc(db, "products", product.id),
        {
          isActive: newStatus,
        }
      );

      alert(
        newStatus
          ? "Produit activé avec succès."
          : "Produit désactivé avec succès."
      );
    } catch (error) {
      console.error(
        "Erreur lors de la modification de l'état du produit :",
        error
      );

      alert(
        "Impossible de modifier l'état du produit."
      );
    }
  };

  // ==============================
  // SUPPRIMER PRODUIT
  // ==============================

  const deleteProduct = async (
    id,
    productName
  ) => {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer le produit "${productName}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "products", id)
      );

      alert(
        "Produit supprimé avec succès."
      );
    } catch (error) {
      console.error(
        "Erreur lors de la suppression du produit :",
        error
      );

      alert(
        "Impossible de supprimer le produit."
      );
    }
  };

  // ==============================
  // MODIFIER PRODUIT
  // ==============================

  const editProduct = (product) => {
    navigate("/Addproducts", {
      state: {
        product,
        editMode: true,
      },
    });
  };

  // ==============================
  // FORMAT PRIX
  // ==============================

  const formatPrice = (price) => {
    const numberPrice = Number(price);

    if (Number.isNaN(numberPrice)) {
      return "0 FC";
    }

    return `${numberPrice.toLocaleString(
      "fr-FR"
    )} FC`;
  };

  // ==============================
  // VÉRIFIER STOCK FAIBLE
  // ==============================

  const isLowStock = (product) => {
    const stock = Number(
      product.stock || 0
    );

    const alertStock = Number(
      product.alertStock || 0
    );

    return (
      alertStock > 0 &&
      stock <= alertStock
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
          Produits
        </h1>

        <button
          onClick={() =>
            navigate("/Addproducts")
          }
          className={styles.addButton}
        >
          +
        </button>

      </header>

            {/* RECHERCHE + FILTRE PAR CATÉGORIE */}
      <div className={styles.filtersRow}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterBar}>
          <select
            className={styles.categorySelect}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filtrer par catégorie"
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

      {/* ==========================
          TITRE
      =========================== */}

      

      {/* ==========================
          CHARGEMENT
      =========================== */}

      {loading ? (

        <div
          className={styles.loading}
        >

          <span>
            ⏳
          </span>

          <p>
            Chargement des produits...
          </p>

        </div>

      ) : filteredProducts.length === 0 ? (

        /* ==========================
           AUCUN PRODUIT
        =========================== */

        <div
          className={styles.empty}
        >

          <h3>

            {search
              ? "Aucun produit trouvé"
              : "Aucun produit"}

          </h3>

          <p>

            {search
              ? "Aucun produit ne correspond à votre recherche."
              : "Vous n'avez encore enregistré aucun produit."}

          </p>

          {!search && (

            <button
              onClick={() =>
                navigate("/Addproducts")
              }
              className={
                styles.emptyButton
              }
            >
              + Ajouter un produit
            </button>

          )}

        </div>

      ) : (

        /* ==========================
           TABLEAU
        =========================== */

        <div
          className={
            styles.tableContainer
          }
        >

          <table
            className={
              styles.productTable
            }
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
                  Prix d'achat
                </th>

                <th>
                  Stock
                </th>

                <th>
                  État
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {paginatedProducts.map(
                (product) => {

                  const lowStock =
                    isLowStock(product);

                  // Les anciens produits qui
                  // n'ont pas encore isActive
                  // sont considérés comme actifs.
                  const isActive =
                    product.isActive !== false;

                  return (

                    <tr
                      key={product.id}
                      className={
                        !isActive
                          ? styles.inactiveRow
                          : ""
                      }
                      onClick={() =>
                                navigate(`/products/${product.id}`)
                              }
                              
                    >

                      {/* ==================
                          PRODUIT
                      =================== */}

                      <td>

                        <div
                          className={
                            styles.productCell
                          }
                        >

                          {product.image ? (

                            <img
                              src={
                                product.image
                              }
                              alt={
                                product.productName ||
                                "Produit"
                              }
                              className={
                                styles.productImage
                              }
                              onError={(e) => {

                                e.currentTarget.style.display =
                                  "none";

                                if (
                                  e.currentTarget
                                    .nextSibling
                                ) {

                                  e.currentTarget
                                    .nextSibling
                                    .style.display =
                                    "flex";

                                }

                              }}
                            />

                          ) : null}

                          <div
                            className={
                              styles.productImageFallback
                            }
                            style={{
                              display:
                                product.image
                                  ? "none"
                                  : "flex",
                            }}
                          >
                            📦
                          </div>

                          <div
                            className={
                              styles.productName
                            }
                          >
                              <div>
                                {product.productName || "Sans nom"}
                              </div>

                          </div>

                        </div>

                      </td>

                      {/* ==================
                          CATÉGORIE
                      =================== */}

                      <td>

                        <span
                          className={
                            styles.categoryBadge
                          }
                        >

                          {product.categoryName ||
                            product.category ||
                            "Sans catégorie"}

                        </span>

                      </td>

                      {/* ==================
                          PRIX ACHAT
                      =================== */}

                      <td>

                        <span
                          className={
                            styles.purchasePrice
                          }
                        >

                          {formatPrice(
                            product.purchasePrice
                          )}

                        </span>

                      </td>

                      {/* ==================
                          STOCK
                      =================== */}

                      <td>

                        <span
                          className={
                            lowStock
                              ? styles.lowStock
                              : styles.stock
                          }
                        >

                          {product.stock ?? 0}{" "}

                          {product.stockUnit ||
                            ""}

                        </span>

                      </td>

                      {/* ==================
                          ÉTAT
                      =================== */}

                      <td>

                        <button
                          type="button"
                          className={
                            isActive
                              ? styles.activeStatus
                              : styles.inactiveStatus
                          }
                          onClick={() =>
                            toggleProductStatus(
                              product
                            )
                          }
                          disabled={!isAdmin}
                          title={
                            isAdmin
                              ? isActive
                                ? "Désactiver le produit"
                                : "Activer le produit"
                              : "Seul l'administrateur peut modifier l'état"
                          }
                        >

                          <span
                            className={
                              styles.statusDot
                            }
                          ></span>

                          {isActive
                            ? "Actif"
                            : "Inactif"}

                        </button>

                      </td>

                      {/* ==================
                          ACTIONS
                      =================== */}

                      <td>

                        <div
                          className={
                            styles.actions
                          }
                        >
                          <button
                            className={
                              styles.deleteButton
                            }
                            onClick={() =>
                              deleteProduct(
                                product.id,
                                product.productName
                              )
                            }
                            title="Supprimer"
                          >
                            supprimer
                          </button>

                        </div>

                      </td>

                    </tr>

                  );
                }
              )}

            </tbody>

          </table>

        </div>

      )}

      {/* PAGINATION */}
      {!loading && filteredProducts.length > 0 && (
        <div className={styles.pagination}>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.max(1, page - 1))
            }
            disabled={currentPage === 1}
            className={styles.pageButton}
          >
            ← Précédent
          </button>

          <span className={styles.pageInfo}>
            Page <strong>{currentPage}</strong> sur{" "}
            <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
            className={styles.pageButton}
          >
            Suivant →
          </button>
        </div>
      )}

    </div>
  );
}

export default Produit;
