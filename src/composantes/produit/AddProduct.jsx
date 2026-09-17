import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { db, storage } from "../../firebase";

import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import "./AddProduct.css";

function AddProduct() {
  const navigate = useNavigate();

  // ==============================
  // SESSION MAGASIN
  // ==============================

  const savedSession = localStorage.getItem("storeSession");
  const session = savedSession ? JSON.parse(savedSession) : null;

  const storeId = session?.storeId || "";

  // ==============================
  // CATEGORIES
  // ==============================

  const [categories, setCategories] = useState([]);

  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  // ==============================
  // PRODUIT
  // ==============================

  const [productName, setProductName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

  const [stock, setStock] = useState("");
  const [stockUnit, setStockUnit] = useState("");
  const [alertStock, setAlertStock] = useState("");

  // ==============================
  // IMAGE
  // ==============================

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);

  // ==============================
  // VARIANTES
  // ==============================

  const [hasVariants, setHasVariants] = useState(false);

  const [variants, setVariants] = useState([]);

  const [variantType, setVariantType] = useState("");
  const [variantQuantity, setVariantQuantity] = useState("");
  const [variantPrice, setVariantPrice] = useState("");

  // ==============================
  // CHARGER LES CATEGORIES
  // ==============================

  useEffect(() => {
    const loadCategories = async () => {
      if (!storeId) {
        setCategories([]);
        setLoadingCategories(false);
        return;
      }

      setLoadingCategories(true);

      try {
        const categoriesQuery = query(
          collection(db, "categories"),
          where("storeId", "==", storeId)
        );

        const snapshot = await getDocs(categoriesQuery);

        const categoriesList = snapshot.docs
          .map((categoryDoc) => ({
            id: categoryDoc.id,
            ...categoryDoc.data(),
          }))
          .sort((a, b) =>
            (a.name || "").localeCompare(
              b.name || "",
              "fr",
              {
                sensitivity: "base",
              }
            )
          );

        setCategories(categoriesList);
      } catch (error) {
        console.error(
          "Erreur lors du chargement des catégories :",
          error
        );

        alert(
          "Impossible de charger les catégories."
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [storeId]);

  // ==============================
  // CHANGEMENT CATEGORIE
  // ==============================

  const handleCategoryChange = (e) => {
    const selectedId = e.target.value;

    setCategoryId(selectedId);

    const selectedCategory = categories.find(
      (category) => category.id === selectedId
    );

    if (selectedCategory) {
      setCategoryName(selectedCategory.name);
    } else {
      setCategoryName("");
    }
  };

  // ==============================
  // OUVRIR CREATION CATEGORIE
  // ==============================

  const openNewCategory = () => {
    setNewCategoryName("");
    setShowNewCategory(true);
  };

  // ==============================
  // ANNULER CATEGORIE
  // ==============================

  const cancelNewCategory = () => {
    setNewCategoryName("");
    setShowNewCategory(false);
  };

  // ==============================
  // CREER CATEGORIE
  // ==============================

  const createCategory = async () => {
    const trimmedName = newCategoryName.trim();

    if (!storeId) {
      alert("Aucun magasin connecté.");
      return;
    }

    if (!trimmedName) {
      alert(
        "Veuillez entrer le nom de la catégorie."
      );
      return;
    }

    try {
      setCreatingCategory(true);

      // Vérifier si elle existe déjà
      const existingCategory = categories.find(
        (category) =>
          (category.name || "")
            .trim()
            .toLowerCase() ===
          trimmedName.toLowerCase()
      );

      if (existingCategory) {
        setCategoryId(existingCategory.id);
        setCategoryName(existingCategory.name);

        setShowNewCategory(false);
        setNewCategoryName("");

        alert(
          "Cette catégorie existe déjà. Elle a été sélectionnée."
        );

        return;
      }

      // Créer la catégorie
      const categoryRef = await addDoc(
        collection(db, "categories"),
        {
          name: trimmedName,
          storeId: storeId,
          createdAt: serverTimestamp(),
        }
      );

      const newCategory = {
        id: categoryRef.id,
        name: trimmedName,
        storeId: storeId,
      };

      setCategories((previousCategories) =>
        [...previousCategories, newCategory].sort(
          (a, b) =>
            (a.name || "").localeCompare(
              b.name || "",
              "fr",
              {
                sensitivity: "base",
              }
            )
        )
      );

      setCategoryId(categoryRef.id);
      setCategoryName(trimmedName);

      setShowNewCategory(false);
      setNewCategoryName("");

      alert("Catégorie créée avec succès !");
    } catch (error) {
      console.error(
        "Erreur lors de la création de la catégorie :",
        error
      );

      alert(
        "Erreur lors de la création de la catégorie."
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  // ==============================
  // VARIANTES ON/OFF
  // ==============================

  const handleVariantsToggle = (e) => {
    const enabled = e.target.checked;

    setHasVariants(enabled);

    if (!enabled) {
      setVariants([]);

      setVariantType("");
      setVariantQuantity("");
      setVariantPrice("");
    }
  };

  // ==============================
  // AJOUTER UNE VARIANTE
  // ==============================

  const addVariant = () => {
    const type = variantType.trim();

    if (!type) {
      alert(
        "Veuillez entrer le type de variante."
      );
      return;
    }

    if (
      variantQuantity === "" ||
      Number(variantQuantity) <= 0
    ) {
      alert(
        "Veuillez entrer une quantité valide."
      );
      return;
    }

    if (
      variantPrice === "" ||
      Number(variantPrice) < 0
    ) {
      alert(
        "Veuillez entrer un prix valide."
      );
      return;
    }

    // Vérifier si le même type existe déjà
    const alreadyExists = variants.some(
      (variant) =>
        variant.type.trim().toLowerCase() ===
        type.toLowerCase()
    );

    if (alreadyExists) {
      alert(
        "Cette variante existe déjà."
      );
      return;
    }

    const newVariant = {
      type: type,
      quantity: Number(variantQuantity),
      price: Number(variantPrice),
    };

    setVariants((previousVariants) => [
      ...previousVariants,
      newVariant,
    ]);

    // Vider les champs après ajout
    setVariantType("");
    setVariantQuantity("");
    setVariantPrice("");
  };

  // ==============================
  // SUPPRIMER VARIANTE
  // ==============================

  const removeVariant = (index) => {
    setVariants((previousVariants) =>
      previousVariants.filter(
        (_, variantIndex) =>
          variantIndex !== index
      )
    );
  };

  // ==============================
  // IMAGE
  // ==============================

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      setImageFile(file);
      setImageUrl("");
    }
  };

  // ==============================
  // ENREGISTRER PRODUIT
  // ==============================

  const addProduct = async () => {
    if (!storeId) {
      alert(
        "Aucun magasin connecté. Veuillez vous reconnecter."
      );
      return;
    }

    // ==============================
    // VERIFICATION
    // ==============================

    if (
      !productName.trim() ||
      !categoryId ||
      !categoryName.trim() ||
      stock === "" ||
      !stockUnit.trim() ||
      purchasePrice === ""
    ) {
      alert(
        "Veuillez remplir tous les champs importants !"
      );
      return;
    }

    if (Number(purchasePrice) < 0) {
      alert(
        "Le prix d'achat ne peut pas être négatif."
      );
      return;
    }

    if (Number(stock) < 0) {
      alert(
        "Le stock ne peut pas être négatif."
      );
      return;
    }

    if (
      alertStock !== "" &&
      Number(alertStock) < 0
    ) {
      alert(
        "L'alerte stock ne peut pas être négative."
      );
      return;
    }

    if (
      hasVariants &&
      variants.length === 0
    ) {
      alert(
        "Vous avez activé les variantes. Veuillez ajouter au moins une variante."
      );
      return;
    }

    try {
      let finalImage = imageUrl.trim();

      // ==============================
      // UPLOAD IMAGE
      // ==============================

      if (imageFile) {
        const imageRef = ref(
          storage,
          `products/${storeId}/${Date.now()}-${imageFile.name}`
        );

        await uploadBytes(
          imageRef,
          imageFile
        );

        finalImage = await getDownloadURL(
          imageRef
        );
      }

      // ==============================
      // PRODUIT
      // ==============================

      const newProduct = {
        // Liaison au magasin
        storeId: storeId,

        // Produit
        productName: productName.trim(),

        // Catégorie
        categoryId: categoryId,
        categoryName: categoryName.trim(),

        // Compatibilité avec anciens composants
        category: categoryName.trim(),

        // Prix achat
        purchasePrice: Number(purchasePrice),

        // Stock
        stock: Number(stock),
        stockUnit: stockUnit.trim(),

        alertStock:
          alertStock === ""
            ? 0
            : Number(alertStock),

        // Image
        image: finalImage,

        // Variantes
        variants: hasVariants
          ? variants
          : [],

        // ==============================
        // STATUT DU PRODUIT
        // ==============================
        // Tous les nouveaux produits
        // sont actifs par défaut.
        isActive: true,

        // Date
        createdAt: serverTimestamp(),
      };

      // ==============================
      // FIRESTORE
      // ==============================

      await addDoc(
        collection(db, "products"),
        newProduct
      );

      alert(
        "Produit enregistré avec succès !"
      );

      // ==============================
      // RESET
      // ==============================

      setProductName("");

      setCategoryId("");
      setCategoryName("");

      setPurchasePrice("");

      setStock("");
      setStockUnit("");
      setAlertStock("");

      setImageUrl("");
      setImageFile(null);

      setHasVariants(false);
      setVariants([]);

      setVariantType("");
      setVariantQuantity("");
      setVariantPrice("");

      // Réinitialiser input fichier
      const fileInput =
        document.querySelector(
          'input[type="file"]'
        );

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error(
        "Erreur lors de l'enregistrement :",
        error
      );

      alert(
        "Erreur lors de l'enregistrement du produit."
      );
    }
  };

  // ==============================
  // PREVIEW IMAGE
  // ==============================

  const previewImage = imageFile
    ? URL.createObjectURL(imageFile)
    : imageUrl;

  // ==============================
  // AFFICHAGE
  // ==============================

  return (
    <div className="add-product-container">
      <div className="add-product-overlay">

        <div className="add-product-wrapper">

          {/* ==========================
              EN-TETE
          =========================== */}

          <div className="page-header">

            <div
              onClick={() => navigate(-1)}
              className="backButton"
            >
              ←
            </div>

            <h1 className="add-product-title">
              Ajouter un produit
            </h1>

          </div>

          {/* ==========================
              FORMULAIRE
          =========================== */}

          <div className="product-form-card">

            {/* IMAGE URL */}

            <div className="form-group">

              <label className="form-label">
                Image du produit
              </label>

              <input
                type="text"
                placeholder="Lien image produit"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageFile(null);
                }}
                className="product-input"
              />

            </div>

            {/* IMAGE FICHIER */}

            <div className="form-group">

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="product-input file-input"
              />

            </div>

            {/* PREVIEW */}

            {previewImage && (
              <img
                src={previewImage}
                alt="Aperçu du produit"
                className="preview-image"
              />
            )}

            {/* NOM */}

            <div className="form-group">

              <label className="form-label">
                Nom du produit
              </label>

              <input
                type="text"
                placeholder="Ex : Coca-Cola"
                value={productName}
                onChange={(e) =>
                  setProductName(e.target.value)
                }
                className="product-input"
              />

            </div>

            {/* CATEGORIE */}

            <div className="form-group category-group">

              <label className="form-label">
                Catégorie
              </label>

              <div className="category-select-row">

                <select
                  value={categoryId}
                  onChange={handleCategoryChange}
                  className="product-input category-select"
                  disabled={
                    loadingCategories ||
                    !storeId
                  }
                >

                  <option value="">
                    {!storeId
                      ? "Aucun magasin connecté"
                      : loadingCategories
                        ? "Chargement des catégories..."
                        : "Choisir une catégorie"}
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    )
                  )}

                </select>

                <button
                  type="button"
                  onClick={openNewCategory}
                  className="create-category-button"
                  disabled={!storeId}
                >
                  + Créer
                </button>

              </div>

              {/* CREATION CATEGORIE */}

              {showNewCategory && (
                <div className="new-category-box">

                  <input
                    type="text"
                    placeholder="Nom de la nouvelle catégorie"
                    value={newCategoryName}
                    onChange={(e) =>
                      setNewCategoryName(
                        e.target.value
                      )
                    }
                    className="product-input"
                    autoFocus
                  />

                  <div className="new-category-actions">

                    <button
                      type="button"
                      onClick={cancelNewCategory}
                      className="cancel-category-button"
                      disabled={creatingCategory}
                    >
                      Annuler
                    </button>

                    <button
                      type="button"
                      onClick={createCategory}
                      className="confirm-category-button"
                      disabled={creatingCategory}
                    >
                      {creatingCategory
                        ? "Création..."
                        : "Créer la catégorie"}
                    </button>

                  </div>

                </div>
              )}

              {categoryName && (
                <div className="selected-category">
                  Catégorie sélectionnée :
                  <strong>
                    {" "}
                    {categoryName}
                  </strong>
                </div>
              )}

            </div>

            {/* PRIX ACHAT */}

            <div className="form-group">

              <label className="form-label">
                Prix d'achat
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex : 800"
                value={purchasePrice}
                onChange={(e) =>
                  setPurchasePrice(
                    e.target.value
                  )
                }
                className="product-input"
              />

            </div>

            {/* STOCK */}

            <div className="form-group">

              <label className="form-label">
                Stock total
              </label>

              <input
                type="number"
                min="0"
                placeholder="Ex : 100"
                value={stock}
                onChange={(e) =>
                  setStock(e.target.value)
                }
                className="product-input"
              />

            </div>

            {/* UNITE */}

            <div className="form-group">

              <label className="form-label">
                Unité principale
              </label>

              <input
                type="text"
                placeholder="Ex : pièce, bouteille, carton..."
                value={stockUnit}
                onChange={(e) =>
                  setStockUnit(
                    e.target.value
                  )
                }
                className="product-input"
              />

            </div>

            {/* ALERTE */}

            <div className="form-group">

              <label className="form-label">
                Alerte stock
              </label>

              <input
                type="number"
                min="0"
                placeholder="Ex : 10"
                value={alertStock}
                onChange={(e) =>
                  setAlertStock(
                    e.target.value
                  )
                }
                className="product-input"
              />

            </div>

            {/* ==========================
                VARIANTES
            =========================== */}

            <div className="variant-header">

              <h3>
                Gestion des variantes
              </h3>

              <p>
                Activez cette option si ce produit
                possède plusieurs formats ou
                conditionnements.
              </p>

            </div>

            {/* CHECKBOX */}

            <div className="variant-toggle">

              <span>
                Ce produit possède des variantes
              </span>

              <label className="variant-switch">

                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={handleVariantsToggle}
                />

                <span className="variant-slider"></span>

              </label>

            </div>

            {/* ==========================
                FORMULAIRE VARIANTE
            =========================== */}

            {hasVariants && (
              <div className="variant-section">

                <div className="variant-card">

                  <div className="variant-field">

                    <label className="form-label">
                      Type de variante
                    </label>

                    <input
                      type="text"
                      placeholder="Ex : Pack"
                      value={variantType}
                      onChange={(e) =>
                        setVariantType(
                          e.target.value
                        )
                      }
                      className="product-input"
                    />

                  </div>

                  <div className="variant-field">

                    <label className="form-label">
                      Quantité
                    </label>

                    <input
                      type="number"
                      min="1"
                      placeholder={
                        stockUnit
                          ? `Ex : 12 ${stockUnit}`
                          : "Ex : 12"
                      }
                      value={variantQuantity}
                      onChange={(e) =>
                        setVariantQuantity(
                          e.target.value
                        )
                      }
                      className="product-input"
                    />

                  </div>

                  <div className="variant-field">

                    <label className="form-label">
                      Prix de vente
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex : 9000"
                      value={variantPrice}
                      onChange={(e) =>
                        setVariantPrice(
                          e.target.value
                        )
                      }
                      className="product-input"
                    />

                  </div>

                  <div className="variant-add-area">

                    <button
                      type="button"
                      onClick={addVariant}
                      className="variant-button"
                    >
                      + Ajouter
                    </button>

                  </div>

                </div>

                {/* ==========================
                    VARIANTES AJOUTEES
                =========================== */}

                {variants.length > 0 && (
                  <div className="saved-variants">

                    <div className="saved-variants-title">
                      Variantes ajoutées
                    </div>

                    <div className="saved-variants-list">

                      {variants.map(
                        (variant, index) => (
                          <div
                            key={index}
                            className="saved-variant-item"
                          >

                            <div className="variant-info">

                              <div className="variant-name">
                                {variant.type}
                              </div>

                              <div className="variant-quantity">
                                {variant.quantity}{" "}
                                {stockUnit || "unité"}
                              </div>

                              <div className="variant-price">
                                {variant.price.toLocaleString(
                                  "fr-FR"
                                )}{" "}
                                FC
                              </div>

                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeVariant(index)
                              }
                              className="remove-variant-button"
                            >
                              Supprimer
                            </button>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* ==========================
                ENREGISTRER
            =========================== */}

            <div className="button-row save-row">

              <button
                type="button"
                onClick={addProduct}
                className="save-button"
              >
                Enregistrer le produit
              </button>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default AddProduct;
