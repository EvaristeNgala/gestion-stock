import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./ajustement.module.css";

function Ajustement() {
  const navigate = useNavigate();

  // ==============================
  // PRODUITS
  // ==============================

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ==============================
  // RECHERCHE PRODUIT
  // ==============================

  const [productSearch, setProductSearch] = useState("");
  const [showProductResults, setShowProductResults] = useState(false);

  // ==============================
  // AJUSTEMENTS
  // ==============================

  const [adjustments, setAdjustments] = useState([]);

  // ==============================
  // FORMULAIRE
  // ==============================

  const [selectedProductId, setSelectedProductId] = useState("");

  const [adjustmentType, setAdjustmentType] = useState("add");

  const [quantity, setQuantity] = useState("");

  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);

  // ==============================
  // CHARGER LES PRODUITS
  // ==============================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        productsList.sort((a, b) =>
          (a.productName || a.name || "").localeCompare(
            b.productName || b.name || "",
            "fr",
            {
              sensitivity: "base",
            }
          )
        );

        setProducts(productsList);
        setLoadingProducts(false);
      },
      (error) => {
        console.error(
          "Erreur lors du chargement des produits :",
          error
        );

        setLoadingProducts(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ==============================
  // PRODUITS RECHERCHES
  // ==============================

  const filteredProducts = products.filter((product) => {
    const productName = (
      product.productName ||
      product.name ||
      ""
    ).toLowerCase();

    const categoryName = (
      product.categoryName ||
      product.category ||
      ""
    ).toLowerCase();

    const search = productSearch
      .trim()
      .toLowerCase();

    if (!search) {
      return false;
    }

    return (
      productName.includes(search) ||
      categoryName.includes(search)
    );
  });

  // ==============================
  // PRODUIT SELECTIONNE
  // ==============================

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  // ==============================
  // CALCUL NOUVEAU STOCK
  // ==============================

  const calculateNewStock = (
    product,
    type,
    qty
  ) => {
    const currentStock = Number(
      product?.stock || 0
    );

    const quantityNumber = Number(qty || 0);

    if (type === "add") {
      return currentStock + quantityNumber;
    }

    if (type === "remove") {
      return currentStock - quantityNumber;
    }

    if (type === "correct") {
      return quantityNumber;
    }

    return currentStock;
  };

  // ==============================
  // SELECTIONNER PRODUIT
  // ==============================

  const selectProduct = (product) => {
    setSelectedProductId(product.id);

    setProductSearch(
      product.productName ||
        product.name ||
        ""
    );

    setShowProductResults(false);

    setQuantity("");
  };

  // ==============================
  // AJOUTER AJUSTEMENT
  // ==============================

  const addAdjustment = () => {
    if (!selectedProductId) {
      alert("Veuillez sélectionner un produit.");
      return;
    }

    if (
      quantity === "" ||
      Number(quantity) < 0
    ) {
      alert("Veuillez entrer une quantité valide.");
      return;
    }

    if (!reason.trim()) {
      alert(
        "Veuillez indiquer le motif de l'ajustement."
      );
      return;
    }

    if (!selectedProduct) {
      alert("Produit introuvable.");
      return;
    }

    const quantityNumber = Number(quantity);

    const newStock = calculateNewStock(
      selectedProduct,
      adjustmentType,
      quantityNumber
    );

    // ==============================
    // STOCK NEGATIF
    // ==============================

    if (newStock < 0) {
      alert(
        "Le stock ne peut pas devenir négatif."
      );
      return;
    }

    // ==============================
    // VERIFIER SI PRODUIT DEJA PRESENT
    // ==============================

    const alreadyExists = adjustments.some(
      (adjustment) =>
        adjustment.productId ===
        selectedProduct.id
    );

    if (alreadyExists) {
      alert(
        "Ce produit est déjà présent dans les ajustements."
      );
      return;
    }

    // ==============================
    // NOUVEL AJUSTEMENT
    // ==============================

    const newAdjustment = {
      id: Date.now(),

      productId: selectedProduct.id,

      productName:
        selectedProduct.productName ||
        selectedProduct.name ||
        "",

      stockUnit:
        selectedProduct.stockUnit ||
        "unité",

      currentStock: Number(
        selectedProduct.stock || 0
      ),

      type: adjustmentType,

      quantity: quantityNumber,

      newStock: newStock,

      reason: reason.trim(),
    };

    setAdjustments((previous) => [
      ...previous,
      newAdjustment,
    ]);

    // ==============================
    // RESET
    // ==============================

    setSelectedProductId("");

    setProductSearch("");

    setAdjustmentType("add");

    setQuantity("");

    setReason("");

    setShowProductResults(false);
  };

  // ==============================
  // MODIFIER QUANTITE
  // ==============================

  const updateAdjustmentQuantity = (
    id,
    value
  ) => {
    if (value === "") {
      setAdjustments((previous) =>
        previous.map((adjustment) =>
          adjustment.id === id
            ? {
                ...adjustment,
                quantity: "",
              }
            : adjustment
        )
      );

      return;
    }

    const quantityNumber = Number(value);

    if (quantityNumber < 0) {
      return;
    }

    setAdjustments((previous) =>
      previous.map((adjustment) => {
        if (adjustment.id !== id) {
          return adjustment;
        }

        const newStock = calculateNewStock(
          {
            stock:
              adjustment.currentStock,
          },
          adjustment.type,
          quantityNumber
        );

        return {
          ...adjustment,
          quantity: quantityNumber,
          newStock: newStock,
        };
      })
    );
  };

  // ==============================
  // SUPPRIMER
  // ==============================

  const removeAdjustment = (id) => {
    setAdjustments((previous) =>
      previous.filter(
        (adjustment) =>
          adjustment.id !== id
      )
    );
  };

  // ==============================
  // ENREGISTRER DANS FIREBASE
  // ==============================

  const saveAdjustments = async () => {
    if (adjustments.length === 0) {
      alert(
        "Aucun ajustement à enregistrer."
      );
      return;
    }

    const invalidAdjustment =
      adjustments.some(
        (adjustment) =>
          adjustment.quantity === "" ||
          Number(adjustment.quantity) < 0 ||
          Number(adjustment.newStock) < 0
      );

    if (invalidAdjustment) {
      alert(
        "Veuillez vérifier les quantités des ajustements."
      );
      return;
    }

    try {
      setSaving(true);

      const batch = writeBatch(db);

      const historyCollection = collection(
        db,
        "stockAdjustments"
      );

      // ==============================
      // TRAITER LES AJUSTEMENTS
      // ==============================

      for (const adjustment of adjustments) {
        const productRef = doc(
          db,
          "products",
          adjustment.productId
        );

        // Mise à jour du produit
        batch.update(productRef, {
          stock: Number(
            adjustment.newStock
          ),
          updatedAt: serverTimestamp(),
        });

        // Historique
        const historyRef = doc(
          historyCollection
        );

        batch.set(historyRef, {
          productId:
            adjustment.productId,

          productName:
            adjustment.productName,

          type:
            adjustment.type,

          quantity:
            Number(adjustment.quantity),

          stockBefore:
            Number(
              adjustment.currentStock
            ),

          stockAfter:
            Number(
              adjustment.newStock
            ),

          reason:
            adjustment.reason,

          stockUnit:
            adjustment.stockUnit,

          createdAt:
            serverTimestamp(),
        });
      }

      // ==============================
      // SESSION D'AJUSTEMENT
      // ==============================

      const adjustmentSummaryRef =
        doc(
          collection(
            db,
            "stockAdjustmentSessions"
          )
        );

      batch.set(
        adjustmentSummaryRef,
        {
          numberOfAdjustments:
            adjustments.length,

          createdAt:
            serverTimestamp(),
        }
      );

      // ==============================
      // ENREGISTREMENT
      // ==============================

      await batch.commit();

      alert(
        "Les ajustements ont été enregistrés avec succès !"
      );

      setAdjustments([]);

    } catch (error) {
      console.error(
        "Erreur lors de l'enregistrement :",
        error
      );

      alert(
        "Une erreur est survenue lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==============================
  // LABEL TYPE
  // ==============================

  const getTypeLabel = (type) => {
    if (type === "add") {
      return "Ajouter";
    }

    if (type === "remove") {
      return "Retirer";
    }

    return "Corriger";
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
            navigate("/stock")
          }
        >
          ←
        </button>

        <div>
          <h1>
            Ajustement du stock
          </h1>

          <p>
            Ajoutez, retirez ou corrigez
            plusieurs produits.
          </p>
        </div>

      </header>

      {/* ==========================
          FORMULAIRE
      =========================== */}

      <section className={styles.formCard}>

        <div className={styles.sectionTitle}>

          <h2>
            Nouvel ajustement
          </h2>

          <span>
            {adjustments.length} ajustement
            {adjustments.length > 1
              ? "s"
              : ""}
          </span>

        </div>

        {/* ==========================
            RECHERCHE PRODUIT
        =========================== */}

        <div className={styles.formGroup}>

          <label>
            Rechercher un produit
          </label>

          <div className={styles.searchBox}>

            <span className={styles.searchIcon}>
              🔍
            </span>

            <input
              type="text"
              placeholder={
                loadingProducts
                  ? "Chargement des produits..."
                  : "Tapez le nom du produit..."
              }
              value={productSearch}
              disabled={loadingProducts}
              onChange={(e) => {
                setProductSearch(
                  e.target.value
                );

                setSelectedProductId("");

                setShowProductResults(
                  true
                );
              }}
              onFocus={() => {
                if (productSearch.trim()) {
                  setShowProductResults(
                    true
                  );
                }
              }}
            />

            {productSearch && (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => {
                  setProductSearch("");
                  setSelectedProductId("");
                  setShowProductResults(false);
                }}
              >
                ×
              </button>
            )}

          </div>

          {/* ==========================
              RESULTATS RECHERCHE
          =========================== */}

          {showProductResults &&
            productSearch.trim() && (
              <div
                className={
                  styles.productResults
                }
              >

                {filteredProducts.length ===
                0 ? (

                  <div
                    className={
                      styles.noResults
                    }
                  >
                    Aucun produit trouvé
                  </div>

                ) : (

                  filteredProducts
                    .slice(0, 10)
                    .map((product) => (

                      <button
                        type="button"
                        key={product.id}
                        className={
                          styles.productResult
                        }
                        onClick={() =>
                          selectProduct(
                            product
                          )
                        }
                      >

                        

                        <div
                          className={
                            styles.resultInfo
                          }
                        >

                          <strong>
                            {product.productName ||
                              product.name ||
                              "Produit sans nom"}
                          </strong>

                          <small>
                            Stock :{" "}
                            {Number(
                              product.stock || 0
                            ).toLocaleString()}{" "}
                            {product.stockUnit ||
                              "unité"}
                          </small>

                        </div>

                      </button>

                    ))

                )}

              </div>
            )}

        </div>

        {/* ==========================
            PRODUIT SELECTIONNE
        =========================== */}

        {selectedProduct && (

          <div
            className={
              styles.selectedProduct
            }
          >

            <div>
              <span>
                Produit sélectionné
              </span>

              <strong>
                {selectedProduct.productName ||
                  selectedProduct.name}
              </strong>
            </div>

            <div>
              <span>
                Stock actuel
              </span>

              <strong>
                {Number(
                  selectedProduct.stock || 0
                ).toLocaleString()}{" "}
                {selectedProduct.stockUnit ||
                  "unité"}
              </strong>
            </div>

          </div>

        )}

        {/* ==========================
            TYPE
        =========================== */}

        <div className={styles.formGroup}>

          <label>
            Type d'ajustement
          </label>

          <div
            className={
              styles.typeButtons
            }
          >

            <button
              type="button"
              className={
                adjustmentType === "add"
                  ? styles.typeActive
                  : styles.typeButton
              }
              onClick={() =>
                setAdjustmentType("add")
              }
            >
              + Ajouter
            </button>

            <button
              type="button"
              className={
                adjustmentType ===
                "remove"
                  ? styles.typeActive
                  : styles.typeButton
              }
              onClick={() =>
                setAdjustmentType(
                  "remove"
                )
              }
            >
              − Retirer
            </button>

            <button
              type="button"
              className={
                adjustmentType ===
                "correct"
                  ? styles.typeActive
                  : styles.typeButton
              }
              onClick={() =>
                setAdjustmentType(
                  "correct"
                )
              }
            >
              ✎ Corriger
            </button>

          </div>

        </div>

        {/* ==========================
            QUANTITE
        =========================== */}

        <div className={styles.formGroup}>

          <label>
            {adjustmentType ===
            "correct"
              ? "Nouveau stock"
              : "Quantité"}
          </label>

          <input
            type="number"
            min="0"
            placeholder={
              adjustmentType ===
              "correct"
                ? "Ex : 50"
                : "Ex : 10"
            }
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value
              )
            }
          />

        </div>

        {/* ==========================
            MOTIF
        =========================== */}

        <div className={styles.formGroup}>

          <label>
            Motif
          </label>

          <textarea
            placeholder="Ex : Réception de marchandises, produit endommagé, inventaire..."
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
            rows="3"
          />

        </div>

        {/* ==========================
            AJOUTER
        =========================== */}

        <button
          type="button"
          className={
            styles.addAdjustmentButton
          }
          onClick={addAdjustment}
        >
          + Ajouter cet ajustement
        </button>

      </section>

      {/* ==========================
          TABLEAU AJUSTEMENTS
      =========================== */}

      {adjustments.length > 0 && (

        <section
          className={styles.recapCard}
        >

          <div
            className={
              styles.sectionTitle
            }
          >

            <div>
              <h2>
                Produits à ajuster
              </h2>

              <p>
                Modifiez les quantités avant
                l'enregistrement final.
              </p>
            </div>

            <span>
              {adjustments.length}
            </span>

          </div>

          {/* ==========================
              TABLEAU
          =========================== */}

          <div
            className={
              styles.tableContainer
            }
          >

            <table
              className={
                styles.adjustmentTable
              }
            >

              <thead>
                <tr>
                  <th>
                    Produit
                  </th>

                  <th>
                    Quantité
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>

                {adjustments.map(
                  (adjustment) => (

                    <tr
                      key={
                        adjustment.id
                      }
                    >

                      {/* PRODUIT */}

                      <td>
                        <div
                          className={
                            styles.productCell
                          }
                        >

                          

                          <div>
                            <strong>
                              {
                                adjustment.productName
                              }
                            </strong>

                            <small>
                              {
                                adjustment.stockUnit
                              }
                            </small>
                          </div>

                        </div>
                      </td>

                      {/* QUANTITE */}

                      <td>

                        <div
                          className={
                            styles.quantityCell
                          }
                        >

                          <input
                            type="number"
                            min="0"
                            value={
                              adjustment.quantity
                            }
                            onChange={(e) =>
                              updateAdjustmentQuantity(
                                adjustment.id,
                                e.target.value
                              )
                            }
                          />

                          

                        </div>

                      </td>

                      {/* SUPPRIMER */}

                      <td>

                        <button
                          type="button"
                          className={
                            styles.deleteButton
                          }
                          onClick={() =>
                            removeAdjustment(
                              adjustment.id
                            )
                          }
                          title="Supprimer"
                        >
                          🗑️
                        </button>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

          {/* ==========================
              RESUME
          =========================== */}

          <div
            className={
              styles.adjustmentSummary
            }
          >

            {adjustments.map(
              (adjustment) => (
                <div
                  key={adjustment.id}
                  className={
                    styles.summaryLine
                  }
                >

                  <span>
                    {adjustment.productName}
                  </span>

                  <strong>
                    {getTypeLabel(
                      adjustment.type
                    )}{" "}
                    {adjustment.quantity}{" "}
                    {adjustment.stockUnit}
                    {" → "}
                    {adjustment.newStock}{" "}
                    {adjustment.stockUnit}
                  </strong>

                </div>
              )
            )}

          </div>

          {/* ==========================
              ENREGISTRER
          =========================== */}

          <button
            type="button"
            className={
              styles.saveButton
            }
            onClick={
              saveAdjustments
            }
            disabled={saving}
          >
            {saving
              ? "Enregistrement..."
              : "✓ Enregistrer les ajustements"}
          </button>

        </section>

      )}

    </div>
  );
}

export default Ajustement;