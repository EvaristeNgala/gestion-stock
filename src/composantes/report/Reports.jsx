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

  const [offlineSales, setOfflineSales] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");



  const [period, setPeriod] = useState("today");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");



  const [selectedProduct, setSelectedProduct] = useState(null);

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



  const totalSales = useMemo(() => {
    return filteredSales.reduce((total, sale) => total + Number(sale.total || 0), 0);
  }, [filteredSales]);

  // Argent réellement reçu : les ventes à crédit non encore réglées ne sont pas encaissées.
  const totalCollected = useMemo(() => {
    if (!selectedPeriod) return 0;
    return allSales.reduce((total, sale) => {
      if (sale.status === "cancelled") return total;
      if (isAdmin && selectedEmployeeId !== "all" && sale.userId !== selectedEmployeeId) return total;
      if (Array.isArray(sale.paymentHistory)) {
        const paymentsInPeriod = sale.paymentHistory.reduce((sum, payment) => {
          const paidAt = getDate(payment.paidAt);
          if (!paidAt || paidAt < selectedPeriod.start || paidAt > selectedPeriod.end) return sum;
          return sum + Number(payment.amount || 0);
        }, 0);
        return total + paymentsInPeriod;
      }
      const saleDate = getDate(sale.offlineCreatedAt || sale.createdAt || sale.date);
      if (!saleDate || saleDate < selectedPeriod.start || saleDate > selectedPeriod.end) return total;
      return total + Number(sale.amountReceived ?? sale.cashReceived ?? sale.total ?? 0);
    }, 0);
  }, [allSales, selectedPeriod, isAdmin, selectedEmployeeId]);

  const totalOutstanding = useMemo(() => {
    return filteredSales.reduce((total, sale) => {
      const remaining = sale.remainingAmount ?? Math.max(0, Number(sale.total || 0) - Number(sale.amountReceived ?? sale.cashReceived ?? sale.total ?? 0));
      return total + Number(remaining || 0);
    }, 0);
  }, [filteredSales]);



  // =========================================================

  // PRODUITS REGROUPES

  // =========================================================



  const productReports = useMemo(() => {

    const productsMap = {};



    filteredSales.forEach((sale) => {

      if (!Array.isArray(sale.items)) return;



      sale.items.forEach((item) => {

        const productId =

          item.productId ||

          item.id ||

          `${item.name || "Produit"}`;



        const productName =

          item.name ||

          item.productName ||

          "Produit";



        const category =

          item.categoryName ||

          item.category ||

          "Non classé";



        const variantType =

          item.variantType ||

          item.type ||

          item.stockUnit ||

          "Unité";



        const quantity = Number(item.quantity || 0);



        const sellingPrice = Number(

          item.price ||

          item.sellingPrice ||

          0

        );



        const purchasePrice = Number(

          item.purchasePrice || 0

        );



        const amountSold =

          sellingPrice * quantity;



        const profit =

          (sellingPrice - purchasePrice) *

          quantity;



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



        productsMap[productId].quantity += quantity;

        productsMap[productId].amountSold += amountSold;

        productsMap[productId].profit += profit;



        // -----------------------------------------------------

        // DETAIL VARIANTE

        // -----------------------------------------------------



        const variantKey = variantType;



        if (

          !productsMap[productId].variants[variantKey]

        ) {

          productsMap[productId].variants[variantKey] = {

            type: variantType,

            quantity: 0,

            purchasePrice: 0,

            sellingPrice: sellingPrice,

            amountSold: 0,

            profit: 0,

          };

        }



        const variant =

          productsMap[productId].variants[variantKey];



        variant.quantity += quantity;



        variant.purchasePrice = purchasePrice;

        variant.sellingPrice = sellingPrice;



        variant.amountSold += amountSold;

        variant.profit += profit;

      });

    });



    return Object.values(productsMap).map((product) => ({

      ...product,

      variants: Object.values(product.variants),

    }));

  }, [filteredSales]);



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
            <span>Montant encaissé</span>
            <strong>{formatMoney(totalCollected)}</strong>
          </div>
        </div>

        <div className={styles.statCard}>
          <div>
            <span>Reste à encaisser</span>
            <strong>{formatMoney(totalOutstanding)}</strong>
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



                {productReports.map((product) => (

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