import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./reports.module.css";

function Reports() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [period, setPeriod] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    label: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // =========================================================
  // CHARGEMENT DES VENTES
  // =========================================================

  useEffect(() => {
    const salesRef = collection(db, "sales");

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
  }, []);

  // =========================================================
  // CHARGEMENT DES DEPENSES
  // =========================================================

  useEffect(() => {
    const expensesRef = collection(db, "expenses");

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
  }, []);

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
  // VENTES DE LA PERIODE
  // =========================================================

  const filteredSales = useMemo(() => {
    if (!selectedPeriod) return [];

    return sales.filter((sale) => {
      const date = getDate(sale.createdAt || sale.date);

      if (!date) return false;

      return (
        date >= selectedPeriod.start &&
        date <= selectedPeriod.end
      );
    });
  }, [sales, selectedPeriod]);

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
    return filteredSales.reduce((total, sale) => {
      return total + Number(sale.total || 0);
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

    const label = expenseForm.label.trim();
    const amount = Number(expenseForm.amount);

    if (!label) {
      alert("Veuillez entrer le nom de la dépense.");
      return;
    }

    if (!amount || amount <= 0) {
      alert("Veuillez entrer un montant valide.");
      return;
    }

    if (!expenseForm.date) {
      alert("Veuillez sélectionner une date.");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        label,
        amount,
        date: expenseForm.date,
        createdAt: serverTimestamp(),
      });

      setExpenseForm({
        label: "",
        amount: "",
        date: new Date()
          .toISOString()
          .split("T")[0],
      });

      setShowExpenseModal(false);
    } catch (error) {
      console.error(
        "Erreur ajout dépense :",
        error
      );

      alert(
        "Impossible d'enregistrer la dépense."
      );
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

      <header className={styles.header}>
        <div>
          <span className={styles.pageLabel}>
            ANALYSE
          </span>

          <h1>Rapports</h1>

          <p>
            Suivez les performances de votre magasin.
          </p>
        </div>

        <button
          className={styles.expenseButton}
          onClick={() =>
            setShowExpenseModal(true)
          }
        >
          <span>+</span>
          Ajouter une dépense
        </button>
      </header>

      {/* =====================================================
          FILTRES
      ===================================================== */}

      <section className={styles.periodSection}>

        <div className={styles.periodTitle}>
          <span>📅</span>

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
          <div className={styles.statIcon}>
            💰
          </div>

          <div>
            <span>Chiffre d'affaires</span>
            <strong>
              {formatMoney(totalSales)}
            </strong>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            📈
          </div>

          <div>
            <span>Bénéfice généré</span>
            <strong>
              {formatMoney(totalProfit)}
            </strong>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            💸
          </div>

          <div>
            <span>Dépenses</span>
            <strong>
              {formatMoney(totalExpenses)}
            </strong>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            🧾
          </div>

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
            <div>📊</div>

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
                        <div
                          className={
                            styles.productMiniIcon
                          }
                        >
                          📦
                        </div>

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

            {filteredExpenses.map((expense) => (
              <div
                className={styles.expenseRow}
                key={expense.id}
              >

                <span>
                  {formatDate(
                    expense.createdAt ||
                      expense.date
                  )}
                </span>

                <strong>
                  {expense.label}
                </strong>

                <strong className={styles.expenseAmount}>
                  {formatMoney(
                    expense.amount
                  )}
                </strong>

              </div>
            ))}

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
                  Libellé de la dépense
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