
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { db, storage } from "../../firebase";

import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import "./AddProduct.css";

function AddProduct() {

  // ==============================
  // NAVIGATION
  // ==============================

  const navigate = useNavigate();

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
  // CHAMPS PRODUIT
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

  const [variants, setVariants] = useState([
    {
      type: "",
      quantity: "",
      price: ""
    }
  ]);

  // ==============================
  // CHARGER LES CATEGORIES
  // ==============================

  useEffect(() => {

    const loadCategories = async () => {

      setLoadingCategories(true);

      try {

        const querySnapshot = await getDocs(
          collection(db, "categories")
        );

        const categoriesList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
          .sort((a, b) =>
            (a.name || "").localeCompare(
              b.name || "",
              "fr",
              {
                sensitivity: "base"
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

  }, []);

  // ==============================
  // SELECTIONNER UNE CATEGORIE
  // ==============================

  const handleCategoryChange = (e) => {

    const selectedId = e.target.value;

    setCategoryId(selectedId);

    const selectedCategory = categories.find(
      (category) => category.id === selectedId
    );

    if (selectedCategory) {

      setCategoryName(
        selectedCategory.name
      );

    } else {

      setCategoryName("");

    }

  };

  // ==============================
  // AFFICHER FORMULAIRE CATEGORIE
  // ==============================

  const openNewCategory = () => {

    setNewCategoryName("");

    setShowNewCategory(true);

  };

  // ==============================
  // ANNULER CREATION CATEGORIE
  // ==============================

  const cancelNewCategory = () => {

    setNewCategoryName("");

    setShowNewCategory(false);

  };

  // ==============================
  // CREER UNE CATEGORIE
  // ==============================

  const createCategory = async () => {

    const trimmedName =
      newCategoryName.trim();

    if (!trimmedName) {

      alert(
        "Veuillez entrer le nom de la catégorie."
      );

      return;

    }

    try {

      setCreatingCategory(true);

      // ==============================
      // VERIFIER SI ELLE EXISTE DEJA
      // ==============================

      const existingCategory =
        categories.find(
          (category) =>
            (category.name || "")
              .trim()
              .toLowerCase() ===
            trimmedName.toLowerCase()
        );

      if (existingCategory) {

        setCategoryId(
          existingCategory.id
        );

        setCategoryName(
          existingCategory.name
        );

        setShowNewCategory(false);
        setNewCategoryName("");

        alert(
          "Cette catégorie existe déjà. Elle a été sélectionnée."
        );

        return;

      }

      // ==============================
      // ENREGISTRER FIRESTORE
      // ==============================

      const categoryRef = await addDoc(
        collection(db, "categories"),
        {
          name: trimmedName,
          createdAt: serverTimestamp()
        }
      );

      const newCategory = {
        id: categoryRef.id,
        name: trimmedName
      };

      // ==============================
      // AJOUT LOCAL
      // ==============================

      setCategories((previousCategories) =>
        [...previousCategories, newCategory].sort(
          (a, b) =>
            (a.name || "").localeCompare(
              b.name || "",
              "fr",
              {
                sensitivity: "base"
              }
            )
        )
      );

      // ==============================
      // SELECTIONNER AUTOMATIQUEMENT
      // ==============================

      setCategoryId(
        categoryRef.id
      );

      setCategoryName(
        trimmedName
      );

      setShowNewCategory(false);

      setNewCategoryName("");

      alert(
        "Catégorie créée avec succès !"
      );

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
  // AJOUTER UNE VARIANTE
  // ==============================

  const addVariantField = () => {

    setVariants([
      ...variants,
      {
        type: "",
        quantity: "",
        price: ""
      }
    ]);

  };

  // ==============================
  // MODIFIER UNE VARIANTE
  // ==============================

  const handleVariantChange = (
    index,
    field,
    value
  ) => {

    const updatedVariants = [
      ...variants
    ];

    updatedVariants[index] = {
      ...updatedVariants[index],
      [field]: value
    };

    setVariants(updatedVariants);

  };

  // ==============================
  // CHOISIR UNE IMAGE
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

    // ==============================
    // VERIFICATION CHAMPS
    // ==============================

    if (
      !productName.trim() ||
      !categoryId ||
      !categoryName.trim() ||
      !stock ||
      !stockUnit.trim() ||
      purchasePrice === ""
    ) {

      alert(
        "Veuillez remplir tous les champs importants !"
      );

      return;

    }

    // ==============================
    // VERIFICATION PRIX ACHAT
    // ==============================

    if (Number(purchasePrice) < 0) {

      alert(
        "Le prix d'achat ne peut pas être négatif."
      );

      return;

    }

    // ==============================
    // VERIFICATION STOCK
    // ==============================

    if (Number(stock) < 0) {

      alert(
        "Le stock ne peut pas être négatif."
      );

      return;

    }

    // ==============================
    // VERIFICATION ALERTE
    // ==============================

    if (
      alertStock !== "" &&
      Number(alertStock) < 0
    ) {

      alert(
        "L'alerte stock ne peut pas être négative."
      );

      return;

    }

    try {

      let finalImage =
        imageUrl.trim();

      // ==============================
      // UPLOAD IMAGE FIREBASE STORAGE
      // ==============================

      if (imageFile) {

        const imageRef = ref(
          storage,
          `products/${Date.now()}-${imageFile.name}`
        );

        await uploadBytes(
          imageRef,
          imageFile
        );

        finalImage =
          await getDownloadURL(
            imageRef
          );

      }

      // ==============================
      // PREPARER LES VARIANTES
      // ==============================

      const formattedVariants =
        variants
          .filter(
            (variant) =>
              variant.type.trim() !== "" ||
              variant.quantity !== "" ||
              variant.price !== ""
          )
          .map((variant) => ({
            type: variant.type.trim(),

            quantity:
              variant.quantity === ""
                ? 0
                : Number(variant.quantity),

            price:
              variant.price === ""
                ? 0
                : Number(variant.price)
          }));

      // ==============================
      // NOUVEAU PRODUIT
      // ==============================

      const newProduct = {

        productName:
          productName.trim(),

        // ============================
        // CATEGORIE
        // ============================

        categoryId:
          categoryId,

        categoryName:
          categoryName.trim(),

        // Compatibilité avec
        // les anciens composants

        category:
          categoryName.trim(),

        // ============================
        // PRIX D'ACHAT
        // ============================

        purchasePrice:
          Number(purchasePrice),

        // ============================
        // STOCK
        // ============================

        stock:
          Number(stock),

        stockUnit:
          stockUnit.trim(),

        alertStock:
          alertStock === ""
            ? 0
            : Number(alertStock),

        // ============================
        // IMAGE
        // ============================

        image:
          finalImage,

        // ============================
        // VARIANTES
        // ============================

        variants:
          formattedVariants,

        // ============================
        // DATE
        // ============================

        createdAt:
          serverTimestamp()

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
      // RESET FORMULAIRE
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

      setVariants([
        {
          type: "",
          quantity: "",
          price: ""
        }
      ]);

      // ==============================
      // REINITIALISER INPUT FILE
      // ==============================

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

  const previewImage =
    imageFile
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

            {/* ==========================
                IMAGE URL
            =========================== */}

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

            {/* ==========================
                IMAGE FICHIER
            =========================== */}

            <div className="form-group">

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="product-input file-input"
              />

            </div>

            {/* ==========================
                PREVIEW
            =========================== */}

            {previewImage && (

              <img
                src={previewImage}
                alt="Aperçu du produit"
                className="preview-image"
              />

            )}

            {/* ==========================
                NOM PRODUIT
            =========================== */}

            <div className="form-group">

              <label className="form-label">
                Nom du produit
              </label>

              <input
                type="text"
                placeholder="Ex : Coca-Cola"
                value={productName}
                onChange={(e) =>
                  setProductName(
                    e.target.value
                  )
                }
                className="product-input"
              />

            </div>

            {/* ==========================
                CATEGORIE
            =========================== */}

            <div className="form-group category-group">

              <label className="form-label">
                Catégorie
              </label>

              <div className="category-select-row">

                <select
                  value={categoryId}
                  onChange={handleCategoryChange}
                  className="product-input category-select"
                  disabled={loadingCategories}
                >

                  <option value="">
                    {loadingCategories
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
                >
                  + Créer
                </button>

              </div>

              {/* ==========================
                  CREATION CATEGORIE
              =========================== */}

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

              {/* ==========================
                  CATEGORIE SELECTIONNEE
              =========================== */}

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

            {/* ==========================
                PRIX ACHAT
            =========================== */}

            <div className="form-group">

              <label className="form-label">
                Prix d'achat
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex : 1200"
                value={purchasePrice}
                onChange={(e) =>
                  setPurchasePrice(
                    e.target.value
                  )
                }
                className="product-input"
              />

            </div>

            {/* ==========================
                STOCK
            =========================== */}

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
                  setStock(
                    e.target.value
                  )
                }
                className="product-input"
              />

            </div>

            {/* ==========================
                UNITE
            =========================== */}

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

            {/* ==========================
                ALERTE STOCK
            =========================== */}

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
                Ajoutez des formats ou conditionnements
                différents pour ce produit.
              </p>

            </div>

            {variants.map(
              (variant, index) => (

                <div
                  key={index}
                  className="variant-card"
                >

                  {/* TYPE */}

                  <div className="form-group">

                    <label className="form-label">
                      Type de variante
                    </label>

                    <input
                      type="text"
                      placeholder="Ex : Pack, Carton..."
                      value={variant.type}
                      onChange={(e) =>
                        handleVariantChange(
                          index,
                          "type",
                          e.target.value
                        )
                      }
                      className="product-input"
                    />

                  </div>

                  {/* QUANTITE */}

                  <div className="form-group">

                    <label className="form-label">
                      Quantité
                    </label>

                    <input
                      type="number"
                      min="0"
                      placeholder={`Quantité (${stockUnit || "unité"})`}
                      value={variant.quantity}
                      onChange={(e) =>
                        handleVariantChange(
                          index,
                          "quantity",
                          e.target.value
                        )
                      }
                      className="product-input"
                    />

                  </div>

                  {/* PRIX */}

                  <div className="form-group">

                    <label className="form-label">
                      Prix de vente
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Prix"
                      value={variant.price}
                      onChange={(e) =>
                        handleVariantChange(
                          index,
                          "price",
                          e.target.value
                        )
                      }
                      className="product-input"
                    />

                  </div>

                </div>

              )
            )}

            {/* ==========================
                AJOUT VARIANTE
            =========================== */}

            <div className="button-row">

              <button
                type="button"
                onClick={addVariantField}
                className="variant-button"
              >
                + Ajouter une variante
              </button>

            </div>

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

