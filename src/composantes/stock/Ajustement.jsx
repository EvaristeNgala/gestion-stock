import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./ajustement.module.css";

function Ajustement() {
  const navigate = useNavigate();

  // ==========================================
  // SESSION / MAGASIN
  // ==========================================

  const savedSession = localStorage.getItem("storeSession");
  const session = savedSession
    ? JSON.parse(savedSession)
    : null;

  const storeId = session?.storeId || "";

  // ==========================================
  // PRODUITS
  // ==========================================

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ==========================================
  // RECHERCHE
  // ==========================================

  const [productSearch, setProductSearch] = useState("");
  const [showProductResults, setShowProductResults] =
    useState(false);

  // ==========================================
  // PRODUIT SELECTIONNE
  // ==========================================

  const [selectedProductId, setSelectedProductId] =
    useState("");

  // ==========================================
  // VARIANTE SELECTIONNEE
  // ==========================================

  const [selectedVariantIndex, setSelectedVariantIndex] =
    useState("");

  // ==========================================
  // FORMULAIRE
  // ==========================================

  const [adjustmentType, setAdjustmentType] =
    useState("add");

  const [quantity, setQuantity] = useState("");

  const [reason, setReason] = useState("");

  // ==========================================
  // LISTE DES AJUSTEMENTS
  // ==========================================

  const [adjustments, setAdjustments] = useState([]);

  // ==========================================
  // ENREGISTREMENT
  // ==========================================

  const [saving, setSaving] = useState(false);

  // ==========================================
  // CHARGEMENT DES PRODUITS
  // ==========================================

  useEffect(() => {
    // Aucun magasin connecté
    if (!storeId) {
      console.warn(
        "Aucun magasin connecté pour charger les produits."
      );

      setProducts([]);
      setLoadingProducts(false);

      return;
    }

    const productsQuery = query(
      collection(db, "products"),
      where("storeId", "==", storeId)
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

        productsList.sort((a, b) =>
          getProductName(a).localeCompare(
            getProductName(b),
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
          "Erreur chargement produits :",
          error
        );

        setProducts([]);
        setLoadingProducts(false);
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  // ==========================================
  // NOM PRODUIT
  // ==========================================

  function getProductName(product) {
    return (
      product?.productName ||
      product?.name ||
      "Produit sans nom"
    );
  }

  // ==========================================
  // UNITE DE BASE
  // ==========================================

  function getBaseUnit(product) {
    return (
      product?.stockUnit ||
      product?.unit ||
      "unité"
    );
  }

  // ==========================================
  // VARIANTES
  //
  // quantity = coefficient de conversion
  //
  // Exemple :
  // Bouteille : quantity = 1
  // Paquet    : quantity = 12
  // Carton    : quantity = 24
  // ==========================================

  function getVariants(product) {
    if (!product) {
      return [];
    }

    if (
      Array.isArray(product.variants) &&
      product.variants.length > 0
    ) {
      return product.variants;
    }

    // Compatibilité anciens produits
    return [
      {
        type: getBaseUnit(product),
        quantity: 1,
        price:
          product.price ||
          product.salePrice ||
          0,
      },
    ];
  }

  // ==========================================
  // NOM VARIANTE
  // ==========================================

  function getVariantName(variant) {
    return (
      variant?.type ||
      variant?.name ||
      variant?.unit ||
      "Unité"
    );
  }

  // ==========================================
  // COEFFICIENT DE CONVERSION
  // ==========================================

  function getConversionQuantity(variant) {
    const conversion = Number(
      variant?.quantity
    );

    if (
      !Number.isFinite(conversion) ||
      conversion <= 0
    ) {
      return 1;
    }

    return conversion;
  }

  // ==========================================
  // STOCK REEL
  // ==========================================

  function getProductStock(product) {
    return Number(product?.stock || 0);
  }

  // ==========================================
  // RECHERCHE
  // ==========================================

  const filteredProducts = products.filter(
    (product) => {
      const search = productSearch
        .trim()
        .toLowerCase();

      if (!search) {
        return false;
      }

      const productName =
        getProductName(product).toLowerCase();

      const categoryName = (
        product.categoryName ||
        product.category ||
        ""
      ).toLowerCase();

      return (
        productName.includes(search) ||
        categoryName.includes(search)
      );
    }
  );

  // ==========================================
  // PRODUIT SELECTIONNE
  // ==========================================

  const selectedProduct = products.find(
    (product) =>
      product.id === selectedProductId
  );

  // ==========================================
  // VARIANTES DU PRODUIT
  // ==========================================

  const selectedProductVariants =
    getVariants(selectedProduct);

  // ==========================================
  // VARIANTE SELECTIONNEE
  // ==========================================

  const selectedVariant =
    selectedVariantIndex !== "" &&
    selectedProductVariants[
      Number(selectedVariantIndex)
    ]
      ? selectedProductVariants[
          Number(selectedVariantIndex)
        ]
      : null;

  // ==========================================
  // EQUIVALENT EN UNITE DE BASE
  // ==========================================

  const calculateBaseQuantity = (
    quantityValue,
    variant
  ) => {
    const quantityNumber = Number(
      quantityValue
    );

    const conversion =
      getConversionQuantity(variant);

    if (
      !Number.isFinite(quantityNumber) ||
      quantityNumber < 0
    ) {
      return 0;
    }

    return quantityNumber * conversion;
  };

  // ==========================================
  // NOUVEAU STOCK
  // ==========================================

  const calculateNewStock = (
    currentStock,
    type,
    quantityBase
  ) => {
    const stock = Number(
      currentStock || 0
    );

    const quantityInBase = Number(
      quantityBase || 0
    );

    if (type === "add") {
      return stock + quantityInBase;
    }

    if (type === "remove") {
      return stock - quantityInBase;
    }

    if (type === "correct") {
      return quantityInBase;
    }

    return stock;
  };

  // ==========================================
  // SELECTION PRODUIT
  // ==========================================

  const selectProduct = (product) => {
    setSelectedProductId(product.id);

    setProductSearch(
      getProductName(product)
    );

    setSelectedVariantIndex("");

    setQuantity("");

    setShowProductResults(false);
  };

  // ==========================================
  // CHANGEMENT VARIANTE
  // ==========================================

  const handleVariantChange = (event) => {
    setSelectedVariantIndex(
      event.target.value
    );

    setQuantity("");
  };

  // ==========================================
  // AJOUTER UN AJUSTEMENT
  // ==========================================

  const addAdjustment = () => {
    if (!storeId) {
      alert(
        "Aucun magasin connecté."
      );

      return;
    }

    if (!selectedProduct) {
      alert(
        "Veuillez sélectionner un produit."
      );

      return;
    }

    // Vérification supplémentaire du magasin
    if (selectedProduct.storeId !== storeId) {
      alert(
        "Ce produit n'appartient pas au magasin connecté."
      );

      return;
    }

    if (
      selectedVariantIndex === "" ||
      !selectedVariant
    ) {
      alert(
        "Veuillez sélectionner une variante."
      );

      return;
    }

    if (
      quantity === "" ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) < 0
    ) {
      alert(
        "Veuillez entrer une quantité valide."
      );

      return;
    }

    if (!reason.trim()) {
      alert(
        "Veuillez indiquer le motif de l'ajustement."
      );

      return;
    }

    const quantityNumber = Number(quantity);

    const conversion =
      getConversionQuantity(
        selectedVariant
      );

    // ========================================
    // CONVERSION
    // ========================================

    const quantityBase =
      calculateBaseQuantity(
        quantityNumber,
        selectedVariant
      );

    // ========================================
    // STOCK ACTUEL REEL
    // ========================================

    const currentStock =
      getProductStock(selectedProduct);

    // ========================================
    // NOUVEAU STOCK REEL
    // ========================================

    const newStock = calculateNewStock(
      currentStock,
      adjustmentType,
      quantityBase
    );

    // ========================================
    // STOCK NEGATIF
    // ========================================

    if (newStock < 0) {
      alert(
        `Stock insuffisant.\n\nStock actuel : ${currentStock} ${getBaseUnit(
          selectedProduct
        )}\nQuantité demandée : ${quantityBase} ${getBaseUnit(
          selectedProduct
        )}`
      );

      return;
    }

    // ========================================
    // EVITER DOUBLON
    // ========================================

    const alreadyExists =
      adjustments.some(
        (adjustment) =>
          adjustment.productId ===
            selectedProduct.id &&
          adjustment.variantIndex ===
            Number(selectedVariantIndex)
      );

    if (alreadyExists) {
      alert(
        "Cette variante est déjà présente dans la liste."
      );

      return;
    }

    // ========================================
    // AJUSTEMENT
    // ========================================

    const newAdjustment = {
      id: Date.now(),

      productId:
        selectedProduct.id,

      productName:
        getProductName(selectedProduct),

      categoryName:
        selectedProduct.categoryName ||
        selectedProduct.category ||
        "",

      baseUnit:
        getBaseUnit(selectedProduct),

      variantIndex:
        Number(selectedVariantIndex),

      variantName:
        getVariantName(selectedVariant),

      conversion,

      quantity:
        quantityNumber,

      quantityBase,

      type:
        adjustmentType,

      currentStock,

      newStock,

      reason:
        reason.trim(),
    };

    setAdjustments((previous) => [
      ...previous,
      newAdjustment,
    ]);

    // ========================================
    // RESET
    // ========================================

    setSelectedProductId("");

    setSelectedVariantIndex("");

    setProductSearch("");

    setAdjustmentType("add");

    setQuantity("");

    setReason("");

    setShowProductResults(false);
  };

  // ==========================================
  // MODIFICATION QUANTITE DANS LE TABLEAU
  // ==========================================

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
                quantityBase: 0,
                newStock: 0,
              }
            : adjustment
        )
      );

      return;
    }

    const quantityNumber =
      Number(value);

    if (
      !Number.isFinite(quantityNumber) ||
      quantityNumber < 0
    ) {
      return;
    }

    setAdjustments((previous) =>
      previous.map((adjustment) => {
        if (
          adjustment.id !== id
        ) {
          return adjustment;
        }

        // ======================================
        // RECONVERSION
        // ======================================

        const quantityBase =
          quantityNumber *
          adjustment.conversion;

        const newStock =
          calculateNewStock(
            adjustment.currentStock,
            adjustment.type,
            quantityBase
          );

        return {
          ...adjustment,

          quantity:
            quantityNumber,

          quantityBase,

          newStock,
        };
      })
    );
  };

  // ==========================================
  // SUPPRIMER AJUSTEMENT
  // ==========================================

  const removeAdjustment = (id) => {
    setAdjustments((previous) =>
      previous.filter(
        (adjustment) =>
          adjustment.id !== id
      )
    );
  };

  // ==========================================
  // LABEL TYPE
  // ==========================================

  const getTypeLabel = (type) => {
    if (type === "add") {
      return "Ajouter";
    }

    if (type === "remove") {
      return "Retirer";
    }

    return "Corriger";
  };

  // ==========================================
  // ENREGISTRER LES AJUSTEMENTS
  // ==========================================

  const saveAdjustments = async () => {
    if (!storeId) {
      alert(
        "Aucun magasin connecté."
      );

      return;
    }

    if (adjustments.length === 0) {
      alert(
        "Aucun ajustement à enregistrer."
      );

      return;
    }

    // ========================================
    // VERIFICATION
    // ========================================

    for (const adjustment of adjustments) {
      if (
        adjustment.quantity === "" ||
        !Number.isFinite(
          Number(adjustment.quantity)
        )
      ) {
        alert(
          `Quantité invalide pour ${adjustment.productName}.`
        );

        return;
      }

      if (
        Number(adjustment.quantityBase) <
        0
      ) {
        alert(
          `Quantité invalide pour ${adjustment.productName}.`
        );

        return;
      }

      if (
        Number(adjustment.newStock) <
        0
      ) {
        alert(
          `Le stock de ${adjustment.productName} ne peut pas être négatif.`
        );

        return;
      }
    }

    try {
      setSaving(true);

      const batch = writeBatch(db);

      // ========================================
      // HISTORIQUE
      // ========================================

      const historyCollection =
        collection(
          db,
          "stockAdjustments"
        );

      // ========================================
      // TRAITER CHAQUE AJUSTEMENT
      // ========================================

      for (const adjustment of adjustments) {
        const productRef = doc(
          db,
          "products",
          adjustment.productId
        );

        // ======================================
        // RECUPERER PRODUIT ACTUEL
        // ======================================

        const product = products.find(
          (item) =>
            item.id ===
            adjustment.productId
        );

        if (!product) {
          throw new Error(
            `Produit introuvable : ${adjustment.productName}`
          );
        }

        // ======================================
        // VERIFICATION MAGASIN
        // ======================================

        if (product.storeId !== storeId) {
          throw new Error(
            `Le produit ${adjustment.productName} n'appartient pas au magasin connecté.`
          );
        }

        // ======================================
        // IMPORTANT :
        //
        // LE STOCK RESTE DANS product.stock
        //
        // PAS DANS variants
        // ======================================

        const currentFirestoreStock =
          getProductStock(product);

        // ======================================
        // RECALCUL SECURISE
        // ======================================

        const newStock =
          calculateNewStock(
            currentFirestoreStock,
            adjustment.type,
            Number(
              adjustment.quantityBase
            )
          );

        if (newStock < 0) {
          throw new Error(
            `Stock insuffisant pour ${adjustment.productName}.`
          );
        }

        // ======================================
        // MISE A JOUR DU PRODUIT
        // ======================================

        batch.update(
          productRef,
          {
            stock: Number(newStock),

            updatedAt:
              serverTimestamp(),
          }
        );

        // ======================================
        // HISTORIQUE
        // ======================================

        const historyRef = doc(
          historyCollection
        );

        batch.set(
          historyRef,
          {
            // IMPORTANT :
            // L'historique appartient au magasin
            storeId,

            productId:
              adjustment.productId,

            productName:
              adjustment.productName,

            categoryName:
              adjustment.categoryName,

            variantName:
              adjustment.variantName,

            conversion:
              Number(
                adjustment.conversion
              ),

            quantity:
              Number(
                adjustment.quantity
              ),

            quantityBase:
              Number(
                adjustment.quantityBase
              ),

            baseUnit:
              adjustment.baseUnit,

            type:
              adjustment.type,

            stockBefore:
              Number(
                currentFirestoreStock
              ),

            stockAfter:
              Number(newStock),

            reason:
              adjustment.reason,

            createdAt:
              serverTimestamp(),
          }
        );
      }

      // ========================================
      // ENREGISTRER LA SESSION
      // ========================================

      const sessionRef = doc(
        collection(
          db,
          "stockAdjustmentSessions"
        )
      );

      batch.set(
        sessionRef,
        {
          // IMPORTANT :
          // La session appartient au magasin
          storeId,

          numberOfAdjustments:
            adjustments.length,

          createdAt:
            serverTimestamp(),
        }
      );

      // ========================================
      // COMMIT FIRESTORE
      // ========================================

      await batch.commit();

      alert(
        "Les ajustements ont été enregistrés avec succès !"
      );

      setAdjustments([]);
    } catch (error) {
      console.error(
        "Erreur enregistrement ajustements :",
        error
      );

      alert(
        error.message ||
          "Une erreur est survenue lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // AFFICHAGE
  // ==========================================

  return (
    <div className={styles.container}>

      {/* ======================================
          HEADER
      ======================================= */}

      <header className={styles.header}>

        <button
          type="button"
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
            Ajustez le stock en bouteille,
            paquet, lot, carton, etc.
          </p>
        </div>

      </header>

      {/* ======================================
          FORMULAIRE
      ======================================= */}

      <section
        className={styles.formCard}
      >

        <div
          className={styles.sectionTitle}
        >
          <div>
            <h2>
              Nouvel ajustement
            </h2>

            <p>
              La variante sert uniquement
              à convertir la quantité en unité
              de base.
            </p>
          </div>

          <span>
            {adjustments.length} ajustement
            {adjustments.length > 1
              ? "s"
              : ""}
          </span>
        </div>

        {/* ====================================
            RECHERCHE
        ===================================== */}

        <div
          className={styles.formGroup}
        >

          <label>
            Rechercher un produit
          </label>

          <div
            className={styles.searchBox}
          >

            <input
              type="text"
              placeholder={
                loadingProducts
                  ? "Chargement..."
                  : "Tapez le nom du produit..."
              }
              value={productSearch}
              disabled={loadingProducts}
              onChange={(e) => {
                setProductSearch(
                  e.target.value
                );

                setSelectedProductId("");

                setSelectedVariantIndex("");

                setShowProductResults(
                  true
                );
              }}
              onFocus={() => {
                if (
                  productSearch.trim()
                ) {
                  setShowProductResults(
                    true
                  );
                }
              }}
            />

            {productSearch && (
              <button
                type="button"
                className={
                  styles.clearSearch
                }
                onClick={() => {
                  setProductSearch("");

                  setSelectedProductId("");

                  setSelectedVariantIndex("");

                  setShowProductResults(
                    false
                  );
                }}
              >
                ×
              </button>
            )}

          </div>

          {/* ==================================
              RESULTATS
          =================================== */}

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
                            {getProductName(
                              product
                            )}
                          </strong>

                          <small>
                            Stock :{" "}
                            {getProductStock(
                              product
                            ).toLocaleString()}{" "}
                            {
                              getBaseUnit(
                                product
                              )
                            }
                          </small>

                        </div>

                      </button>

                    ))

                )}

              </div>
            )}

        </div>

        {/* ======================================
            PRODUIT SELECTIONNE
        ======================================= */}

        {selectedProduct && (

          <div
            className={
              styles.selectedProduct
            }
          >

            <div>
              <span>
                Produit
              </span>

              <strong>
                {getProductName(
                  selectedProduct
                )}
              </strong>
            </div>

            <div>
              <span>
                Stock réel
              </span>

              <strong>
                {getProductStock(
                  selectedProduct
                ).toLocaleString()}{" "}
                {
                  getBaseUnit(
                    selectedProduct
                  )
                }
              </strong>
            </div>

          </div>

        )}

        {/* ======================================
            VARIANTE
        ======================================= */}

        {selectedProduct && (

          <div
            className={styles.formGroup}
          >

            <label>
              Unité / variante de vente
            </label>

            <select
              className={
                styles.variantSelect
              }
              value={
                selectedVariantIndex
              }
              onChange={
                handleVariantChange
              }
            >

              <option value="">
                Sélectionner une variante
              </option>

              {selectedProductVariants.map(
                (variant, index) => {

                  const conversion =
                    getConversionQuantity(
                      variant
                    );

                  const variantName =
                    getVariantName(
                      variant
                    );

                  return (
                    <option
                      key={index}
                      value={index}
                    >
                      {variantName} — 1{" "}
                      {variantName} ={" "}
                      {conversion}{" "}
                      {
                        getBaseUnit(
                          selectedProduct
                        )
                      }
                    </option>
                  );
                }
              )}

            </select>

          </div>

        )}

        {/* ======================================
            INFORMATIONS CONVERSION
        ======================================= */}

        {selectedVariant && (

          <div
            className={
              styles.selectedVariant
            }
          >

            <div>
              <span>
                Variante choisie
              </span>

              <strong>
                {getVariantName(
                  selectedVariant
                )}
              </strong>
            </div>

            <div>
              <span>
                Conversion
              </span>

              <strong>
                1{" "}
                {getVariantName(
                  selectedVariant
                )}{" "}
                ={" "}
                {getConversionQuantity(
                  selectedVariant
                )}{" "}
                {
                  getBaseUnit(
                    selectedProduct
                  )
                }
              </strong>
            </div>

          </div>

        )}

        {/* ======================================
            TYPE
        ======================================= */}

        <div
          className={styles.formGroup}
        >

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
                setAdjustmentType(
                  "add"
                )
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

        {/* ======================================
            QUANTITE
        ======================================= */}

        <div
          className={styles.formGroup}
        >

          <label>
            {adjustmentType ===
            "correct"
              ? "Nouvelle quantité"
              : "Quantité à ajuster"}
          </label>

          <input
            type="number"
            min="0"
            step="1"
            placeholder={
              adjustmentType ===
              "correct"
                ? "Ex : 10"
                : "Ex : 2"
            }
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value
              )
            }
          />

          {/* CONVERSION EN DIRECT */}

          {selectedVariant &&
            quantity !== "" && (
              <div
                className={
                  styles.conversionPreview
                }
              >
                <span>
                  Conversion :
                </span>

                <strong>
                  {quantity}{" "}
                  {getVariantName(
                    selectedVariant
                  )}{" "}
                  ×{" "}
                  {getConversionQuantity(
                    selectedVariant
                  )}{" "}
                  ={" "}
                  {calculateBaseQuantity(
                    quantity,
                    selectedVariant
                  )}{" "}
                  {
                    getBaseUnit(
                      selectedProduct
                    )
                  }
                </strong>
              </div>
            )}

        </div>

        {/* ======================================
            MOTIF
        ======================================= */}

        <div
          className={styles.formGroup}
        >

          <label>
            Motif
          </label>

          <textarea
            placeholder="Ex : Réception de marchandises, inventaire, produit endommagé..."
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
            rows="3"
          />

        </div>

        {/* ======================================
            AJOUTER
        ======================================= */}

        <button
          type="button"
          className={
            styles.addAdjustmentButton
          }
          onClick={
            addAdjustment
          }
          disabled={
            !selectedProduct ||
            !selectedVariant
          }
        >
          + Ajouter cet ajustement
        </button>

      </section>

      {/* ========================================
          TABLEAU
      ========================================= */}

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
                Les quantités seront converties
                en unité de base lors de
                l'enregistrement.
              </p>
            </div>

            <span>
              {adjustments.length}
            </span>

          </div>

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
                    Variante
                  </th>

                  <th>
                    Quantité
                  </th>

                  <th>
                    Équivalent
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

                          <div
                            className={
                              styles.productIcon
                            }
                          >
                            📦
                          </div>

                          <strong>
                            {
                              adjustment.productName
                            }
                          </strong>

                        </div>

                      </td>

                      {/* VARIANTE */}

                      <td>

                        <div
                          className={
                            styles.variantCell
                          }
                        >

                          <strong>
                            {
                              adjustment.variantName
                            }
                          </strong>

                          <small>
                            1 ={" "}
                            {
                              adjustment.conversion
                            }{" "}
                            {
                              adjustment.baseUnit
                            }
                          </small>

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
                            step="1"
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

                          <span>
                            {
                              adjustment.variantName
                            }
                          </span>

                        </div>

                      </td>

                      {/* EQUIVALENT */}

                      <td>

                        <div
                          className={
                            styles.equivalentCell
                          }
                        >

                          <strong>
                            {
                              adjustment.quantityBase
                            }
                          </strong>

                          <span>
                            {
                              adjustment.baseUnit
                            }
                          </span>

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

          {/* ====================================
              RESUME
          ===================================== */}

          <div
            className={
              styles.adjustmentSummary
            }
          >

            {adjustments.map(
              (adjustment) => (

                <div
                  key={
                    adjustment.id
                  }
                  className={
                    styles.summaryLine
                  }
                >

                  <span>
                    {adjustment.productName}{" "}
                    —{" "}
                    {
                      adjustment.variantName
                    }
                  </span>

                  <strong>
                    {getTypeLabel(
                      adjustment.type
                    )}{" "}
                    {
                      adjustment.quantity
                    }{" "}
                    {
                      adjustment.variantName
                    }{" "}
                    →{" "}
                    {
                      adjustment.type ===
                      "correct"
                        ? "Stock"
                        : ""
                    }{" "}
                    {
                      adjustment.quantityBase
                    }{" "}
                    {
                      adjustment.baseUnit
                    }
                  </strong>

                </div>

              )
            )}

          </div>

          {/* ====================================
              ENREGISTRER
          ===================================== */}

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

