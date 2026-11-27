import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {

  collection,

  onSnapshot,

  addDoc,

  serverTimestamp,

  query,

  where,

} from "firebase/firestore";



import { db } from "../../firebase";

import styles from "./reports.module.css";



function Reports() {
  const navigate = useNavigate();

  const [sales, setSales] = useState([]);

  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);

  const [offlineSales, setOfflineSales] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");



  const [period, setPeriod] = useState("today");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");



  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const productsPerPage = 10;

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);



  const [expenseForm, setExpenseForm] = useState({
    label: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
    paymentMethod: "cash",
  });



  const [loadingSales, setLoadingSales] = useState(true);

  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // =========================================================

// SESSION MAGASIN

// =========================================================



const storeSession = useMemo(() => {

  try {

    return JSON.parse(

      localStorage.getItem("storeSession") || "{}"

    );

  } catch (error) {

    console.error(

      "Erreur lecture session magasin :",

      error

    );



    return {};

  }

}, []);



const storeId = storeSession?.storeId || "";



  
const connectedUserId =
  storeSession?.uid || storeSession?.userId || null;
const connectedUserName =
  storeSession?.userName ||
  storeSession?.name ||
  storeSession?.displayName ||
  "Administrateur";
const connectedRole =
  storeSession?.role || storeSession?.userRole || "";
const isAdmin = connectedRole === "admin";

// =========================================================
// CHARGEMENT DES EMPLOYÉS (ADMIN UNIQUEMENT)
// =========================================================

useEffect(() => {
  if (!storeId || !isAdmin) {
    setEmployees([]);
    setSelectedEmployeeId("all");
    return;
  }

  const employeesRef = query(
    collection(db, "users"),
    where("storeId", "==", storeId)
  );

  const unsubscribe = onSnapshot(
    employeesRef,
    (snapshot) => {
      const users = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      // L'administrateur connecté peut ne pas avoir de document users.
      const adminExists = users.some((user) => user.id === connectedUserId);
      const list = [...users];

      if (connectedUserId && !adminExists) {
        list.unshift({
          id: connectedUserId,
          name: connectedUserName,
          role: "admin",
          status: "active",
        });
      }

      setEmployees(
        list.filter((user) =>
          user.role === "admin" ||
          user.role === "manager" ||
          user.role === "cashier"
        )
      );
    },
    (error) => {
      console.error("Erreur chargement employés :", error);
      setEmployees([]);
    }
  );

  return () => unsubscribe();
}, [storeId, isAdmin, connectedUserId, connectedUserName]);
// =========================================================

  // CHARGEMENT DES VENTES

  // =========================================================



  useEffect(() => {

    if (!storeId) {

  setSales([]);

  setLoadingSales(false);

  return;

}



const salesRef = query(

  collection(db, "sales"),

  where("storeId", "==", storeId)

);



    const unsubscribe = onSnapshot(

      salesRef,

      (snapshot) => {

        const data = snapshot.docs.map((doc) => ({

          id: doc.id,

          ...doc.data(),

        }));



        setSales(data);

        setLoadingSales(false);

      },

      (error) => {

        console.error("Erreur chargement ventes :", error);

        setLoadingSales(false);

      }

    );



    return () => unsubscribe();

  }, [storeId]);



  // =========================================================

// CHARGEMENT DES VENTES HORS CONNEXION

// =========================================================



useEffect(() => {

  const loadOfflineSales = () => {

    try {

      const saved = localStorage.getItem(

        "stockManagerOfflineSales"

      );



      const data = saved

        ? JSON.parse(saved)

        : [];



      setOfflineSales(

        Array.isArray(data) ? data : []

      );

    } catch (error) {

      console.error(

        "Erreur chargement ventes hors connexion :",

        error

      );



      setOfflineSales([]);

    }

  };



  loadOfflineSales();



  window.addEventListener(

    "storage",

    loadOfflineSales

  );



  window.addEventListener(

    "focus",

    loadOfflineSales

  );



  return () => {

    window.removeEventListener(

      "storage",

      loadOfflineSales

    );



    window.removeEventListener(

      "focus",

      loadOfflineSales

    );

  };

}, []);



  // =========================================================

  // CHARGEMENT DES DEPENSES

  // =========================================================



  useEffect(() => {

    if (!storeId) {

  setExpenses([]);

  setLoadingExpenses(false);

  return;

}



const expensesRef = query(

  collection(db, "expenses"),

  where("storeId", "==", storeId)

);



    const unsubscribe = onSnapshot(

      expensesRef,

      (snapshot) => {

        const data = snapshot.docs.map((doc) => ({

          id: doc.id,

          ...doc.data(),

        }));



        setExpenses(data);

        setLoadingExpenses(false);

      },

      (error) => {

        console.error("Erreur chargement dépenses :", error);

        setLoadingExpenses(false);

      }

    );



    return () => unsubscribe();

  }, [storeId]);



  // =========================================================
  // CHARGEMENT DU STOCK ACTUEL DU MAGASIN
  // =========================================================

  useEffect(() => {
    if (!storeId || !isAdmin) {
      setProducts([]);
      return;
    }

    const productsRef = query(
      collection(db, "products"),
      where("storeId", "==", storeId)
    );

    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const data = snapshot.docs.map((productDoc) => ({
          id: productDoc.id,
          ...productDoc.data(),
        }));
        setProducts(data);
      },
      (error) => {
        console.error("Erreur chargement du stock :", error);
        setProducts([]);
      }
    );

    return () => unsubscribe();
  }, [storeId, isAdmin]);

  // =========================================================

  // UTILITAIRES DATES

  // =========================================================



  const getDate = (value) => {

    if (!value) return null;



    if (value?.toDate) {

      return value.toDate();

    }



    if (value instanceof Date) {

      return value;

    }



    const date = new Date(value);



    if (Number.isNaN(date.getTime())) {

      return null;

    }



    return date;

  };



  const startOfDay = (date) => {

    const result = new Date(date);

    result.setHours(0, 0, 0, 0);

    return result;

  };



  const endOfDay = (date) => {

    const result = new Date(date);

    result.setHours(23, 59, 59, 999);

    return result;

  };



  // =========================================================

  // PERIODE

  // =========================================================



  const selectedPeriod = useMemo(() => {

    const now = new Date();



    let start;

    let end;



    if (period === "today") {

      start = startOfDay(now);

      end = endOfDay(now);

    }



    if (period === "week") {

      const currentDay = now.getDay();

      const difference = currentDay === 0 ? 6 : currentDay - 1;



      start = new Date(now);

      start.setDate(now.getDate() - difference);

      start = startOfDay(start);



      end = endOfDay(now);

    }



    if (period === "month") {

      start = new Date(now.getFullYear(), now.getMonth(), 1);

      start = startOfDay(start);



      end = endOfDay(now);

    }



    if (period === "custom") {

      if (!startDate || !endDate) {

        return null;

      }



      start = startOfDay(new Date(`${startDate}T00:00:00`));

      end = endOfDay(new Date(`${endDate}T00:00:00`));

    }



    if (!start || !end) {

      return null;

    }



    return {

      start,

      end,

    };

  }, [period, startDate, endDate]);



  // =========================================================

// TOUTES LES VENTES

