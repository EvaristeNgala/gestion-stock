import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, storage } from "../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "./AddProduct.css";

function AddProduct() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEditMode = Boolean(productId);

  const [loadingProduct, setLoadingProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [existingProduct, setExistingProduct] = useState(null);

  const savedSession = localStorage.getItem("storeSession");
  const session = savedSession ? JSON.parse(savedSession) : null;
  const storeId = session?.storeId || "";

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [productName, setProductName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stock, setStock] = useState("");
  const [stockUnit, setStockUnit] = useState("");
  const [alertStock, setAlertStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [automaticPurchase, setAutomaticPurchase] = useState(false);
  const [totalPurchaseAmount, setTotalPurchaseAmount] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [unitsPerPurchaseUnit, setUnitsPerPurchaseUnit] = useState("1");
  const [addPurchaseToStock, setAddPurchaseToStock] = useState(true);

  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState([]);
  const [variantType, setVariantType] = useState("");
  const [variantQuantity, setVariantQuantity] = useState("");
  const [variantPrice, setVariantPrice] = useState("");

  const calculatedBaseQuantity = useMemo(() => {
    if (!automaticPurchase) return 0;
    const quantity = Number(purchaseQuantity);
    const conversion = Number(unitsPerPurchaseUnit);
    if (quantity <= 0 || conversion <= 0) return 0;
    return quantity * conversion;
  }, [automaticPurchase, purchaseQuantity, unitsPerPurchaseUnit]);

  const calculatedUnitPurchasePrice = useMemo(() => {
    const amount = Number(totalPurchaseAmount);
    if (!automaticPurchase || amount < 0 || calculatedBaseQuantity <= 0) return null;
    return amount / calculatedBaseQuantity;
  }, [automaticPurchase, totalPurchaseAmount, calculatedBaseQuantity]);

  useEffect(() => {
    const loadCategories = async () => {
      if (!storeId) {
        setCategories([]);
        setLoadingCategories(false);
        return;
      }

      try {
        setLoadingCategories(true);
        const categoriesQuery = query(
          collection(db, "categories"),
          where("storeId", "==", storeId)
        );
        const snapshot = await getDocs(categoriesQuery);
        const list = snapshot.docs
          .map((categoryDoc) => ({
            id: categoryDoc.id,
            ...categoryDoc.data(),
          }))
          .sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", "fr", {
              sensitivity: "base",
            })
          );
        setCategories(list);
      } catch (error) {
        console.error("Erreur lors du chargement des catégories :", error);
        alert("Impossible de charger les catégories.");
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [storeId]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!isEditMode) {
        setExistingProduct(null);
        return;
      }
      if (!storeId || !productId) return;

      try {
        setLoadingProduct(true);
        const productRef = doc(db, "products", productId);
        const productSnapshot = await getDoc(productRef);

        if (!productSnapshot.exists()) {
          alert("Ce produit n'existe pas ou a été supprimé.");
          navigate("/products");
          return;
        }

        const data = { id: productSnapshot.id, ...productSnapshot.data() };

        if (data.storeId !== storeId) {
          alert("Vous n'avez pas accès à ce produit.");
          navigate("/products");
          return;
        }

        setExistingProduct(data);
        setProductName(data.productName || "");
        setCategoryId(data.categoryId || "");
        setCategoryName(data.categoryName || data.category || "");
        setPurchasePrice(
          data.purchasePrice !== undefined && data.purchasePrice !== null
            ? String(data.purchasePrice)
            : ""
        );
        setStock(
          data.stock !== undefined && data.stock !== null ? String(data.stock) : ""
        );
        setStockUnit(data.stockUnit || "");
        setAlertStock(
          data.alertStock !== undefined && data.alertStock !== null
            ? String(data.alertStock)
            : ""
        );
        setImageUrl(data.image || "");
        setImageFile(null);

        const auto = data.purchaseCalculationMode === "automatic";
        setAutomaticPurchase(auto);
        setTotalPurchaseAmount(
          data.totalPurchaseAmount !== undefined && data.totalPurchaseAmount !== null
            ? String(data.totalPurchaseAmount)
            : ""
        );
        setPurchaseQuantity(
          data.purchaseQuantity !== undefined && data.purchaseQuantity !== null
            ? String(data.purchaseQuantity)
            : ""
        );
        setPurchaseUnit(data.purchaseUnit || "");
        setUnitsPerPurchaseUnit(
          data.unitsPerPurchaseUnit !== undefined &&
            data.unitsPerPurchaseUnit !== null
            ? String(data.unitsPerPurchaseUnit)
            : "1"
        );
        setAddPurchaseToStock(false);

        const existingVariants = Array.isArray(data.variants)
          ? data.variants
              .filter((variant) => variant && variant.type)
              .map((variant) => ({
                type: String(variant.type || ""),
                quantity: Number(variant.quantity || 1),
                price: Number(variant.price || 0),
              }))
          : [];

        setVariants(existingVariants);
        setHasVariants(existingVariants.length > 0);
        setVariantType("");
        setVariantQuantity("");
        setVariantPrice("");
      } catch (error) {
        console.error("Erreur lors du chargement du produit :", error);
        alert("Impossible de charger les informations du produit.");
      } finally {
        setLoadingProduct(false);
      }
    };

    loadProduct();
  }, [isEditMode, productId, storeId, navigate]);

  const handleCategoryChange = (e) => {
    const selectedId = e.target.value;
    setCategoryId(selectedId);
    const selectedCategory = categories.find(
      (category) => category.id === selectedId
    );
    setCategoryName(selectedCategory?.name || "");
  };

  const openNewCategory = () => {
    setNewCategoryName("");
    setShowNewCategory(true);
  };

  const cancelNewCategory = () => {
    setNewCategoryName("");
    setShowNewCategory(false);
  };

  const createCategory = async () => {
    const trimmedName = newCategoryName.trim();

    if (!storeId) {
      alert("Aucun magasin connecté.");
      return;
    }
    if (!trimmedName) {
      alert("Veuillez entrer le nom de la catégorie.");
      return;
    }

    try {
      setCreatingCategory(true);
      const existingCategory = categories.find(
        (category) =>
          (category.name || "").trim().toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingCategory) {
        setCategoryId(existingCategory.id);
        setCategoryName(existingCategory.name);
        setShowNewCategory(false);
        setNewCategoryName("");
        alert("Cette catégorie existe déjà. Elle a été sélectionnée.");
        return;
      }

      const categoryRef = await addDoc(collection(db, "categories"), {
        name: trimmedName,
        storeId,
        createdAt: serverTimestamp(),
      });

      const newCategory = {
        id: categoryRef.id,
        name: trimmedName,
        storeId,
      };

      setCategories((previous) =>
        [...previous, newCategory].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "fr", {
            sensitivity: "base",
          })
        )
      );
      setCategoryId(categoryRef.id);
      setCategoryName(trimmedName);
      setShowNewCategory(false);
      setNewCategoryName("");
      alert("Catégorie créée avec succès !");
    } catch (error) {
      console.error("Erreur lors de la création de la catégorie :", error);
      alert("Erreur lors de la création de la catégorie.");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleAutomaticPurchaseToggle = (e) => {
    const enabled = e.target.checked;
    setAutomaticPurchase(enabled);

    if (enabled) {
      if (!purchaseUnit && stockUnit) setPurchaseUnit(stockUnit);
      if (!unitsPerPurchaseUnit) setUnitsPerPurchaseUnit("1");
      setAddPurchaseToStock(!isEditMode);
    }
  };

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

  const addVariant = () => {
    const type = variantType.trim();

    if (!type) {
      alert("Veuillez entrer le type de variante.");
      return;
    }
    if (variantQuantity === "" || Number(variantQuantity) <= 0) {
      alert("Veuillez entrer une quantité valide.");
      return;
    }
    if (variantPrice === "" || Number(variantPrice) < 0) {
      alert("Veuillez entrer un prix valide.");
      return;
    }

    const alreadyExists = variants.some(
      (variant) => variant.type.trim().toLowerCase() === type.toLowerCase()
    );

    if (alreadyExists) {
      alert("Cette variante existe déjà.");
      return;
    }

    setVariants((previous) => [
      ...previous,
      {
        type,
        quantity: Number(variantQuantity),
        price: Number(variantPrice),
      },
    ]);
    setVariantType("");
    setVariantQuantity("");
    setVariantPrice("");
  };

  const removeVariant = (index) => {
    setVariants((previous) =>
      previous.filter((_, variantIndex) => variantIndex !== index)
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl("");
    }
  };

  const resetForm = () => {
    setProductName("");
    setCategoryId("");
    setCategoryName("");
    setPurchasePrice("");
    setStock("");
    setStockUnit("");
    setAlertStock("");
    setImageUrl("");
    setImageFile(null);
    setAutomaticPurchase(false);
    setTotalPurchaseAmount("");
    setPurchaseQuantity("");
    setPurchaseUnit("");
    setUnitsPerPurchaseUnit("1");
    setAddPurchaseToStock(true);
    setHasVariants(false);
    setVariants([]);
    setVariantType("");
    setVariantQuantity("");
    setVariantPrice("");

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = "";
  };

  const saveProduct = async () => {
    if (!storeId) {
      alert("Aucun magasin connecté. Veuillez vous reconnecter.");
      return;
    }

    if (
      !productName.trim() ||
      !categoryId ||
      !categoryName.trim() ||
      stock === "" ||
      !stockUnit.trim()
    ) {
      alert("Veuillez remplir tous les champs importants !");
      return;
    }

    let finalPurchasePrice;

    if (automaticPurchase) {
      if (
        totalPurchaseAmount === "" ||
        Number(totalPurchaseAmount) < 0 ||
        purchaseQuantity === "" ||
        Number(purchaseQuantity) <= 0 ||
        !purchaseUnit.trim() ||
        unitsPerPurchaseUnit === "" ||
        Number(unitsPerPurchaseUnit) <= 0
      ) {
        alert("Veuillez compléter correctement les informations d'achat automatique.");
        return;
      }

      if (calculatedUnitPurchasePrice === null) {
        alert("Impossible de calculer le coût d'achat unitaire.");
        return;
      }

      finalPurchasePrice = calculatedUnitPurchasePrice;
    } else {
      if (purchasePrice === "" || Number(purchasePrice) < 0) {
        alert("Veuillez entrer un prix d'achat valide.");
        return;
      }
      finalPurchasePrice = Number(purchasePrice);
    }

    if (Number(stock) < 0) {
      alert("Le stock ne peut pas être négatif.");
      return;
    }
    if (alertStock !== "" && Number(alertStock) < 0) {
      alert("L'alerte stock ne peut pas être négative.");
      return;
    }
    if (hasVariants && variants.length === 0) {
      alert("Vous avez activé les variantes. Veuillez ajouter au moins une variante.");
      return;
    }

    try {
      setSavingProduct(true);

      let finalImage = imageUrl.trim();
      if (imageFile) {
        const imageRef = ref(
          storage,
          `products/${storeId}/${Date.now()}-${imageFile.name}`
        );
        await uploadBytes(imageRef, imageFile);
        finalImage = await getDownloadURL(imageRef);
      }

      const currentStock = Number(stock);
      const quantityToAdd =
        automaticPurchase && addPurchaseToStock ? calculatedBaseQuantity : 0;
      const finalStock = currentStock + quantityToAdd;

      const purchaseData = automaticPurchase
        ? {
            purchaseCalculationMode: "automatic",
            totalPurchaseAmount: Number(totalPurchaseAmount),
            purchaseQuantity: Number(purchaseQuantity),
            purchaseUnit: purchaseUnit.trim(),
            unitsPerPurchaseUnit: Number(unitsPerPurchaseUnit),
            calculatedPurchaseBaseQuantity: calculatedBaseQuantity,
            addPurchaseToStock,
            lastPurchaseStockAdded: addPurchaseToStock
              ? calculatedBaseQuantity
              : 0,
          }
        : {
            purchaseCalculationMode: "manual",
            totalPurchaseAmount: null,
            purchaseQuantity: null,
            purchaseUnit: "",
            unitsPerPurchaseUnit: null,
            calculatedPurchaseBaseQuantity: null,
            addPurchaseToStock: false,
            lastPurchaseStockAdded: 0,
          };

      const productData = {
        storeId,
        productName: productName.trim(),
        categoryId,
        categoryName: categoryName.trim(),
        category: categoryName.trim(),
        purchasePrice: finalPurchasePrice,
        ...purchaseData,
        stock: finalStock,
        stockUnit: stockUnit.trim(),
        alertStock: alertStock === "" ? 0 : Number(alertStock),
        image: finalImage,
        variants: hasVariants ? variants : [],
        isActive: existingProduct?.isActive !== false,
      };

      if (isEditMode) {
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
          ...productData,
          updatedAt: serverTimestamp(),
        });
        alert("Produit modifié avec succès !");
        navigate(`/products/${productId}`);
        return;
      }

      await addDoc(collection(db, "products"), {
        ...productData,
        createdAt: serverTimestamp(),
      });

      alert("Produit enregistré avec succès !");
      resetForm();
    } catch (error) {
      console.error(
        isEditMode
          ? "Erreur lors de la modification :"
          : "Erreur lors de l'enregistrement :",
        error
      );
      alert(
        isEditMode
          ? "Erreur lors de la modification du produit."
          : "Erreur lors de l'enregistrement du produit."
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const previewImage = imageFile ? URL.createObjectURL(imageFile) : imageUrl;

  if (loadingProduct) {
    return (
      <div className="add-product-container">
        <div className="product-loading">Chargement du produit...</div>
      </div>
    );
  }

  return (
    <div className="add-product-container">
      <div className="add-product-overlay">
        <div className="add-product-wrapper">
          <div className="page-header">
            <button type="button" onClick={() => navigate(-1)} className="backButton">
              ←
            </button>
            <h1 className="add-product-title">
              {isEditMode ? "Modifier le produit" : "Ajouter un produit"}
            </h1>
          </div>

          <div className="product-form-card">
            <div className="form-group">
              <label className="form-label">Image du produit</label>
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

            <div className="form-group">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="product-input file-input"
              />
            </div>

            {previewImage && (
              <img
                src={previewImage}
                alt="Aperçu du produit"
                className="preview-image"
              />
            )}

            <div className="form-group">
              <label className="form-label">Nom du produit</label>
              <input
                type="text"
                placeholder="Ex : Coca-Cola"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="product-input"
              />
            </div>

            <div className="form-group category-group">
              <label className="form-label">Catégorie</label>
              <div className="category-select-row">
                <select
                  value={categoryId}
                  onChange={handleCategoryChange}
                  className="product-input category-select"
                  disabled={loadingCategories || !storeId}
                >
                  <option value="">
                    {!storeId
                      ? "Aucun magasin connecté"
                      : loadingCategories
                        ? "Chargement des catégories..."
                        : "Choisir une catégorie"}
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
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

              {showNewCategory && (
                <div className="new-category-box">
                  <input
                    type="text"
                    placeholder="Nom de la nouvelle catégorie"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
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
                      {creatingCategory ? "Création..." : "Créer la catégorie"}
                    </button>
                  </div>
                </div>
              )}

              {categoryName && (
                <div className="selected-category">
                  Catégorie sélectionnée : <strong>{categoryName}</strong>
                </div>
              )}
            </div>

            <div className="purchase-header">
              <div>
                <h3>Prix d'achat</h3>
                <p>
                  Activez le calcul automatique si vous connaissez le montant total
                  payé et le conditionnement acheté.
                </p>
              </div>
            </div>

            <div className="purchase-toggle">
              <div>
                <strong>Calcul automatique du coût d'achat</strong>
                <small>
                  Le coût de l'unité principale sera calculé automatiquement.
                </small>
              </div>
              <label className="variant-switch">
                <input
                  type="checkbox"
                  checked={automaticPurchase}
                  onChange={handleAutomaticPurchaseToggle}
                />
                <span className="variant-slider"></span>
              </label>
            </div>

            {!automaticPurchase ? (
              <div className="form-group">
                <label className="form-label">
                  Prix d'achat de l'unité principale
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex : 800"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="product-input"
                />
              </div>
            ) : (
              <div className="automatic-purchase-box">
                <div className="purchase-grid">
                  <div className="purchase-field">
                    <label className="form-label">Montant total payé</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex : 50000"
                      value={totalPurchaseAmount}
                      onChange={(e) => setTotalPurchaseAmount(e.target.value)}
                      className="product-input"
                    />
                  </div>

                  <div className="purchase-field">
                    <label className="form-label">Quantité achetée</label>
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      placeholder="Ex : 12"
                      value={purchaseQuantity}
                      onChange={(e) => setPurchaseQuantity(e.target.value)}
                      className="product-input"
                    />
                  </div>

                  <div className="purchase-field">
                    <label className="form-label">Unité achetée</label>
                    <input
                      type="text"
                      placeholder="Ex : carton, paquet, pièce..."
                      value={purchaseUnit}
                      onChange={(e) => setPurchaseUnit(e.target.value)}
                      className="product-input"
                    />
                  </div>

                  <div className="purchase-field">
                    <label className="form-label">
                      Nombre de {stockUnit.trim() || "unités"} dans 1{" "}
                      {purchaseUnit.trim() || "unité achetée"}
                    </label>
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      placeholder="Ex : 12"
                      value={unitsPerPurchaseUnit}
                      onChange={(e) => setUnitsPerPurchaseUnit(e.target.value)}
                      className="product-input"
                    />
                    <small>
                      Si l'unité achetée est déjà l'unité principale, mettez 1.
                    </small>
                  </div>
                </div>

                {calculatedUnitPurchasePrice !== null && (
                  <div className="purchase-result">
                    <span>Coût d'achat calculé</span>
                    <strong>
                      {calculatedUnitPurchasePrice.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      FC / {stockUnit.trim() || "unité"}
                    </strong>
                  </div>
                )}

                <div className="stock-add-toggle">
                  <div>
                    <strong>Ajouter cette quantité au stock</strong>
                    <small>
                      Activez cette option si cet achat correspond à une nouvelle
                      entrée de marchandises.
                    </small>
                  </div>
                  <label className="variant-switch">
                    <input
                      type="checkbox"
                      checked={addPurchaseToStock}
                      onChange={(e) => setAddPurchaseToStock(e.target.checked)}
                    />
                    <span className="variant-slider"></span>
                  </label>
                </div>

                {calculatedBaseQuantity > 0 && (
                  <div className="stock-calculation-preview">
                    <div>
                      <span>Stock actuel</span>
                      <strong>
                        {Number(stock || 0).toLocaleString("fr-FR")} {stockUnit || "unité"}
                      </strong>
                    </div>
                    <div>
                      <span>Quantité de cet achat</span>
                      <strong>
                        {calculatedBaseQuantity.toLocaleString("fr-FR")} {stockUnit || "unité"}
                      </strong>
                    </div>
                    <div className="stock-preview-total">
                      <span>Stock après enregistrement</span>
                      <strong>
                        {(Number(stock || 0) +
                          (addPurchaseToStock ? calculatedBaseQuantity : 0)
                        ).toLocaleString("fr-FR")} {stockUnit || "unité"}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{automaticPurchase && addPurchaseToStock ? "Stock déjà disponible" : "Stock total"}</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Ex : 100"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="product-input"
              />
              {automaticPurchase && addPurchaseToStock && (
                <small className="field-help">
                  Saisissez ici uniquement le stock déjà présent. La quantité de
                  l'achat sera ajoutée automatiquement lors de l'enregistrement.
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Unité principale</label>
              <input
                type="text"
                placeholder="Ex : pièce, bouteille, kg..."
                value={stockUnit}
                onChange={(e) => setStockUnit(e.target.value)}
                className="product-input"
              />
              <small className="field-help">
                C'est l'unité de base utilisée pour gérer le stock.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Alerte stock</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Ex : 10"
                value={alertStock}
                onChange={(e) => setAlertStock(e.target.value)}
                className="product-input"
              />
            </div>

            <div className="variant-header">
              <h3>Gestion des variantes</h3>
              <p>
                Activez cette option si ce produit possède plusieurs formats ou
                conditionnements.
              </p>
            </div>

            <div className="variant-toggle">
              <span>Ce produit possède des variantes</span>
              <label className="variant-switch">
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={handleVariantsToggle}
                />
                <span className="variant-slider"></span>
              </label>
            </div>

            {hasVariants && (
              <div className="variant-section">
                <div className="variant-card">
                  <div className="variant-field">
                    <label className="form-label">Type de variante</label>
                    <input
                      type="text"
                      placeholder="Ex : Pack"
                      value={variantType}
                      onChange={(e) => setVariantType(e.target.value)}
                      className="product-input"
                    />
                  </div>

                  <div className="variant-field">
                    <label className="form-label">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder={
                        stockUnit ? `Ex : 12 ${stockUnit}` : "Ex : 12"
                      }
                      value={variantQuantity}
                      onChange={(e) => setVariantQuantity(e.target.value)}
                      className="product-input"
                    />
                  </div>

                  <div className="variant-field">
                    <label className="form-label">Prix de vente</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex : 9000"
                      value={variantPrice}
                      onChange={(e) => setVariantPrice(e.target.value)}
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

                {variants.length > 0 && (
                  <div className="saved-variants">
                    <div className="saved-variants-title">Variantes ajoutées</div>
                    <div className="saved-variants-list">
                      {variants.map((variant, index) => (
                        <div key={index} className="saved-variant-item">
                          <div className="variant-info">
                            <div className="variant-name">{variant.type}</div>
                            <div className="variant-quantity">
                              {variant.quantity} {stockUnit || "unité"}
                            </div>
                            <div className="variant-price">
                              {variant.price.toLocaleString("fr-FR")} FC
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="remove-variant-button"
                          >
                            Supprimer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="button-row save-row">
              <button
                type="button"
                onClick={saveProduct}
                className="save-button"
                disabled={savingProduct}
              >
                {savingProduct
                  ? isEditMode
                    ? "Modification..."
                    : "Enregistrement..."
                  : isEditMode
                    ? "Enregistrer les modifications"
                    : "Enregistrer le produit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddProduct;
