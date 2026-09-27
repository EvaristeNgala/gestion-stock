import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  doc,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./productDetails.module.css";

function ProductDetails() {
  const navigate = useNavigate();
  const { productId } = useParams();

  // ==========================================
  // PRODUIT
  // ==========================================

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // ==========================================
  // SESSION MAGASIN
  // ==========================================

  const savedSession = localStorage.getItem("storeSession");

  const session = savedSession
    ? JSON.parse(savedSession)
    : null;

  const storeId = session?.storeId || "";

  // ==========================================
  // CHARGER LE PRODUIT
  // ==========================================

  useEffect(() => {
    if (!productId || !storeId) {
      setLoading(false);
      setErrorMessage(
        "Impossible de récupérer les informations du produit."
      );
      return;
    }

    const productRef = doc(
      db,
      "products",
      productId
    );

    const unsubscribe = onSnapshot(
      productRef,

      (productSnapshot) => {
        if (!productSnapshot.exists()) {
          setProduct(null);
          setErrorMessage(
            "Ce produit n'existe pas ou a été supprimé."
          );
          setLoading(false);
          return;
        }

        const productData = {
          id: productSnapshot.id,
          ...productSnapshot.data(),
        };

        // ======================================
        // SÉCURITÉ MULTI-MAGASIN
        // ======================================

        if (productData.storeId !== storeId) {
          setProduct(null);
          setErrorMessage(
            "Vous n'avez pas accès à ce produit."
          );
          setLoading(false);
          return;
        }

        setProduct(productData);
        setErrorMessage("");
        setLoading(false);
      },

      (error) => {
        console.error(
          "Erreur chargement produit :",
          error
        );

        setProduct(null);

        setErrorMessage(
          "Impossible de charger les informations du produit."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [productId, storeId]);

  // ==========================================
  // FORMAT PRIX
  // ==========================================

  const formatPrice = (price) => {
    const value = Number(price || 0);

    if (Number.isNaN(value)) {
      return "0 FC";
    }

    return `${value.toLocaleString("fr-FR")} FC`;
  };

  // ==========================================
  // MODIFIER PRODUIT
  // ==========================================

  const editProduct = () => {
    if (!product) {
      return;
    }

    navigate(`/products/${product.id}/edit`);
  };

  // ==========================================
  // CHARGEMENT
  // ==========================================

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.loadingIcon}>
            📦
          </div>

          <h2>Chargement du produit</h2>

          <p>
            Récupération des informations...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ERREUR
  // ==========================================

  if (!product) {
    return (
      <div className={styles.page}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>
            📦
          </div>

          <h2>Produit indisponible</h2>

          <p>
            {errorMessage ||
              "Impossible de trouver ce produit."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/products")}
          >
            Retour aux produits
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // DONNÉES
  // ==========================================

  const isActive = product.isActive !== false;

  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];

  const validVariants = variants.filter(
    (variant) => variant && variant.type
  );

  const stock = Number(product.stock || 0);

  const alertStock = Number(
    product.alertStock || 0
  );

  const isLowStock =
    alertStock > 0 &&
    stock <= alertStock;

  // ==========================================
  // AFFICHAGE
  // ==========================================

  return (
    <div className={styles.page}>

      {/* ======================================
          HEADER
      ====================================== */}

      <header className={styles.header}>

        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate("/products")}
        >
          ←
        </button>

        <div className={styles.headerTitle}>
          <h1>Détail du produit</h1>

          <p>
            Informations complètes du produit
          </p>
        </div>

        <button
          type="button"
          className={styles.editTopButton}
          onClick={editProduct}
        >
          Modifier
        </button>

      </header>

      {/* ======================================
          CONTENU
      ====================================== */}

      <main className={styles.content}>

        {/* ====================================
            PRODUIT
        ==================================== */}

        <section className={styles.productCard}>

          <div className={styles.productMain}>

            {/* IMAGE */}

            <div className={styles.imageContainer}>

              {product.image ? (
                <img
                  src={product.image}
                  alt={
                    product.productName ||
                    "Produit"
                  }
                  className={styles.productImage}
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";

                    if (
                      event.currentTarget.nextSibling
                    ) {
                      event.currentTarget.nextSibling.style.display =
                        "flex";
                    }
                  }}
                />
              ) : null}

              <div
                className={styles.imageFallback}
                style={{
                  display: product.image
                    ? "none"
                    : "flex",
                }}
              >
                📦
              </div>

            </div>

            {/* INFORMATIONS PRINCIPALES */}

            <div className={styles.productHeading}>

              <div className={styles.badges}>

                <span
                  className={
                    isActive
                      ? styles.activeBadge
                      : styles.inactiveBadge
                  }
                >
                  {isActive
                    ? "● Actif"
                    : "● Inactif"}
                </span>

                {isLowStock && (
                  <span
                    className={
                      styles.lowStockBadge
                    }
                  >
                    Stock faible
                  </span>
                )}

              </div>

              <h2>
                {product.productName ||
                  "Sans nom"}
              </h2>

              <p>
                {product.categoryName ||
                  product.category ||
                  "Sans catégorie"}
              </p>

            </div>

          </div>

        </section>

        {/* ====================================
            INFORMATIONS
        ==================================== */}

        <section className={styles.infoCard}>

          <div className={styles.sectionHeader}>
            <div>
              <h2>
                Informations du produit
              </h2>

              <p>
                Prix, stock et configuration
              </p>
            </div>
          </div>

          <div className={styles.infoGrid}>

            {/* PRIX ACHAT */}

            <div className={styles.infoItem}>
              <span>Prix d'achat</span>

              <strong>
                {formatPrice(
                  product.purchasePrice
                )}
              </strong>
            </div>

            {/* STOCK */}

            <div className={styles.infoItem}>
              <span>Stock actuel</span>

              <strong
                className={
                  isLowStock
                    ? styles.stockDanger
                    : ""
                }
              >
                {product.stock ?? 0}{" "}
                {product.stockUnit || ""}
              </strong>
            </div>

            {/* UNITÉ */}

            <div className={styles.infoItem}>
              <span>Unité de stock</span>

              <strong>
                {product.stockUnit || "—"}
              </strong>
            </div>

            {/* ALERTE */}

            <div className={styles.infoItem}>
              <span>Seuil d'alerte</span>

              <strong>
                {product.alertStock ?? 0}{" "}
                {product.stockUnit || ""}
              </strong>
            </div>

            {/* CATÉGORIE */}

            <div className={styles.infoItem}>
              <span>Catégorie</span>

              <strong>
                {product.categoryName ||
                  product.category ||
                  "Sans catégorie"}
              </strong>
            </div>

            {/* VARIANTES */}

            <div className={styles.infoItem}>
              <span>Variantes</span>

              <strong>
                {validVariants.length > 0
                  ? `${validVariants.length} configurée${
                      validVariants.length > 1
                        ? "s"
                        : ""
                    }`
                  : "Aucune variante"}
              </strong>
            </div>

          </div>

        </section>

        {/* ====================================
            VARIANTES
        ==================================== */}

        <section className={styles.variantsCard}>

          <div className={styles.sectionHeader}>

            <div>
              <h2>
                Variantes et prix de vente
              </h2>

              <p>
                Conversion des unités du produit
              </p>
            </div>

            <span className={styles.variantCount}>
              {validVariants.length}
            </span>

          </div>

          {validVariants.length === 0 ? (

            <div className={styles.noVariants}>
              <div>📦</div>

              <strong>
                Aucune variante
              </strong>

              <p>
                Ce produit ne possède actuellement
                aucune variante configurée.
              </p>
            </div>

          ) : (

            <div className={styles.variantTableWrapper}>

              <table
                className={styles.variantTable}
              >

                <thead>
                  <tr>
                    <th>Variante</th>
                    <th>Conversion</th>
                    <th>Prix de vente</th>
                  </tr>
                </thead>

                <tbody>

                  {validVariants.map(
                    (variant, index) => (

                      <tr key={index}>

                        <td>
                          <strong>
                            {variant.type}
                          </strong>
                        </td>

                        <td>
                          <span>
                            {variant.quantity || 1}
                            {" "}
                            {product.stockUnit || ""}
                          </span>
                        </td>

                        <td>
                          <strong
                            className={
                              styles.variantPrice
                            }
                          >
                            {formatPrice(
                              variant.price
                            )}
                          </strong>
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>

        {/* ====================================
            ACTIONS
        ==================================== */}

        <section className={styles.actions}>

          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => navigate("/products")}
          >
            Retour
          </button>

          <button
            type="button"
            className={styles.editButton}
            onClick={editProduct}
          >
             Modifier le produit
          </button>

        </section>

      </main>

    </div>
  );
}

export default ProductDetails;