// FIREBASE + VENTES LOCALES EN ATTENTE

// =========================================================



const allSales = useMemo(() => {

  const firebaseOfflineIds = new Set(

    sales

      .map((sale) => sale.offlineSaleId)

      .filter(Boolean)

  );



  // Évite de compter deux fois une vente qui vient

  // juste d'être synchronisée avec Firebase.

  const pendingOfflineSales =

    offlineSales.filter(

      (sale) =>

        !firebaseOfflineIds.has(

          sale.offlineSaleId

        )

    );



  return [

    ...sales,

    ...pendingOfflineSales,

  ];

}, [sales, offlineSales]);



  // =========================================================

  // VENTES DE LA PERIODE

  // =========================================================



  const periodSales = useMemo(() => {
  if (!selectedPeriod) return [];

  return allSales.filter((sale) => {
    if (sale.status === "cancelled") return false;

    const date = getDate(
      sale.offlineCreatedAt ||
      sale.createdAt ||
      sale.date
    );

    if (!date) return false;

    return date >= selectedPeriod.start && date <= selectedPeriod.end;
  });
}, [allSales, selectedPeriod]);

// Le rapport général inclut toutes les ventes.
// Le filtre individuel utilise l'identifiant réellement enregistré sur la vente.
const filteredSales = useMemo(() => {
  if (!isAdmin || selectedEmployeeId === "all") return periodSales;

  return periodSales.filter((sale) => sale.userId === selectedEmployeeId);
}, [periodSales, isAdmin, selectedEmployeeId]);

  // =========================================================

  // DEPENSES DE LA PERIODE

  // =========================================================



  const filteredExpenses = useMemo(() => {

    if (!selectedPeriod) return [];



    return expenses.filter((expense) => {

      const date = getDate(

        expense.createdAt || expense.date

      );



      if (!date) return false;



      return (

        date >= selectedPeriod.start &&

        date <= selectedPeriod.end

      );

    });

  }, [expenses, selectedPeriod]);



  // =========================================================

  // CHIFFRE D'AFFAIRES

  // =========================================================



  // Valeur commerciale de toutes les ventes de la période,
  // y compris les ventes à crédit ou partiellement payées.
  const totalSales = useMemo(() => {
    return filteredSales.reduce(
      (total, sale) => total + Number(sale.total || 0),
      0
    );
  }, [filteredSales]);

  // Sépare l'argent reçu sur les ventes du jour et les règlements de dettes.
  // Les paiements ajoutés dans paymentHistory sont rattachés à leur date réelle.
  const collectionBreakdown = useMemo(() => {
    const result = { sales: 0, debts: 0, total: 0 };
    if (!selectedPeriod) return result;

    allSales.forEach((sale) => {
      if (sale.status === "cancelled") return;
      if (isAdmin && selectedEmployeeId !== "all" && sale.userId !== selectedEmployeeId) return;

      const saleDate = getDate(sale.offlineCreatedAt || sale.createdAt || sale.date);
      // Une vente est une ancienne dette si elle a été créée avant
      // le début de la période sélectionnée.
      const isPreviousPeriodSale = !saleDate || saleDate < selectedPeriod.start;
      const saleTotal = Math.max(0, Number(sale.total || 0));
      const history = Array.isArray(sale.paymentHistory) ? sale.paymentHistory : [];
      const hasReceived = sale.amountReceived !== undefined && sale.amountReceived !== null;
      const hasCashReceived = sale.cashReceived !== undefined && sale.cashReceived !== null;
      const currentReceived = Number(hasReceived ? sale.amountReceived : hasCashReceived ? sale.cashReceived : 0);
      const historyTotal = history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const status = String(sale.paymentStatus || "").toLowerCase();

      // La part initialement reçue appartient à la date de la vente.
      let initialReceived = 0;
      if (hasReceived || hasCashReceived) {
        initialReceived = history.length ? Math.max(0, currentReceived - historyTotal) : currentReceived;
      } else if (!history.length && status !== "unpaid" && status !== "partial") {
        initialReceived = saleTotal;
      }

      if (saleDate && saleDate >= selectedPeriod.start && saleDate <= selectedPeriod.end) {
        result.sales += initialReceived;
      }

      history.forEach((payment) => {
        const paidAt = getDate(payment.paidAt);
        if (!paidAt || paidAt < selectedPeriod.start || paidAt > selectedPeriod.end) return;
        const amount = Number(payment.amount || 0);
        // Le paiement appartient aux ventes de la période si la vente
        // a été créée pendant cette période. Sinon, c'est une ancienne dette.
        if (isPreviousPeriodSale) {
          result.debts += amount;
        } else {
          result.sales += amount;
        }
      });

      // Anciennes ventes sans paymentHistory : on ne peut pas reconstituer
      // la date exacte d'un paiement différé. On conserve leur montant initial.
      if (!history.length && !saleDate && currentReceived > 0) {
        result.sales += 0;
      }
    });

    result.total = result.sales + result.debts;
    return result;
  }, [allSales, selectedPeriod, isAdmin, selectedEmployeeId]);

  const totalCollected = collectionBreakdown.total;
  const salesCollected = collectionBreakdown.sales;
  const debtCollected = collectionBreakdown.debts;

  // Dette encore due aujourd'hui sur les ventes créées pendant la période.
  // Elle baisse automatiquement lorsqu'un paiement est enregistré plus tard.
  const totalOutstanding = useMemo(() => {
    return filteredSales.reduce((total, sale) => {
      if (sale.status === "cancelled") return total;
      const saleTotal = Math.max(0, Number(sale.total || 0));
      const history = Array.isArray(sale.paymentHistory) ? sale.paymentHistory : [];
      const hasReceived = sale.amountReceived !== undefined && sale.amountReceived !== null;
      const hasCashReceived = sale.cashReceived !== undefined && sale.cashReceived !== null;
      const status = String(sale.paymentStatus || "").toLowerCase();
      let received = 0;
      if (hasReceived || hasCashReceived) {
        received = Number(hasReceived ? sale.amountReceived : sale.cashReceived);
      } else if (history.length) {
        received = history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      } else if (status !== "unpaid" && status !== "partial") {
        received = saleTotal;
      }
      return total + Math.max(0, saleTotal - received);
    }, 0);
  }, [filteredSales]);


  // =========================================================

  // PRODUITS REGROUPES

  // =========================================================



  const productReports = useMemo(() => {
    const productsMap = {};

    filteredSales.forEach((sale) => {
      if (!Array.isArray(sale.items)) return;

      // Reconstituer la répartition des anciens mélanges par paquet.
      // L'ancien POS partageait le prix global à parts égales, ce qui pouvait
      // attribuer artificiellement une recette trop faible à un produit coûteux.
      const mixLineAmounts = new Map();
      const mixGroups = new Map();

      sale.items.forEach((item, index) => {
        if (!item.mixGroupId || item.mixFormat !== "paquet" || item.mixTotalPrice == null) return;
        if (!mixGroups.has(item.mixGroupId)) mixGroups.set(item.mixGroupId, []);
        mixGroups.get(item.mixGroupId).push({ item, index });
      });

      mixGroups.forEach((entries) => {
        const totalMixPrice = Number(entries[0]?.item.mixTotalPrice || 0);
        const totalCost = entries.reduce((sum, entry) => {
          const item = entry.item;
          const quantity = Math.max(0, Number(item.quantity || 0));
          let lineCost = 0;
          if (item.linePurchaseCost != null && Number.isFinite(Number(item.linePurchaseCost))) {
            lineCost = Number(item.linePurchaseCost);
          } else if (item.basePurchasePrice != null) {
            lineCost = Number(item.basePurchasePrice || 0)
              * Math.max(1, Number(item.variantQuantity || 1)) * quantity;
          } else {
            lineCost = Number(item.purchasePrice || 0) * quantity;
          }
          return sum + lineCost;
        }, 0);

        // Si le mélange était globalement vendu au-dessus de son coût,
        // répartir sa recette au prorata des coûts de chaque produit.
        // Si le prix global était inférieur au coût, conserver la perte réelle.
        if (Number.isFinite(totalMixPrice) && totalMixPrice >= totalCost && totalCost > 0) {
          let allocated = 0;
          entries.forEach((entry, index) => {
            const item = entry.item;
            const quantity = Math.max(0, Number(item.quantity || 0));
            const itemCost = item.linePurchaseCost != null && Number.isFinite(Number(item.linePurchaseCost))
              ? Number(item.linePurchaseCost)
              : item.basePurchasePrice != null
                ? Number(item.basePurchasePrice || 0) * Math.max(1, Number(item.variantQuantity || 1)) * quantity
                : Number(item.purchasePrice || 0) * quantity;
            const amount = index === entries.length - 1
              ? Math.round((totalMixPrice - allocated) * 100) / 100
              : Math.round((totalMixPrice * (itemCost / totalCost)) * 100) / 100;
            allocated += amount;
            mixLineAmounts.set(entry.index, amount);
          });
        }
      });

      sale.items.forEach((item, itemIndex) => {
        const productId = item.productId || item.id || `${item.name || "Produit"}`;
        const productName = item.name || item.productName || "Produit";
        const category = item.categoryName || item.category || "Non classé";
        const variantType = item.variantType || item.type || item.stockUnit || "Unité";
        const quantity = Math.max(0, Number(item.quantity || 0));
        const sellingPrice = Number(item.price ?? item.sellingPrice ?? 0);

        // Le montant réel de la ligne est prioritaire : certaines anciennes
        // ventes groupées peuvent avoir un total différent du prix unitaire × quantité.
        const amountSold = mixLineAmounts.has(itemIndex)
          ? mixLineAmounts.get(itemIndex)
          : item.lineTotal !== undefined && item.lineTotal !== null
            && Number.isFinite(Number(item.lineTotal))
            ? Number(item.lineTotal)
            : sellingPrice * quantity;

        let linePurchaseCost;
        if (item.linePurchaseCost !== undefined && item.linePurchaseCost !== null
          && Number.isFinite(Number(item.linePurchaseCost))) {
          linePurchaseCost = Number(item.linePurchaseCost);
        } else if (item.basePurchasePrice !== undefined && item.basePurchasePrice !== null) {
          linePurchaseCost = Number(item.basePurchasePrice || 0)
            * Math.max(1, Number(item.variantQuantity || 1)) * quantity;
        } else {
          // Dans les anciennes ventes du POS, purchasePrice est le coût d'achat
          // d'une variante, et non celui de l'unité de stock de base.
          linePurchaseCost = Number(item.purchasePrice || 0) * quantity;
        }

        const profit = amountSold - linePurchaseCost;

        if (!productsMap[productId]) {
          productsMap[productId] = {
            id: productId,
            name: productName,
            category,
            quantity: 0,
            amountSold: 0,
            profit: 0,
            variants: {},
          };
        }

        const product = productsMap[productId];
        product.quantity += quantity;
        product.amountSold += amountSold;
        product.profit += profit;

        if (!product.variants[variantType]) {
          product.variants[variantType] = {
            type: variantType,
            quantity: 0,
            purchaseCostTotal: 0,
            sellingTotal: 0,
            amountSold: 0,
            profit: 0,
          };
        }

        const variant = product.variants[variantType];
        variant.quantity += quantity;
        variant.purchaseCostTotal += linePurchaseCost;
        variant.sellingTotal += amountSold;
        variant.amountSold += amountSold;
        variant.profit += profit;
      });
    });

    return Object.values(productsMap).map((product) => ({
      ...product,
      variants: Object.values(product.variants).map((variant) => ({
        ...variant,
        // Prix moyens pondérés : ne pas afficher simplement le prix de la dernière vente.
        purchasePrice: variant.quantity > 0
          ? variant.purchaseCostTotal / variant.quantity
          : 0,
        sellingPrice: variant.quantity > 0
          ? variant.sellingTotal / variant.quantity
          : 0,
      })),
    }));
  }, [filteredSales]);

  // =========================================================
  // PAGINATION DES VENTES PAR PRODUIT
  // =========================================================

  const totalProductPages = Math.max(
    1,
    Math.ceil(productReports.length / productsPerPage)
  );

  const paginatedProductReports = useMemo(() => {
    const startIndex = (currentProductPage - 1) * productsPerPage;
    return productReports.slice(startIndex, startIndex + productsPerPage);
  }, [productReports, currentProductPage]);

  useEffect(() => {
    setCurrentProductPage(1);
  }, [period, startDate, endDate, selectedEmployeeId]);

  useEffect(() => {
    if (currentProductPage > totalProductPages) {
      setCurrentProductPage(totalProductPages);
    }
  }, [currentProductPage, totalProductPages]);

  // =========================================================
  // RÉPARTITION DES ENCAISSEMENTS PAR MOYEN DE PAIEMENT
  // =========================================================

  const normalizePaymentMethod = (method) => {
    const value = String(method || "").toLowerCase().trim();
    if (["cash", "espece", "espèces", "especes"].includes(value)) return "cash";
    if (["mobile_money", "mobile money", "mpesa", "orange_money", "airtel_money"].includes(value)) return "mobile_money";
    if (["bank", "transfer", "virement", "banque"].includes(value)) return "bank";
    return "other";
  };

  const paymentBreakdown = useMemo(() => {
    const totals = {
      sales: { cash: 0, mobile_money: 0, bank: 0, other: 0 },
      debts: { cash: 0, mobile_money: 0, bank: 0, other: 0 },
    };
    if (!selectedPeriod) return totals;

    allSales.forEach((sale) => {
      if (sale.status === "cancelled") return;
      if (isAdmin && selectedEmployeeId !== "all" && sale.userId !== selectedEmployeeId) return;
      const saleDate = getDate(sale.offlineCreatedAt || sale.createdAt || sale.date);
      // Même règle que dans collectionBreakdown : on classe selon la date
      // de création de la vente par rapport au début de la période.
      const isPreviousPeriodSale = !saleDate || saleDate < selectedPeriod.start;
      const history = Array.isArray(sale.paymentHistory) ? sale.paymentHistory : [];
      const hasReceived = sale.amountReceived !== undefined && sale.amountReceived !== null;
      const hasCashReceived = sale.cashReceived !== undefined && sale.cashReceived !== null;
      const currentReceived = Number(hasReceived ? sale.amountReceived : hasCashReceived ? sale.cashReceived : 0);
      const historyTotal = history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const status = String(sale.paymentStatus || "").toLowerCase();
      const initialReceived = (hasReceived || hasCashReceived)
        ? (history.length ? Math.max(0, currentReceived - historyTotal) : currentReceived)
        : (!history.length && status !== "unpaid" && status !== "partial" ? Number(sale.total || 0) : 0);

      if (saleDate && saleDate >= selectedPeriod.start && saleDate <= selectedPeriod.end) {
        const method = normalizePaymentMethod(sale.paymentMethod || "cash");
        totals.sales[method] += initialReceived;
      }

      history.forEach((payment) => {
        const paidAt = getDate(payment.paidAt);
        if (!paidAt || paidAt < selectedPeriod.start || paidAt > selectedPeriod.end) return;
        const method = normalizePaymentMethod(payment.method || sale.paymentMethod || "cash");
        const bucket = isPreviousPeriodSale ? "debts" : "sales";
        totals[bucket][method] += Number(payment.amount || 0);
      });
    });
    return totals;
  }, [allSales, selectedPeriod, isAdmin, selectedEmployeeId]);

  const expenseBreakdown = useMemo(() => {
    const totals = { cash: 0, mobile_money: 0, bank: 0, other: 0 };

    filteredExpenses.forEach((expense) => {
      const status = String(expense.status || "active").toLowerCase();
      if (["cancelled", "canceled", "annulled", "deleted"].includes(status)) return;
      const method = normalizePaymentMethod(expense.paymentMethod || expense.paymentType || "cash");
      totals[method] += Number(expense.amount || 0);
    });

    return totals;
  }, [filteredExpenses]);

  const cashNetMovement =
    (paymentBreakdown.sales.cash + paymentBreakdown.debts.cash) - expenseBreakdown.cash;

  // =========================================================

  // BENEFICE GLOBAL

  // =========================================================



  const totalProfit = useMemo(() => {

    return productReports.reduce((total, product) => {

      return total + Number(product.profit || 0);

    }, 0);

  }, [productReports]);



  // =========================================================

  // DEPENSES

  // =========================================================



  const totalExpenses = useMemo(() => {

    return filteredExpenses.reduce((total, expense) => {
      const status = String(expense.status || "active").toLowerCase();
      const isCancelled = ["cancelled", "canceled", "annulled", "deleted"].includes(status);
      if (isCancelled) return total;
      return total + Number(expense.amount || 0);
    }, 0);

  }, [filteredExpenses]);

  // Encaissements réellement reçus pendant la période, moins les dépenses.
  const totalCashAvailable = totalCollected - totalExpenses;


  // =========================================================

  // RESULTAT FINAL

  // =========================================================



  const finalResult =

    totalProfit - totalExpenses;



  // =========================================================

  // ARTICLES VENDUS

  // =========================================================



  const totalItems = useMemo(() => {

    return productReports.reduce((total, product) => {

      return total + Number(product.quantity || 0);

    }, 0);

  }, [productReports]);



  // =========================================================

  // PRODUIT LE PLUS VENDU

  // =========================================================



  const bestSellingProduct = useMemo(() => {

    if (productReports.length === 0) {

      return null;

    }



    return [...productReports].sort(

      (a, b) => b.quantity - a.quantity

    )[0];

  }, [productReports]);



  // =========================================================

  // DEPENSE

  // =========================================================



  const handleExpenseChange = (e) => {

    const { name, value } = e.target;



    setExpenseForm((prev) => ({

      ...prev,

      [name]: value,

    }));

  };



  const handleAddExpense = async (e) => {
    e.preventDefault();

    const reason = expenseForm.label.trim();
    const amount = Number(expenseForm.amount);

    if (!storeId) {
      alert("Magasin introuvable. Veuillez vous reconnecter.");
      return;
    }
    if (!reason) {
      alert("Veuillez entrer le motif de la dépense.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Veuillez entrer un montant valide.");
      return;
    }
    if (!expenseForm.date) {
      alert("Veuillez sélectionner une date.");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        storeId,
        reason,
        amount,
        note: expenseForm.note.trim(),
        paymentMethod: expenseForm.paymentMethod || "cash",
        paymentType: expenseForm.paymentMethod || "cash",
        cashierUserId: connectedUserId,
        cashierName: connectedUserName,
        userId: connectedUserId,
        userName: connectedUserName,
        userRole: connectedRole || "admin",
        date: expenseForm.date,
        createdAt: serverTimestamp(),
        status: "active",
        source: "reports",
      });

      setExpenseForm({
        label: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        note: "",
        paymentMethod: "cash",
      });
      setShowExpenseModal(false);
    } catch (error) {
      console.error("Erreur ajout dépense :", error);
      alert("Impossible d'enregistrer la dépense.");
    }
  };


  // =========================================================

  // FORMAT MONNAIE

  // =========================================================



  const formatMoney = (amount) => {

    return `${Number(amount || 0).toLocaleString(

      "fr-FR"

    )} FC`;

  };



  // =========================================================
  // VALORISATION DU STOCK RESTANT (STOCK ACTUEL)
  // Les variantes représentent des conditionnements alternatifs.
  // On ne cumule donc jamais la valeur bouteille + paquet.
  // =========================================================

  const stockValuation = useMemo(() => {
    const totals = {
      purchase: 0,
      unitSelling: 0,
      packSelling: 0,
      productsCount: products.length,
      missingUnitPrice: 0,
      missingPackPrice: 0,
    };

    products.forEach((product) => {
      const stock = Math.max(0, Number(product.stock || 0));
      const purchasePrice = Math.max(0, Number(product.purchasePrice || 0));

      totals.purchase += stock * purchasePrice;

      const variants = Array.isArray(product.variants)
        ? product.variants.filter((variant) => variant && Number(variant.quantity) > 0)
        : [];

      // Une variante de quantité 1 correspond à l'unité principale
      // (par exemple une bouteille). Les anciens champs sont utilisés
      // uniquement comme solution de repli s'ils existent.
      const unitVariant = variants.find(
        (variant) => Number(variant.quantity) === 1
      );

      const rawUnitPrice =
        unitVariant?.price ?? product.sellingPrice ?? product.price;

      const unitPrice =
        rawUnitPrice !== undefined &&
        rawUnitPrice !== null &&
        Number.isFinite(Number(rawUnitPrice))
          ? Math.max(0, Number(rawUnitPrice))
          : null;

      if (unitPrice !== null) {
        totals.unitSelling += stock * unitPrice;
      } else if (stock > 0) {
        totals.missingUnitPrice += 1;
      }

      // Priorité à une variante nommée paquet/pack/carton.
      // Si aucune n'existe, on prend la première variante supérieure à 1 unité.
      const packVariant =
        variants.find((variant) =>
          /pack|paquet|carton/i.test(String(variant.type || ""))
        ) ||
        variants.find((variant) => Number(variant.quantity) > 1);

      if (packVariant) {
        const unitsPerPack = Number(packVariant.quantity);
        const packPrice = Number(packVariant.price);

        if (
          unitsPerPack > 1 &&
          Number.isFinite(packPrice) &&
          packPrice >= 0
        ) {
          const fullPacks = Math.floor(stock / unitsPerPack);
          const remainingUnits = stock % unitsPerPack;

          // Les paquets complets sont valorisés même si le prix de l'unité
          // restante n'est pas renseigné. Dans ce cas, l'avertissement le signale.
          totals.packSelling +=
            fullPacks * packPrice +
            (unitPrice !== null ? remainingUnits * unitPrice : 0);

          if (remainingUnits > 0 && unitPrice === null) {
            totals.missingPackPrice += 1;
          }
        } else if (stock > 0) {
          totals.missingPackPrice += 1;
        }
      } else if (stock > 0) {
        totals.missingPackPrice += 1;
      }
    });

    return totals;
  }, [products]);

  // =========================================================

  // FORMAT DATE

  // =========================================================



  const formatDate = (value) => {

    const date = getDate(value);



    if (!date) return "-";



    return date.toLocaleDateString("fr-FR");

  };



  // =========================================================

  // CHARGEMENT

  // =========================================================



  if (loadingSales || loadingExpenses) {

    return (

      <div className={styles.loadingPage}>

        <div className={styles.loader}></div>

        <p>Chargement des rapports...</p>

      </div>

    );

  }



  // =========================================================

  // AFFICHAGE

  // =========================================================



  return (

    <div className={styles.reports}>



      {/* =====================================================

          HEADER

      ===================================================== */}
            <header className={styles.retour}>
        
                <button
                  className={styles.backButton}
                  onClick={() =>
                    navigate("/dashboard")
                  }
                >
                  ←
                </button>
        
                <h1>
                  Rapport
                </h1>
        
            </header>


      <div className={styles.header}>

            

          <p>

            Suivez les performances de votre magasin.

          </p>

        <button

          className={styles.expenseButton}

          onClick={() =>

            setShowExpenseModal(true)

          }

        >

          <span>+</span>

          Ajouter une dépense

        </button>

      </div>



      {/* =====================================================

          FILTRES

      ===================================================== */}



      <section className={styles.periodSection}>



        <div className={styles.periodTitle}>



          <div>

            <strong>Période du rapport</strong>

            <small>

              Choisissez la période à analyser

            </small>

          </div>

        </div>



        <div className={styles.periodButtons}>



          <button

            className={

              period === "today"

                ? styles.periodActive

                : styles.periodButton

            }

            onClick={() => setPeriod("today")}

          >

            Aujourd'hui

          </button>



          <button

            className={

              period === "week"

                ? styles.periodActive

                : styles.periodButton

            }

            onClick={() => setPeriod("week")}

          >

            Cette semaine

          </button>



          <button

            className={

              period === "month"

                ? styles.periodActive

                : styles.periodButton

            }

            onClick={() => setPeriod("month")}

          >

            Ce mois

          </button>



          <button

            className={

              period === "custom"

                ? styles.periodActive

                : styles.periodButton

            }

            onClick={() => setPeriod("custom")}

          >

            Période personnalisée

          </button>



        </div>



        {isAdmin && (
          <div className={styles.employeeFilter}>
            <label htmlFor="reportEmployee">Rapport par employé</label>
            <select
              id="reportEmployee"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="all">Tous les employés </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name || employee.userName || "Employé sans nom"}
                  {employee.role === "admin" ? " (Administrateur)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {period === "custom" && (

          <div className={styles.customDates}>



            <div>

              <label>

                Date de début

              </label>



              <input

                type="date"

                value={startDate}

                onChange={(e) =>

                  setStartDate(e.target.value)

                }

              />

            </div>



            <div>

              <label>

                Date de fin

              </label>



              <input

                type="date"

                value={endDate}

                onChange={(e) =>

                  setEndDate(e.target.value)

                }

              />

            </div>



          </div>

        )}



      </section>



      {/* =====================================================

          STATISTIQUES

      ===================================================== */}



      <section className={styles.statsGrid}>



        <div className={styles.statCard}>

          <div>

            <span>Valeur totale des ventes</span>

            <strong>

              {formatMoney(totalSales)}

            </strong>

          </div>

        </div>



        <div className={styles.statCard}>
          <div>
            <span>Argent encaissé sur les ventes de la période</span>
            <strong>{formatMoney(salesCollected)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 11 }}>
              Argent reçu directement lors des ventes de cette période
            </small>
          </div>
        </div>

        <div className={styles.statCard}>
          <div>
            <span>Dettes restantes sur les ventes de la période</span>
            <strong>{formatMoney(totalOutstanding)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 11 }}>
              Solde encore dû aujourd'hui pour ces ventes. Il diminue lorsqu'un client paie plus tard.
            </small>
          </div>
        </div>

        <div className={styles.statCard}>
          <div>
            <span>Dettes encaissées pendant la période</span>
            <strong>{formatMoney(debtCollected)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 11 }}>
              Paiements reçus aujourd'hui pour des ventes faites auparavant
            </small>
          </div>
        </div>

        <div className={styles.statCard}>
          <div>
            <span>Total de tous les encaissements</span>
            <strong>{formatMoney(totalCollected)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 11 }}>
              Encaissements des ventes + règlements des dettes
            </small>
          </div>
        </div>

        <div className={styles.statCard}>
          <div>

            <span>Bénéfice généré</span>

            <strong>

              {formatMoney(totalProfit)}

            </strong>

          </div>

        </div>



        <div className={styles.statCard}>
          <div>

            <span>Dépenses</span>

            <strong>

              {formatMoney(totalExpenses)}

            </strong>

          </div>

        </div>



        <div className={styles.statCard}>

          <div>

            <span>Ventes effectuées</span>

            <strong>

              {filteredSales.length}

            </strong>

          </div>

        </div>



      </section>

      {/* =====================================================
          VALORISATION DU STOCK RESTANT — ADMIN UNIQUEMENT
      ===================================================== */}
      {isAdmin && (
        <section style={{
          margin: "26px 0",
          padding: "24px",
          borderRadius: 22,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          boxShadow: "0 8px 26px rgba(15, 23, 42, .06)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap", marginBottom: 22,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
              <div style={{
                width: 46, height: 46, flex: "0 0 46px", display: "grid", placeItems: "center",
                borderRadius: 15, background: "#e0e7ff", color: "#3730a3", fontSize: 23,
              }}>📦</div>
              <div>
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 5 }}>
                  Situation des marchandises
                </div>
                <h2 style={{ margin: 0, color: "#0f172a", fontSize: 21, fontWeight: 800 }}>
                  Valorisation du stock restant
                </h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.5, maxWidth: 620 }}>
                  Estimation de la valeur des produits encore disponibles, selon leur coût d'achat et leurs différents prix de vente.
                </p>
              </div>
            </div>
            <div style={{ padding: "9px 13px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0", color: "#475569", fontSize: 12, fontWeight: 700 }}>
              {stockValuation.productsCount} produit(s) dans le stock
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div style={{ padding: 20, borderRadius: 17, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 3px 10px rgba(15,23,42,.035)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 10, background: "#f1f5f9", fontSize: 17 }}>🧾</span>
                VALEUR AU PRIX D'ACHAT
              </div>
              <strong style={{ display: "block", margin: "16px 0 7px", color: "#0f172a", fontSize: 25, lineHeight: 1.2, letterSpacing: "-.5px" }}>{formatMoney(stockValuation.purchase)}</strong>
              <span style={{ color: "#64748b", fontSize: 12 }}>Combien le stock restant a coûté à l'achat</span>
            </div>

            <div style={{ padding: 20, borderRadius: 17, background: "#eff6ff", border: "1px solid #bfdbfe", boxShadow: "0 3px 10px rgba(30,64,175,.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>
                <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 10, background: "#dbeafe", fontSize: 17 }}>🧴</span>
                VALEUR À LA VENTE À L'UNITÉ
              </div>
              <strong style={{ display: "block", margin: "16px 0 7px", color: "#1e3a8a", fontSize: 25, lineHeight: 1.2, letterSpacing: "-.5px" }}>{formatMoney(stockValuation.unitSelling)}</strong>
              <span style={{ color: "#1d4ed8", fontSize: 12 }}>Si tout le stock est vendu à l'unité</span>
            </div>

            <div style={{ padding: 20, borderRadius: 17, background: "#ecfdf5", border: "1px solid #a7f3d0", boxShadow: "0 3px 10px rgba(6,95,70,.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#047857", fontSize: 12, fontWeight: 800 }}>
                <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 10, background: "#d1fae5", fontSize: 17 }}>📦</span>
                VALEUR À LA VENTE PAR PAQUET
              </div>
              <strong style={{ display: "block", margin: "16px 0 7px", color: "#065f46", fontSize: 25, lineHeight: 1.2, letterSpacing: "-.5px" }}>{formatMoney(stockValuation.packSelling)}</strong>
              <span style={{ color: "#047857", fontSize: 12 }}>Paquets complets + unités restantes</span>
            </div>
          </div>

          {(stockValuation.missingUnitPrice > 0 || stockValuation.missingPackPrice > 0) && (
            <div style={{ marginTop: 16, padding: "12px 15px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12, lineHeight: 1.5 }}>
              ⚠️ Certains produits n'ont pas toutes les informations de prix ou de conditionnement. Leur valeur correspondante peut manquer dans le calcul. Vérifie leurs prix et variantes.
            </div>
          )}
          <div style={{ marginTop: 17, padding: "13px 15px", borderRadius: 12, background: "#eef2ff", color: "#3730a3", fontSize: 12, lineHeight: 1.6 }}>
            <strong>Comment lire ces montants ?</strong> La valeur d'achat représente le coût du stock restant. Les deux valeurs de vente sont des estimations alternatives : l'une si tout est vendu à l'unité, l'autre si les produits sont vendus par paquet. <strong>Ne les additionne pas.</strong> Le calcul utilise le stock actuel, pas uniquement les mouvements de la période sélectionnée.
          </div>
        </section>
      )}

      <section
        style={{
          margin: "18px 0",
          padding: "20px",
          border: "1px solid #dbeafe",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: "#1e3a8a", fontSize: 18 }}>
            Détail des mouvements financiers
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
            Les encaissements des ventes et les règlements des anciennes dettes sont séparés pour éviter de mélanger le chiffre d'affaires du jour.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ padding: 15, borderRadius: 13, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <strong style={{ color: "#1e40af", fontSize: 14 }}>1. Encaissements des ventes de la période</strong>
            {[["Espèces", paymentBreakdown.sales.cash], ["Mobile Money", paymentBreakdown.sales.mobile_money], ["Banque / Virement", paymentBreakdown.sales.bank], ["Autres", paymentBreakdown.sales.other]].map(([label, amount]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 9, color: "#334155", fontSize: 13 }}><span>{label}</span><strong>{formatMoney(amount)}</strong></div>
            ))}
          </div>
          <div style={{ padding: 15, borderRadius: 13, background: "#fff7ed", border: "1px solid #fed7aa" }}>
            <strong style={{ color: "#9a3412", fontSize: 14 }}>2. Règlements des dettes</strong>
            {[["Espèces", paymentBreakdown.debts.cash], ["Mobile Money", paymentBreakdown.debts.mobile_money], ["Banque / Virement", paymentBreakdown.debts.bank], ["Autres", paymentBreakdown.debts.other]].map(([label, amount]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 9, color: "#334155", fontSize: 13 }}><span>{label}</span><strong>{formatMoney(amount)}</strong></div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 13, padding: 13, borderRadius: 12, background: "#f8fafc", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <strong>Total encaissé pendant la période</strong>
          <strong>{formatMoney(totalCollected)}</strong>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#334155" }}>Dépenses par moyen de paiement</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              ["Espèces", expenseBreakdown.cash],
              ["Mobile Money", expenseBreakdown.mobile_money],
              ["Banque / Virement", expenseBreakdown.bank],
              ["Autres moyens", expenseBreakdown.other],
            ].map(([label, amount]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ color: "#475569" }}>{label}</span>
                <strong>{formatMoney(amount)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: 15,
          borderRadius: 12,
          background: "#f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div>
            <strong style={{ display: "block", color: "#0f172a" }}>Solde net des mouvements en espèces</strong>
            <small style={{ color: "#64748b" }}>Espèces encaissées moins dépenses payées en espèces. Hors fond de caisse initial et retraits non enregistrés.</small>
          </div>
          <strong style={{ color: cashNetMovement >= 0 ? "#15803d" : "#b91c1c", fontSize: 20 }}>
            {formatMoney(cashNetMovement)}
          </strong>
        </div>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 13, background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong style={{ display: "block", color: "#065f46" }}>Argent total restant après dépenses</strong>
            <small style={{ color: "#047857" }}>Tous les encaissements de la période (ventes + dettes réglées) moins toutes les dépenses de la période. Ce montant n'inclut pas le fond de caisse initial.</small>
          </div>
          <strong style={{ color: totalCashAvailable >= 0 ? "#047857" : "#b91c1c", fontSize: 21 }}>{formatMoney(totalCashAvailable)}</strong>
        </div>
      </section>

      {/* =====================================================

          INFOS RAPIDES

      ===================================================== */}



      <section className={styles.quickStats}>



        <div>

          <span>Articles vendus</span>

          <strong>{totalItems}</strong>

        </div>



        <div>

          <span>Produits vendus</span>

          <strong>

            {productReports.length}

          </strong>

        </div>



        <div>

          <span>Produit le plus vendu</span>



          <strong>

            {bestSellingProduct

              ? bestSellingProduct.name

              : "Aucun"}

          </strong>



          {bestSellingProduct && (

            <small>

              {bestSellingProduct.quantity} article(s)

            </small>

          )}

        </div>



      </section>



      {/* =====================================================

          TABLEAU PRODUITS

      ===================================================== */}



      <section className={styles.productsSection}>



        <div className={styles.sectionHeader}>

          <div>

            <span className={styles.sectionLabel}>

              PERFORMANCES

            </span>



            <h2>Ventes par produit</h2>



            <p>

              Cliquez sur un produit pour voir

              le détail de ses variantes.

            </p>

          </div>



          <span className={styles.productCount}>

            {productReports.length} produit

            {productReports.length > 1

              ? "s"

              : ""}

          </span>

        </div>



        {productReports.length === 0 ? (

          <div className={styles.emptyState}>

            <h3>

              Aucune vente pour cette période

            </h3>



            <p>

              Les produits vendus apparaîtront

              ici automatiquement.

            </p>

          </div>

        ) : (
          <>
          <div className={styles.tableWrapper}>



            <table className={styles.productsTable}>



              <thead>

                <tr>

                  <th>Produit</th>

                  <th>Catégorie</th>

                  <th>Quantité</th>

                  <th>Montant vendu</th>

                  <th>Bénéfice</th>

                </tr>

              </thead>



              <tbody>



                {paginatedProductReports.map((product) => (

                  <tr

                    key={product.id}

                    onClick={() =>

                      setSelectedProduct(product)

                    }

                    className={styles.clickableRow}

                  >



                    <td>

                      <div

                        className={

                          styles.productNameCell

                        }

                      >

                        



                        <div>

                          <strong>

                            {product.name}

                          </strong>



                          {product.variants.length >

                            1 && (

                            <small>

                              {

                                product.variants

                                  .length

                              } variantes

                            </small>

                          )}

                        </div>

                      </div>

                    </td>



                    <td>

                      <span

                        className={

                          styles.categoryBadge

                        }

                      >

                        {product.category}

                      </span>

                    </td>



                    <td>

                      <strong>

                        {product.quantity}

                      </strong>

                    </td>



                    <td>

                      <strong>

                        {formatMoney(

                          product.amountSold

                        )}

                      </strong>

                    </td>



                    <td>

                      <strong

                        className={

                          product.profit >= 0

                            ? styles.profitPositive

                            : styles.profitNegative

                        }

                      >

                        {formatMoney(

                          product.profit

                        )}

                      </strong>

                    </td>



                  </tr>

                ))}



              </tbody>



            </table>

          </div>

          {totalProductPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                padding: "18px 0 4px",
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentProductPage((page) => Math.max(1, page - 1))}
                disabled={currentProductPage === 1}
                style={{
                  padding: "8px 13px",
                  border: "1px solid #d5deea",
                  borderRadius: "8px",
                  background: currentProductPage === 1 ? "#f1f4f8" : "#fff",
                  color: currentProductPage === 1 ? "#9aa5b4" : "#263445",
                  cursor: currentProductPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                Précédent
              </button>

              {Array.from({ length: totalProductPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentProductPage(page)}
                  aria-current={currentProductPage === page ? "page" : undefined}
                  style={{
                    minWidth: "36px",
                    padding: "8px 11px",
                    border: "1px solid #d5deea",
                    borderRadius: "8px",
                    background: currentProductPage === page ? "#2563eb" : "#fff",
                    color: currentProductPage === page ? "#fff" : "#263445",
                    fontWeight: currentProductPage === page ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentProductPage((page) => Math.min(totalProductPages, page + 1))}
                disabled={currentProductPage === totalProductPages}
                style={{
                  padding: "8px 13px",
                  border: "1px solid #d5deea",
                  borderRadius: "8px",
                  background: currentProductPage === totalProductPages ? "#f1f4f8" : "#fff",
                  color: currentProductPage === totalProductPages ? "#9aa5b4" : "#263445",
                  cursor: currentProductPage === totalProductPages ? "not-allowed" : "pointer",
                }}
              >
                Suivant
              </button>
            </div>
          )}
          </>
        )}



      </section>



      {/* =====================================================

          DEPENSES

      ===================================================== */}



      <section className={styles.expensesSection}>



        <div className={styles.sectionHeader}>

          <div>

            <span className={styles.sectionLabel}>

              CHARGES

            </span>



            <h2>Dépenses</h2>



            <p>

              Dépenses enregistrées pendant

              la période sélectionnée.

            </p>

          </div>



          <button

            className={styles.smallAddButton}

            onClick={() =>

              setShowExpenseModal(true)

            }

          >

            + Ajouter

          </button>

        </div>



        {filteredExpenses.length === 0 ? (

          <div className={styles.emptyExpense}>

            Aucune dépense enregistrée

            pour cette période.

          </div>

        ) : (

          <div className={styles.expenseTable}>



            <div

              className={

                styles.expenseTableHeader

              }

            >

              <span>Date</span>

              <span>Dépense</span>

              <span>Montant</span>

            </div>



            {filteredExpenses.map((expense) => {
              const status = String(expense.status || "active").toLowerCase();
              const cancelled = ["cancelled", "canceled", "annulled", "deleted"].includes(status);
              const expenseReason = expense.reason || expense.label || "Dépense sans motif";
              return (
                <div
                  className={`${styles.expenseRow} ${cancelled ? styles.expenseCancelled : ""}`}
                  key={expense.id}
                >
                  <span>{formatDate(expense.createdAt || expense.date)}</span>
                  <div className={styles.expenseDescription}>
                    <strong>{expenseReason}</strong>
                    <small>{expense.cashierName || expense.userName || "Utilisateur non renseigné"}</small>
                    {cancelled && <span className={styles.expenseStatus}>Annulée</span>}
                  </div>
                  <strong className={styles.expenseAmount}>{formatMoney(expense.amount)}</strong>
                  <button
                    type="button"
                    className={styles.expenseDetailsButton}
                    onClick={() => setSelectedExpense(expense)}
                  >Voir détails</button>
                </div>
              );
            })}



          </div>

        )}



      </section>



      {/* =====================================================

          BILAN FINAL

      ===================================================== */}



      <section className={styles.balanceSection}>



        <div className={styles.balanceTop}>



          <div>

            <span className={styles.sectionLabel}>

              RÉSULTAT

            </span>



            <h2>Bilan final</h2>



            <p>

              Bénéfice généré après déduction

              des dépenses.

            </p>

          </div>



          <div className={styles.balanceIcon}>

            📊

          </div>



        </div>



        <div className={styles.balanceContent}>



          <div className={styles.balanceLine}>

            <span>Chiffre d'affaires</span>



            <strong>

              {formatMoney(totalSales)}

            </strong>

          </div>



          <div className={styles.balanceLine}>

            <span>Bénéfice généré</span>



            <strong>

              {formatMoney(totalProfit)}

            </strong>

          </div>



          <div

            className={

              styles.balanceLine

            }

          >

            <span>Moins dépenses</span>



            <strong className={styles.expenseText}>

              - {formatMoney(totalExpenses)}

            </strong>

          </div>



          <div

            className={

              finalResult >= 0

                ? styles.resultGain

                : styles.resultLoss

            }

          >



            <div>

              <span>

                {finalResult >= 0

                  ? "GAIN FINAL"

                  : "PERTE FINALE"}

              </span>



              <small>

                Résultat de la période

              </small>

            </div>



            <strong>

              {formatMoney(

                Math.abs(finalResult)

              )}

            </strong>



          </div>



        </div>



      </section>



      {/* =====================================================

          MODAL DETAIL PRODUIT

      ===================================================== */}



      {selectedProduct && (

        <div

          className={styles.modalOverlay}

          onClick={() =>

            setSelectedProduct(null)

          }

        >



          <div

            className={

              styles.productDetailModal

            }

            onClick={(e) =>

              e.stopPropagation()

            }

          >



            <div

              className={

                styles.modalProductHeader

              }

            >



              <div>

                <span

                  className={

                    styles.sectionLabel

                  }

                >

                  DÉTAIL DU PRODUIT

                </span>



                <h2>

                  {selectedProduct.name}

                </h2>



                <p>

                  {selectedProduct.category}

                </p>

              </div>



              <button

                className={styles.closeButton}

                onClick={() =>

                  setSelectedProduct(null)

                }

              >

                ✕

              </button>



            </div>



            <div

              className={

                styles.productSummary

              }

            >



              <div>

                <span>

                  Quantité totale

                </span>



                <strong>

                  {selectedProduct.quantity}

                </strong>

              </div>



              <div>

                <span>

                  Montant vendu

                </span>



                <strong>

                  {formatMoney(

                    selectedProduct.amountSold

                  )}

                </strong>

              </div>



              <div>

                <span>

                  Bénéfice

                </span>



                <strong

                  className={

                    styles.profitPositive

                  }

                >

                  {formatMoney(

                    selectedProduct.profit

                  )}

                </strong>

              </div>



            </div>



            <div

              className={

                styles.variantDetailTitle

              }

            >

              <h3>

                Détail par variante

              </h3>



              <span>

                {selectedProduct.variants.length}{" "}

                variante

                {selectedProduct.variants.length >

                1

                  ? "s"

                  : ""}

              </span>

            </div>



            <div

              className={

                styles.variantTableWrapper

              }

            >



              <table

                className={

                  styles.variantTable

                }

              >



                <thead>

                  <tr>

                    <th>Variante</th>

                    <th>Prix achat</th>

                    <th>Prix vente</th>

                    <th>Qté</th>

                    <th>Montant</th>

                    <th>Bénéfice</th>

                  </tr>

                </thead>



                <tbody>



                  {selectedProduct.variants.map(

                    (variant, index) => (

                      <tr key={index}>



                        <td>

                          <strong>

                            {variant.type}

                          </strong>

                        </td>



                        <td>

                          {formatMoney(

                            variant.purchasePrice

                          )}

                        </td>



                        <td>

                          {formatMoney(

                            variant.sellingPrice

                          )}

                        </td>



                        <td>

                          {variant.quantity}

                        </td>



                        <td>

                          {formatMoney(

                            variant.amountSold

                          )}

                        </td>



                        <td>

                          <strong

                            className={

                              variant.profit >= 0

                                ? styles.profitPositive

                                : styles.profitNegative

                            }

                          >

                            {formatMoney(

                              variant.profit

                            )}

                          </strong>

                        </td>



                      </tr>

                    )

                  )}



                </tbody>



              </table>



            </div>



            <div

              className={

                styles.modalFooter

              }

            >

              <button

                onClick={() =>

                  setSelectedProduct(null)

                }

              >

                Fermer

              </button>

            </div>



          </div>



        </div>

      )}



      {/* =====================================================
          MODAL DÉTAILS D'UNE DÉPENSE
      ===================================================== */}
      {selectedExpense && (
        <div className={styles.modalOverlay} onClick={() => setSelectedExpense(null)}>
          <div className={styles.expenseDetailModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalProductHeader}>
              <div>
                <span className={styles.sectionLabel}>INFORMATIONS DE LA DÉPENSE</span>
                <h2>{selectedExpense.reason || selectedExpense.label || "Dépense"}</h2>
                <p>{formatDate(selectedExpense.createdAt || selectedExpense.date)}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setSelectedExpense(null)}>✕</button>
            </div>
            <div className={styles.expenseDetailGrid}>
              <div><span>Montant</span><strong className={styles.expenseAmount}>{formatMoney(selectedExpense.amount)}</strong></div>
              <div><span>Moyen de paiement</span><strong>{({ cash: "Espèces", mobile_money: "Mobile Money", bank: "Banque / Virement", other: "Autre" })[selectedExpense.paymentMethod] || selectedExpense.paymentMethod || "Non renseigné"}</strong></div>
              <div><span>Employé / Caissier</span><strong>{selectedExpense.cashierName || selectedExpense.userName || "Non renseigné"}</strong></div>
              <div><span>Identifiant utilisateur</span><strong>{selectedExpense.userId || "Non renseigné"}</strong></div>
              <div><span>Rôle</span><strong>{selectedExpense.userRole || "Non renseigné"}</strong></div>
              <div><span>Session de caisse</span><strong>{selectedExpense.cashSessionId || "Non associée"}</strong></div>
              <div><span>Statut</span><strong>{["cancelled", "canceled", "annulled", "deleted"].includes(String(selectedExpense.status || "active").toLowerCase()) ? "Annulée" : "Active"}</strong></div>
              <div><span>Enregistrée le</span><strong>{formatDate(selectedExpense.createdAt || selectedExpense.date)}</strong></div>
              <div className={styles.expenseDetailNote}><span>Note / Justification</span><p>{selectedExpense.note || "Aucune note complémentaire."}</p></div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setSelectedExpense(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================

          MODAL AJOUT DEPENSE

      ===================================================== */}



      {showExpenseModal && (

        <div

          className={styles.modalOverlay}

          onClick={() =>

            setShowExpenseModal(false)

          }

        >



          <div

            className={

              styles.expenseModal

            }

            onClick={(e) =>

              e.stopPropagation()

            }

          >



            <div

              className={

                styles.modalProductHeader

              }

            >



              <div>

                <span

                  className={

                    styles.sectionLabel

                  }

                >

                  NOUVELLE DÉPENSE

                </span>



                <h2>

                  Ajouter une dépense

                </h2>



                <p>

                  Enregistrez une dépense

                  du magasin.

                </p>

              </div>



              <button

                className={styles.closeButton}

                onClick={() =>

                  setShowExpenseModal(false)

                }

              >

                ✕

              </button>



            </div>



            <form

              className={styles.expenseForm}

              onSubmit={handleAddExpense}

            >



              <div>

                <label>

                  Motif de la dépense

                </label>



                <input

                  type="text"

                  name="label"

                  placeholder="Ex : Transport"

                  value={

                    expenseForm.label

                  }

                  onChange={

                    handleExpenseChange

                  }

                />

              </div>



              <div>

                <label>

                  Montant

                </label>



                <input

                  type="number"

                  name="amount"

                  min="0"

                  placeholder="Ex : 5000"

                  value={

                    expenseForm.amount

                  }

                  onChange={

                    handleExpenseChange

                  }

                />

              </div>



              <div>
                <label>Note complémentaire</label>
                <textarea
                  name="note"
                  rows="3"
                  placeholder="Précision sur cette dépense (facultatif)"
                  value={expenseForm.note}
                  onChange={handleExpenseChange}
                />
              </div>

              <div>
                <label>Moyen de paiement</label>
                <select
                  name="paymentMethod"
                  value={expenseForm.paymentMethod}
                  onChange={handleExpenseChange}
                >
                  <option value="cash">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Banque / Virement</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div>

                <label>

                  Date

                </label>



                <input

                  type="date"

                  name="date"

                  value={

                    expenseForm.date

                  }

                  onChange={

                    handleExpenseChange

                  }

                />

              </div>



              <div

                className={

                  styles.formActions

                }

              >



                <button

                  type="button"

                  onClick={() =>

                    setShowExpenseModal(

                      false

                    )

                  }

                >

                  Annuler

                </button>



                <button type="submit">

                  Enregistrer

                </button>



              </div>



            </form>



          </div>



        </div>

      )}



    </div>

  );

}



export default Reports;