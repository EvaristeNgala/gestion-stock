import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./pos.module.css";

function POS() {
  // ==============================
  // PRODUITS / TICKET
  // ==============================

  const [products, setProducts] = useState([]);
  const [ticket, setTicket] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(
    "Tous les articles"
  );
  const [loading, setLoading] = useState(true);

  // Produit actuellement sélectionné
  // pour la modal des variantes
  const [selectedProduct, setSelectedProduct] =
    useState(null);

  // Variante actuellement sélectionnée
  // pour choisir sa quantité
  const [selectedVariant, setSelectedVariant] =
    useState(null);

  // Quantité de la variante à ajouter
  const [variantQuantity, setVariantQuantity] =
    useState(1);

  // Affichage de la modal du ticket
  const [showTicket, setShowTicket] = useState(false);

  // ==============================
  // SESSION UTILISATEUR
  // ==============================

  const [session, setSession] = useState(null);

  // ==============================
  // CAISSE
  // ==============================

  const [cashSession, setCashSession] = useState(null);

  const [cashLoading, setCashLoading] =
    useState(true);

  const [openingCash, setOpeningCash] =
    useState(false);

  const [closingCash, setClosingCash] =
    useState(false);

  // Paiement en cours
  const [paying, setPaying] = useState(false);

  // Étapes du ticket : ticket -> paiement -> reçu
  const [ticketStep, setTicketStep] = useState("ticket");
  const [cashReceived, setCashReceived] = useState("");
  const [lastSale, setLastSale] = useState(null);
  const [savingTicket, setSavingTicket] = useState(false);

  // ==============================
  // RÉCUPÉRER LA SESSION
  // ==============================

  useEffect(() => {
    try {
      const savedSession =
        localStorage.getItem("storeSession");

      if (savedSession) {
        const parsedSession =
          JSON.parse(savedSession);

        setSession(parsedSession);
      } else {
        console.warn(
          "Aucune session utilisateur trouvée."
        );

        setCashLoading(false);
      }
    } catch (error) {
      console.error(
        "Erreur récupération session :",
        error
      );

      setCashLoading(false);
    }
  }, []);

  // ==============================
  // INFORMATIONS SESSION
  // ==============================

  const storeId = session?.storeId || null;

  const userId =
    session?.uid ||
    session?.userId ||
    null;

  const userName =
    session?.userName ||
    session?.name ||
    session?.displayName ||
    "Utilisateur";

  const userRole =
    session?.role || "cashier";

  // ==============================
  // VÉRIFIER LA CAISSE
  // ==============================

  useEffect(() => {
    if (!storeId || !userId) {
      if (session) {
        setCashLoading(false);
      }

      return;
    }

    setCashLoading(true);

    const cashSessionsRef = collection(
      db,
      "cashSessions"
    );

    const cashQuery = query(
      cashSessionsRef,
      where("storeId", "==", storeId),
      where("userId", "==", userId),
      where("status", "==", "open")
    );

    const unsubscribe = onSnapshot(
      cashQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const cashDoc =
            snapshot.docs[0];

          setCashSession({
            id: cashDoc.id,
            ...cashDoc.data(),
          });
        } else {
          setCashSession(null);
        }

        setCashLoading(false);
      },
      (error) => {
        console.error(
          "Erreur vérification caisse :",
          error
        );

        setCashSession(null);
        setCashLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, userId, session]);

  // ==============================
  // OUVRIR LA CAISSE
  // ==============================

  const openCashRegister = async () => {
    if (!storeId || !userId) {
      alert(
        "Impossible d'ouvrir la caisse : session utilisateur introuvable."
      );

      return;
    }

    if (cashSession) {
      alert("La caisse est déjà ouverte.");
      return;
    }

    const confirmation = window.confirm(
      "Voulez-vous ouvrir la caisse maintenant ?"
    );

    if (!confirmation) {
      return;
    }

    try {
      setOpeningCash(true);

      const cashSessionsRef =
        collection(db, "cashSessions");

      const newCashSession = {
        storeId,
        userId,
        userName,
        role: userRole,
        openedAt: serverTimestamp(),
        closedAt: null,
        status: "open",
        totalSales: 0,
        numberOfSales: 0,
        createdAt: serverTimestamp(),
      };

      const documentReference =
        await addDoc(
          cashSessionsRef,
          newCashSession
        );

      setCashSession({
        id: documentReference.id,
        ...newCashSession,
        openedAt: new Date(),
      });

      alert(
        "La caisse a été ouverte avec succès."
      );
    } catch (error) {
      console.error(
        "Erreur ouverture caisse :",
        error
      );

      alert(
        "Impossible d'ouvrir la caisse. Vérifiez votre connexion."
      );
    } finally {
      setOpeningCash(false);
    }
  };

  // ==============================
  // FERMER LA CAISSE
  // ==============================

  const closeCashRegister = async () => {
    if (!cashSession?.id) {
      alert("Aucune caisse ouverte.");
      return;
    }

    if (ticket.length > 0) {
      alert(
        "Veuillez terminer ou vider le ticket avant de fermer la caisse."
      );

      setShowTicket(true);

      return;
    }

    const confirmation = window.confirm(
      "Voulez-vous vraiment fermer la caisse ?"
    );

    if (!confirmation) {
      return;
    }

    try {
      setClosingCash(true);

      const cashSessionRef = doc(
        db,
        "cashSessions",
        cashSession.id
      );

      await updateDoc(
        cashSessionRef,
        {
          closedAt: serverTimestamp(),
          status: "closed",
        }
      );

      setCashSession(null);
      setTicket([]);

      alert(
        "La caisse a été fermée avec succès."
      );
    } catch (error) {
      console.error(
        "Erreur fermeture caisse :",
        error
      );

      alert(
        "Impossible de fermer la caisse. Vérifiez votre connexion."
      );
    } finally {
      setClosingCash(false);
    }
  };

  // ==============================
  // FORMAT HEURE
  // ==============================

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return "--:--";
    }

    let date;

    if (
      typeof timestamp.toDate ===
      "function"
    ) {
      date = timestamp.toDate();
    } else if (
      timestamp instanceof Date
    ) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return date.toLocaleTimeString(
      "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // ==============================
  // RÉCUPÉRATION DES PRODUITS
  // ==============================

  useEffect(() => {
    const productsRef =
      collection(db, "products");

    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const productsData =
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        setProducts(productsData);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Erreur Firebase :",
          error
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ==============================
  // CATÉGORIES
  // ==============================

  const categories = [
    "Tous les articles",

    ...new Set(
      products
        .filter(
          (product) =>
            product.isActive !== false
        )
        .map(
          (product) =>
            product.categoryName ||
            product.category
        )
        .filter(Boolean)
    ),
  ];

  // ==============================
  // FILTRAGE
  // ==============================

  const filteredProducts =
    products.filter((product) => {
      const isActive =
        product.isActive !== false;

      if (!isActive) {
        return false;
      }

      const name =
        product.productName || "";

      const matchSearch = name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        );

      const productCategory =
        product.categoryName ||
        product.category ||
        "";

      const matchCategory =
        category ===
          "Tous les articles" ||
        productCategory === category;

      return (
        matchSearch &&
        matchCategory
      );
    });

  // ==============================
  // RÉCUPÉRER LES VARIANTES VALIDES
  // ==============================

  const getValidVariants = (
    product
  ) => {
    if (
      !Array.isArray(
        product?.variants
      )
    ) {
      return [];
    }

    return product.variants.filter(
      (variant) =>
        variant &&
        variant.type?.trim() !==
          "" &&
        Number(
          variant.quantity || 0
        ) > 0
    );
  };

  // ==============================
  // CLIQUER SUR UN PRODUIT
  // ==============================

  const handleProductClick = (
    product
  ) => {
    if (!cashSession) {
      alert(
        "La caisse est fermée. Veuillez d'abord ouvrir la caisse."
      );

      return;
    }

    if (product.isActive === false) {
      alert(
        "Ce produit n'est pas disponible à la vente."
      );

      return;
    }

    const variants =
      getValidVariants(product);

    if (variants.length > 0) {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setVariantQuantity(1);

      return;
    }

    addToTicket(product, null, 1);
  };

  // ==============================
  // AJOUT AU TICKET
  // ==============================

  const addToTicket = (
    product,
    variant = null,
    quantityToAdd = 1
  ) => {
    if (!cashSession) {
      alert(
        "La caisse est fermée. Veuillez d'abord ouvrir la caisse."
      );

      return false;
    }

    if (product.isActive === false) {
      alert(
        "Ce produit n'est pas disponible à la vente."
      );

      return false;
    }

    const stock = Number(
      product.stock || 0
    );

    const variantQuantity = Number(
      variant?.quantity || 1
    );

    const price = Number(
      variant?.price ??
        product.price ??
        product.sellingPrice ??
        0
    );

    const variantType =
      variant?.type?.trim() ||
      product.stockUnit ||
      "Unité";

    const quantity = Number(
      quantityToAdd || 0
    );

    // ==============================
    // VÉRIFICATIONS
    // ==============================

    if (quantity <= 0) {
      alert(
        "La quantité doit être supérieure à zéro."
      );

      return false;
    }

    if (stock <= 0) {
      alert(
        "Ce produit est en rupture de stock."
      );

      return false;
    }

    if (variantQuantity <= 0) {
      alert(
        "La quantité de la variante est invalide."
      );

      return false;
    }

    // Stock nécessaire pour la quantité demandée
    const requiredStock =
      quantity * variantQuantity;

    if (requiredStock > stock) {
      alert(
        `Stock insuffisant.\n\nStock disponible : ${stock} ${
          product.stockUnit || ""
        }\nStock nécessaire : ${requiredStock} ${
          product.stockUnit || ""
        }`
      );

      return false;
    }

    // ==============================
    // ARTICLE EXISTANT
    // ==============================

    const existingIndex =
      ticket.findIndex(
        (item) =>
          item.productId ===
            product.id &&
          item.variantType ===
            variantType
      );

    if (existingIndex !== -1) {
      const existingItem =
        ticket[existingIndex];

      const newQuantity =
        existingItem.quantity +
        quantity;

      const newRequiredStock =
        newQuantity *
        existingItem.variantQuantity;

      if (
        newRequiredStock >
        stock
      ) {
        alert(
          `Stock insuffisant.\n\nStock disponible : ${stock} ${
            product.stockUnit || ""
          }\nStock nécessaire : ${newRequiredStock} ${
            product.stockUnit || ""
          }`
        );

        return false;
      }

      setTicket(
        ticket.map(
          (item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  quantity:
                    newQuantity,
                  stockAvailable:
                    stock,
                }
              : item
        )
      );

      return true;
    }

    // ==============================
    // NOUVEL ARTICLE
    // ==============================

    setTicket([
      ...ticket,
      {
        productId:
          product.id,

        name:
          product.productName ||
          "Produit",

        price,

        quantity,

        variantType,

        variantQuantity,

        stockUnit:
          product.stockUnit || "",

        stockAvailable:
          stock,

        categoryName:
          product.categoryName ||
          product.category ||
          "Non classé",

        // Prix d'achat de l'unité de stock de base.
        basePurchasePrice: Number(
          product.purchasePrice || 0
        ),

        // Coût d'achat réel d'une variante vendue.
        // Exemple : pack de 12 bouteilles => prix achat bouteille × 12.
        purchasePrice:
          Number(product.purchasePrice || 0) *
          variantQuantity,
      },
    ]);

    return true;
  };

  // ==============================
  // CHOISIR UNE VARIANTE
  // ==============================

  const handleVariantClick = (
    product,
    variant
  ) => {
    const stock = Number(
      product.stock || 0
    );

    const conversionQuantity =
      Number(
        variant.quantity || 0
      );

    if (
      conversionQuantity <= 0
    ) {
      alert(
        "La quantité de cette variante est invalide."
      );

      return;
    }

    if (
      stock <
      conversionQuantity
    ) {
      alert(
        `Stock insuffisant.\n\nStock disponible : ${stock} ${
          product.stockUnit || ""
        }`
      );

      return;
    }

    // On ne ferme plus la modal.
    // On ouvre maintenant la sélection
    // de quantité.
    setSelectedVariant(variant);
    setVariantQuantity(1);
  };

  // ==============================
  // AUGMENTER QUANTITÉ VARIANTE
  // ==============================

  const increaseVariantQuantity = () => {
    if (
      !selectedProduct ||
      !selectedVariant
    ) {
      return;
    }

    const stock = Number(
      selectedProduct.stock || 0
    );

    const conversionQuantity =
      Number(
        selectedVariant.quantity || 1
      );

    const maxQuantity = Math.floor(
      stock / conversionQuantity
    );

    if (
      variantQuantity >=
      maxQuantity
    ) {
      alert(
        `Stock maximum atteint.\n\nVous pouvez ajouter au maximum ${maxQuantity} ${selectedVariant.type}.`
      );

      return;
    }

    setVariantQuantity(
      (current) => current + 1
    );
  };

  // ==============================
  // DIMINUER QUANTITÉ VARIANTE
  // ==============================

  const decreaseVariantQuantity = () => {
    setVariantQuantity(
      (current) =>
        current > 1
          ? current - 1
          : 1
    );
  };

  // ==============================
  // CONFIRMER VARIANTE
  // ==============================

  const confirmVariant = () => {
    if (
      !selectedProduct ||
      !selectedVariant
    ) {
      return;
    }

    const added =
      addToTicket(
        selectedProduct,
        selectedVariant,
        variantQuantity
      );

    if (added) {
      setSelectedProduct(null);
      setSelectedVariant(null);
      setVariantQuantity(1);
    }
  };

  // ==============================
  // FERMER MODAL VARIANTE
  // ==============================

  const closeVariantModal = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setVariantQuantity(1);
  };

  // ==============================
  // AUGMENTER QUANTITÉ TICKET
  // ==============================

  const increaseQuantity = (
    index
  ) => {
    const item = ticket[index];

    const stock = Number(
      item.stockAvailable || 0
    );

    const newQuantity =
      item.quantity + 1;

    const requiredStock =
      newQuantity *
      item.variantQuantity;

    if (
      requiredStock >
      stock
    ) {
      alert(
        `Stock insuffisant.\n\nStock disponible : ${stock} ${
          item.stockUnit || ""
        }`
      );

      return;
    }

    setTicket(
      ticket.map(
        (
          ticketItem,
          itemIndex
        ) =>
          itemIndex === index
            ? {
                ...ticketItem,
                quantity:
                  newQuantity,
              }
            : ticketItem
      )
    );
  };

  // ==============================
  // DIMINUER QUANTITÉ
  // ==============================

  const decreaseQuantity = (
    index
  ) => {
    const item = ticket[index];

    if (item.quantity <= 1) {
      removeFromTicket(index);

      return;
    }

    setTicket(
      ticket.map(
        (
          ticketItem,
          itemIndex
        ) =>
          itemIndex === index
            ? {
                ...ticketItem,
                quantity:
                  ticketItem.quantity -
                  1,
              }
            : ticketItem
      )
    );
  };

  // ==============================
  // SUPPRIMER DU TICKET
  // ==============================

  const removeFromTicket = (
    index
  ) => {
    setTicket(
      ticket.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  };

  // ==============================
  // VIDER LE TICKET
  // ==============================

  const clearTicket = () => {
    if (ticket.length === 0) {
      return;
    }

    const confirmation =
      window.confirm(
        "Voulez-vous vraiment vider le ticket ?"
      );

    if (confirmation) {
      setTicket([]);
    }
  };

  // ==============================
  // TOTAL
  // ==============================

  const total = ticket.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        item.quantity,
    0
  );

  // ==============================
  // NOMBRE ARTICLES
  // ==============================

  const totalItems =
    ticket.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  // ==============================
  // QUANTITÉ STOCK DE BASE
  // ==============================

  const getBaseQuantity = (
    item
  ) => {
    return (
      item.quantity *
      item.variantQuantity
    );
  };

  // ==============================
  // PARCOURS TICKET / PAIEMENT
  // ==============================

  const openTicket = () => {
    setTicketStep("ticket");
    setCashReceived("");
    setLastSale(null);
    setShowTicket(true);
  };

  const openPayment = () => {
    if (ticket.length === 0) {
      alert("Le ticket est vide.");
      return;
    }

    setCashReceived(String(total));
    setTicketStep("payment");
  };

  // Enregistre seulement le ticket pour le reprendre plus tard.
  // Aucun stock n'est retiré et la vente n'entre pas dans le rapport.
  const savePendingTicket = async () => {
    if (savingTicket || ticket.length === 0) return;

    if (!cashSession?.id || !storeId || !userId) {
      alert("Session de caisse introuvable.");
      return;
    }

    try {
      setSavingTicket(true);

      await addDoc(collection(db, "savedTickets"), {
        storeId,
        cashSessionId: cashSession.id,
        userId,
        userName,
        userRole,
        items: ticket,
        total,
        totalItems,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTicket([]);
      setShowTicket(false);
      setTicketStep("ticket");
      setCashReceived("");

      alert("Ticket enregistré. Vous pourrez le reprendre plus tard.");
    } catch (error) {
      console.error("Erreur enregistrement ticket :", error);
      alert("Impossible d'enregistrer le ticket. Vérifiez votre connexion.");
    } finally {
      setSavingTicket(false);
    }
  };

  // ==============================
  // VALIDER LE PAIEMENT ESPÈCES
  // ==============================

  const handlePayment = async () => {
    if (paying) return;

    const received = Number(cashReceived || 0);

    if (!cashSession?.id) {
      alert("Aucune caisse ouverte.");
      return;
    }

    if (!storeId || !userId) {
      alert("Session utilisateur introuvable.");
      return;
    }

    if (ticket.length === 0) {
      alert("Le ticket est vide.");
      return;
    }

    if (!Number.isFinite(received) || received < total) {
      alert(`Montant insuffisant. Le client doit payer au moins ${total.toLocaleString("fr-FR")} FC.`);
      return;
    }

    const changeAmount = received - total;

    try {
      setPaying(true);

      const saleRef = doc(collection(db, "sales"));
      const cashSessionRef = doc(db, "cashSessions", cashSession.id);

      await runTransaction(db, async (transaction) => {
        const stockByProduct = {};

        ticket.forEach((item) => {
          const baseQuantity =
            Number(item.quantity || 0) *
            Number(item.variantQuantity || 1);

          if (!stockByProduct[item.productId]) {
            stockByProduct[item.productId] = 0;
          }

          stockByProduct[item.productId] += baseQuantity;
        });

        const productSnapshots = {};

        for (const [productId, quantityToRemove] of Object.entries(stockByProduct)) {
          const productRef = doc(db, "products", productId);
          const productSnapshot = await transaction.get(productRef);

          if (!productSnapshot.exists()) {
            throw new Error("PRODUCT_NOT_FOUND");
          }

          const currentStock = Number(productSnapshot.data().stock || 0);

          if (currentStock < quantityToRemove) {
            const productName =
              productSnapshot.data().productName || "Produit";

            throw new Error(
              `STOCK_INSUFFICIENT|${productName}|${currentStock}|${quantityToRemove}`
            );
          }

          productSnapshots[productId] = {
            ref: productRef,
            currentStock,
            quantityToRemove,
          };
        }

        const cashSnapshot = await transaction.get(cashSessionRef);

        if (!cashSnapshot.exists()) {
          throw new Error("CASH_SESSION_NOT_FOUND");
        }

        if (cashSnapshot.data().status !== "open") {
          throw new Error("CASH_SESSION_CLOSED");
        }

        Object.values(productSnapshots).forEach((productData) => {
          transaction.update(productData.ref, {
            stock:
              productData.currentStock -
              productData.quantityToRemove,
            updatedAt: serverTimestamp(),
          });
        });

        const saleItems = ticket.map((item) => {
          const quantity = Number(item.quantity || 0);
          const sellingPrice = Number(item.price || 0);
          const conversionQuantity = Number(item.variantQuantity || 1);
          const purchasePrice = Number(item.purchasePrice || 0);

          return {
            productId: item.productId,
            name: item.name,
            categoryName: item.categoryName || "Non classé",
            variantType: item.variantType,
            quantity,
            price: sellingPrice,
            sellingPrice,
            purchasePrice,
            basePurchasePrice: Number(item.basePurchasePrice || 0),
            variantQuantity: conversionQuantity,
            baseQuantity: quantity * conversionQuantity,
            stockUnit: item.stockUnit || "",
            lineTotal: sellingPrice * quantity,
            linePurchaseCost: purchasePrice * quantity,
            profit: (sellingPrice - purchasePrice) * quantity,
          };
        });

        const totalPurchaseCost = saleItems.reduce(
          (sum, item) => sum + Number(item.linePurchaseCost || 0),
          0
        );

        const totalProfit = total - totalPurchaseCost;

        transaction.set(saleRef, {
          storeId,
          cashSessionId: cashSession.id,
          userId,
          userName,
          userRole,
          items: saleItems,
          total,
          totalItems,
          totalPurchaseCost,
          profit: totalProfit,
          paymentMethod: "cash",
          amountReceived: received,
          changeAmount,
          status: "completed",
          createdAt: serverTimestamp(),
        });

        transaction.update(cashSessionRef, {
          totalSales:
            Number(cashSnapshot.data().totalSales || 0) + total,
          numberOfSales:
            Number(cashSnapshot.data().numberOfSales || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      });

      setLastSale({
        total,
        received,
        changeAmount,
        items: [...ticket],
        totalItems,
      });
      setTicketStep("receipt");
    } catch (error) {
      console.error("Erreur paiement :", error);

      if (error?.message?.startsWith("STOCK_INSUFFICIENT|")) {
        const [, productName, available, required] =
          error.message.split("|");

        alert(
          `Stock insuffisant pour ${productName}.\n\nStock disponible : ${available}\nStock nécessaire : ${required}`
        );
      } else if (error?.message === "PRODUCT_NOT_FOUND") {
        alert("Un produit du ticket n'existe plus.");
      } else if (
        error?.message === "CASH_SESSION_NOT_FOUND" ||
        error?.message === "CASH_SESSION_CLOSED"
      ) {
        alert(
          "La session de caisse n'est plus disponible. Veuillez rouvrir la caisse."
        );
      } else {
        alert(
          "Impossible d'enregistrer le paiement. Vérifiez votre connexion et réessayez."
        );
      }
    } finally {
      setPaying(false);
    }
  };

  const startNewSale = () => {
    setTicket([]);
    setCashReceived("");
    setLastSale(null);
    setTicketStep("ticket");
    setShowTicket(false);
  };

  const printReceipt = () => {
    window.print();
  };

  // ==============================
  // STOCK
  // ==============================

  const getStockClass = (
    product
  ) => {
    const stock = Number(
      product.stock || 0
    );

    const alertStock = Number(
      product.alertStock || 0
    );

    if (stock <= 0) {
      return styles.outOfStock;
    }

    if (
      alertStock > 0 &&
      stock <= alertStock
    ) {
      return styles.lowStock;
    }

    return styles.stock;
  };

  // ==============================
  // PRIX PRODUIT SANS VARIANTE
  // ==============================

  const getProductPrice = (
    product
  ) => {
    return Number(
      product.price ??
        product.sellingPrice ??
        0
    );
  };

  // ==============================
  // INFORMATIONS VARIANTE SÉLECTIONNÉE
  // ==============================

  const selectedVariantPrice =
    Number(
      selectedVariant?.price || 0
    );

  const selectedVariantConversion =
    Number(
      selectedVariant?.quantity || 1
    );

  const variantTotal =
    selectedVariantPrice *
    variantQuantity;

  const variantBaseQuantity =
    selectedVariantConversion *
    variantQuantity;

  const variantMaxQuantity =
    selectedProduct &&
    selectedVariant
      ? Math.floor(
          Number(
            selectedProduct.stock ||
              0
          ) /
            selectedVariantConversion
        )
      : 0;

  // ==============================
  // ÉCRAN DE CHARGEMENT CAISSE
  // ==============================

  if (
    !session ||
    cashLoading
  ) {
    return (
      <div
        className={
          styles.cashAccessScreen
        }
      >
        <div
          className={
            styles.cashAccessCard
          }
        >
          <div
            className={
              styles.cashLoadingIcon
            }
          >
            🧾
          </div>

          <h2>
            Vérification de la caisse
          </h2>

          <p>
            Vérification de votre
            session de caisse...
          </p>
        </div>
      </div>
    );
  }

  // ==============================
  // CAISSE FERMÉE
  // ==============================

  if (!cashSession) {
    return (
      <div
        className={
          styles.cashAccessScreen
        }
      >
        <div
          className={
            styles.cashAccessCard
          }
        >
          <div
            className={
              styles.cashClosedIcon
            }
          >
            🧾
          </div>

          <div
            className={
              styles.cashStatusClosed
            }
          >
            CAISSE FERMÉE
          </div>

          <h1>
            Ouvrir la caisse
          </h1>

          <p
            className={
              styles.cashDescription
            }
          >
            Bonjour{" "}
            <strong>
              {userName}
            </strong>
            . Vous devez ouvrir
            votre caisse avant de
            commencer les ventes.
          </p>

          <div
            className={
              styles.cashUserInfo
            }
          >
            <div>
              <span>
                Utilisateur
              </span>

              <strong>
                {userName}
              </strong>
            </div>

            <div>
              <span>
                Rôle
              </span>

              <strong>
                {userRole}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className={
              styles.openCashButton
            }
            onClick={
              openCashRegister
            }
            disabled={
              openingCash
            }
          >
            {openingCash
              ? "Ouverture..."
              : "Ouvrir la caisse"}
          </button>
        </div>
      </div>
    );
  }

  // ==============================
  // POS
  // ==============================

  return (
    <div className={styles.pos}>

      {/* HEADER */}

      <header
        className={styles.header}
      >
        <button
          type="button"
          className={styles.menu}
        >
          ☰
        </button>

        <div
          className={styles.title}
        >
          <span>
            Point de vente
          </span>

          <small
            className={
              styles.cashOpenIndicator
            }
          >
            🟢 Caisse ouverte
          </small>
        </div>

        <button
          type="button"
          className={
            styles.ticketButtonHeader
          }
          onClick={openTicket}
        >
          🧾

          {totalItems > 0 && (
            <span
              className={
                styles.headerTicketCount
              }
            >
              {totalItems}
            </span>
          )}
        </button>
      </header>


      {/* INFORMATIONS CAISSE */}

      <section
        className={
          styles.cashInfoBar
        }
      >
        <div>
          <span>
            🟢 Caisse ouverte
          </span>

          <strong>
            {userName}
          </strong>
        </div>

        <div>
          <span>
            Ouverture
          </span>

          <strong>
            {formatTime(
              cashSession.openedAt
            )}
          </strong>
        </div>

        <button
          type="button"
          className={
            styles.closeCashButton
          }
          onClick={
            closeCashRegister
          }
          disabled={
            closingCash
          }
        >
          {closingCash
            ? "Fermeture..."
            : "Fermer la caisse"}
        </button>
      </section>


      {/* BARRE TICKET / PAIEMENT */}

      <section
        className={
          styles.paymentBar
        }
      >
        <button
          type="button"
          className={
            styles.openTickets
          }
          onClick={openTicket}
        >
          <span>
            TICKET
          </span>

          <strong>
            {totalItems} article
            {totalItems > 1
              ? "s"
              : ""}
          </strong>
        </button>

        <button
          type="button"
          className={
            styles.payment
          }
          onClick={() => {
            if (ticket.length === 0) {
              openTicket();
              return;
            }
            setShowTicket(true);
            setCashReceived(String(total));
            setTicketStep("payment");
          }}
        >
          <span>
            TOTAL
          </span>

          <strong>
            {total.toLocaleString(
              "fr-FR"
            )}{" "}
            FC
          </strong>
        </button>
      </section>


      {/* RECHERCHE */}

      <section
        className={
          styles.searchBar
        }
      >
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

        <select
          value={category}
          onChange={(e) =>
            setCategory(
              e.target.value
            )
          }
          className={
            styles.category
          }
        >
          {categories.map(
            (cat) => (
              <option
                key={cat}
                value={cat}
              >
                {cat}
              </option>
            )
          )}
        </select>

        <div
          className={
            styles.searchIcon
          }
        >
          🔍
        </div>
      </section>


      {/* PRODUITS */}

      <main
        className={
          styles.productsSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >

          <span>
            {
              filteredProducts.length
            }{" "}
            produit
            {filteredProducts.length >
            1
              ? "s"
              : ""}
          </span>
        </div>

        <div
          className={
            styles.products
          }
        >
          {loading && (
            <div
              className={
                styles.message
              }
            >
              Chargement des
              produits...
            </div>
          )}

          {!loading &&
            filteredProducts.length ===
              0 && (
              <div
                className={
                  styles.message
                }
              >
                Aucun produit
                trouvé
              </div>
            )}

          {!loading &&
            filteredProducts.map(
              (product) => {
                const variants =
                  getValidVariants(
                    product
                  );

                const stock =
                  Number(
                    product.stock || 0
                  );

                const hasVariants =
                  variants.length >
                  0;

                const disabled =
                  stock <= 0;

                return (
                  <button
                    type="button"
                    key={
                      product.id
                    }
                    className={`${styles.product} ${
                      disabled
                        ? styles.productDisabled
                        : ""
                    }`}
                    disabled={
                      disabled
                    }
                    onClick={() =>
                      handleProductClick(
                        product
                      )
                    }
                  >
                    <div
                      className={
                        styles.productImage
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
                        <div
                          className={
                            styles.noImage
                          }
                        >
                          📦
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        styles.productInfo
                      }
                    >
                      <div
                        className={
                          styles.productName
                        }
                      >
                        {
                          product.productName
                        }
                      </div>

                      {!hasVariants && (
                        <div
                          className={
                            styles.productPrice
                          }
                        >
                          {getProductPrice(
                            product
                          ).toLocaleString(
                            "fr-FR"
                          )}{" "}
                          FC
                        </div>
                      )}

                      {hasVariants && (
                        <div
                          className={
                            styles.variantHint
                          }
                        >
                          Choisir une
                          variante
                        </div>
                      )}

                      <div
                        className={
                          getStockClass(
                            product
                          )
                        }
                      >
                        Stock :{" "}
                        {stock}{" "}
                        {product.stockUnit ||
                          ""}
                      </div>
                    </div>
                  </button>
                );
              }
            )}
        </div>
      </main>


      {/* =================================
          MODAL VARIANTES
      ================================= */}

      {selectedProduct && (
        <div
          className={
            styles.modalOverlay
          }
          onClick={
            closeVariantModal
          }
        >
          <div
            className={
              styles.variantModal
            }
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL CHOIX VARIANTE */}

            {!selectedVariant && (
              <>
                <div
                  className={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2>
                      {
                        selectedProduct.productName
                      }
                    </h2>

                    <p>
                      Choisissez une
                      variante
                    </p>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      closeVariantModal
                    }
                  >
                    ×
                  </button>
                </div>

                <div
                  className={
                    styles.variantList
                  }
                >
                  {getValidVariants(
                    selectedProduct
                  ).map(
                    (
                      variant,
                      index
                    ) => {
                      const price =
                        Number(
                          variant.price ||
                            0
                        );

                      const quantity =
                        Number(
                          variant.quantity ||
                            0
                        );

                      const stock =
                        Number(
                          selectedProduct.stock ||
                            0
                        );

                      const available =
                        stock >=
                        quantity;

                      return (
                        <button
                          type="button"
                          key={index}
                          className={
                            styles.variantModalButton
                          }
                          disabled={
                            !available
                          }
                          onClick={() =>
                            handleVariantClick(
                              selectedProduct,
                              variant
                            )
                          }
                        >
                          <div
                            className={
                              styles.variantModalInfo
                            }
                          >
                            <strong>
                              {
                                variant.type
                              }
                            </strong>

                            <span>
                              {
                                quantity
                              }{" "}
                              {
                                selectedProduct.stockUnit
                              }
                            </span>
                          </div>

                          <div
                            className={
                              styles.variantModalPrice
                            }
                          >
                            {price.toLocaleString(
                              "fr-FR"
                            )}{" "}
                            FC
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </>
            )}


            {/* MODAL QUANTITÉ VARIANTE */}

            {selectedVariant && (
              <>
                <div
                  className={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2>
                      {
                        selectedVariant.type
                      }
                    </h2>

                    <p>
                      {
                        selectedProduct.productName
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      closeVariantModal
                    }
                  >
                    ×
                  </button>
                </div>

                <div
                  className={
                    styles.variantQuantityContent
                  }
                >

                  <div
                    className={
                      styles.variantQuantityInfo
                    }
                  >
                    <span>
                      Prix unitaire
                    </span>

                    <strong>
                      {selectedVariantPrice.toLocaleString(
                        "fr-FR"
                      )}{" "}
                      FC
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantQuantityInfo
                    }
                  >
                    <span>
                      1{" "}
                      {
                        selectedVariant.type
                      }{" "}
                      =
                    </span>

                    <strong>
                      {
                        selectedVariantConversion
                      }{" "}
                      {
                        selectedProduct.stockUnit
                      }
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantStockInfo
                    }
                  >
                    Stock disponible :{" "}
                    <strong>
                      {
                        selectedProduct.stock
                      }{" "}
                      {
                        selectedProduct.stockUnit
                      }
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantQuantityLabel
                    }
                  >
                    Quantité à vendre
                  </div>


                  <div
                    className={
                      styles.variantQuantityControls
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        decreaseVariantQuantity
                      }
                    >
                      −
                    </button>

                    <strong>
                      {
                        variantQuantity
                      }
                    </strong>

                    <button
                      type="button"
                      onClick={
                        increaseVariantQuantity
                      }
                      disabled={
                        variantQuantity >=
                        variantMaxQuantity
                      }
                    >
                      +
                    </button>
                  </div>


                  <div
                    className={
                      styles.variantQuantityLimit
                    }
                  >
                    Maximum :{" "}
                    {
                      variantMaxQuantity
                    }{" "}
                    {
                      selectedVariant.type
                    }
                    {variantMaxQuantity >
                    1
                      ? "s"
                      : ""}
                  </div>


                  <div
                    className={
                      styles.variantBaseStock
                    }
                  >
                    Cette vente consommera{" "}
                    <strong>
                      {
                        variantBaseQuantity
                      }{" "}
                      {
                        selectedProduct.stockUnit
                      }
                    </strong>{" "}
                    du stock.
                  </div>


                  <div
                    className={
                      styles.variantTotal
                    }
                  >
                    <span>
                      Total
                    </span>

                    <strong>
                      {variantTotal.toLocaleString(
                        "fr-FR"
                      )}{" "}
                      FC
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantActions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.variantCancelButton
                      }
                      onClick={() => {
                        setSelectedVariant(
                          null
                        );
                        setVariantQuantity(
                          1
                        );
                      }}
                    >
                      Retour
                    </button>

                    <button
                      type="button"
                      className={
                        styles.variantAddButton
                      }
                      onClick={
                        confirmVariant
                      }
                    >
                      Ajouter au ticket
                    </button>
                  </div>

                </div>
              </>
            )}

          </div>
        </div>
      )}


      {/* =================================
          MODAL TICKET / PAIEMENT / REÇU
      ================================= */}

      {showTicket && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!paying) setShowTicket(false);
          }}
        >
          <div
            className={styles.ticketModal}
            onClick={(e) => e.stopPropagation()}
          >
            {ticketStep === "ticket" && (
              <>
                <div className={styles.ticketModalHeader}>
                  <div>
                    <h2>Ticket</h2>
                    <span>
                      {totalItems} article{totalItems > 1 ? "s" : ""}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setShowTicket(false)}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.ticketItems}>
                  {ticket.length === 0 ? (
                    <div className={styles.emptyTicket}>
                      <div>🛒</div>
                      <p>Le ticket est vide</p>
                      <span>Cliquez sur un produit pour commencer</span>
                    </div>
                  ) : (
                    ticket.map((item, index) => {
                      const lineTotal =
                        Number(item.price || 0) * item.quantity;
                      const baseQuantity = getBaseQuantity(item);

                      return (
                        <div
                          key={`${item.productId}-${item.variantType}`}
                          className={styles.ticketItem}
                        >
                          <div className={styles.ticketItemInfo}>
                            <strong>{item.name}</strong>
                            <span>{item.variantType}</span>
                            <small>
                              {baseQuantity} {item.stockUnit}
                            </small>
                          </div>

                          <div className={styles.ticketItemRight}>
                            <strong>
                              {lineTotal.toLocaleString("fr-FR")} FC
                            </strong>

                            <div className={styles.quantityControls}>
                              <button
                                type="button"
                                onClick={() => decreaseQuantity(index)}
                              >
                                −
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => increaseQuantity(index)}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() => removeFromTicket(index)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.ticketFooter}>
                  {ticket.length > 0 && (
                    <button
                      type="button"
                      className={styles.clearButton}
                      onClick={clearTicket}
                    >
                      Vider le ticket
                    </button>
                  )}

                  <div className={styles.totalRow}>
                    <span>Total</span>
                    <strong className={styles.totalAmount}>
                      {total.toLocaleString("fr-FR")} FC
                    </strong>
                  </div>

                  <div className={styles.ticketMainActions}>
                    <button
                      type="button"
                      className={styles.saveTicketButton}
                      disabled={ticket.length === 0 || savingTicket}
                      onClick={savePendingTicket}
                    >
                      {savingTicket ? "ENREGISTREMENT..." : "ENREGISTRER"}
                    </button>

                    <button
                      type="button"
                      className={styles.payButton}
                      disabled={ticket.length === 0}
                      onClick={openPayment}
                    >
                      PAYER {total.toLocaleString("fr-FR")} FC
                    </button>
                  </div>
                </div>
              </>
            )}

            {ticketStep === "payment" && (
              <>
                <div className={styles.paymentStepHeader}>
                  <button
                    type="button"
                    className={styles.backPaymentButton}
                    onClick={() => setTicketStep("ticket")}
                  >
                    ←
                  </button>
                  <strong>Paiement</strong>
                  <span />
                </div>

                <div className={styles.paymentStepContent}>
                  <div className={styles.paymentTotalBlock}>
                    <strong>{total.toLocaleString("fr-FR")} FC</strong>
                    <span>Montant total</span>
                  </div>

                  <label className={styles.cashReceivedField}>
                    <span>Espèces reçues</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Saisir le montant reçu"
                      autoFocus
                    />
                  </label>

                  <div className={styles.changePreview}>
                    <span>Monnaie à rendre</span>
                    <strong>
                      {Math.max(0, Number(cashReceived || 0) - total).toLocaleString("fr-FR")} FC
                    </strong>
                  </div>

                  <button
                    type="button"
                    className={styles.cashMethodButton}
                    disabled={
                      paying ||
                      !cashReceived ||
                      Number(cashReceived) < total
                    }
                    onClick={handlePayment}
                  >
                    <span className={styles.paymentMethodIcon}>💵</span>
                    <div>
                      <strong>{paying ? "PAIEMENT..." : "ESPÈCES"}</strong>
                      <small>Valider le paiement en espèces</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={styles.cardMethodButton}
                    disabled
                  >
                    <span className={styles.paymentMethodIcon}>💳</span>
                    <div>
                      <strong>CARTE</strong>
                      <small>Bientôt disponible</small>
                    </div>
                  </button>
                </div>
              </>
            )}

            {ticketStep === "receipt" && lastSale && (
              <>
                <div className={styles.receiptHeader}>
                  <div className={styles.receiptSuccess}>✓</div>
                  <h2>Paiement effectué</h2>
                  <p>La vente a été enregistrée avec succès.</p>
                </div>

                <div className={styles.receiptContent}>
                  <div className={styles.receiptAmounts}>
                    <div>
                      <span>Montant de la vente</span>
                      <strong>
                        {lastSale.total.toLocaleString("fr-FR")} FC
                      </strong>
                    </div>
                    <div>
                      <span>Espèces reçues</span>
                      <strong>
                        {lastSale.received.toLocaleString("fr-FR")} FC
                      </strong>
                    </div>
                    <div className={styles.changeAmountRow}>
                      <span>Monnaie à rendre</span>
                      <strong>
                        {lastSale.changeAmount.toLocaleString("fr-FR")} FC
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.printReceiptButton}
                    onClick={printReceipt}
                  >
                    🖨 Imprimer le reçu
                  </button>
                </div>

                <div className={styles.receiptFooter}>
                  <button
                    type="button"
                    className={styles.newSaleButton}
                    onClick={startNewSale}
                  >
                    ✓ NOUVELLE VENTE
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;