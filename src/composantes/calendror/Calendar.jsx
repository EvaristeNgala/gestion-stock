import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./calendar.module.css";

// =========================================================
// VENTES HORS CONNEXION
// =========================================================

const OFFLINE_SALES_KEY = "stockManagerOfflineSales";

function Calendar() {
  const navigate = useNavigate();

  // =========================================================
  // SESSION
  // =========================================================

  let session = null;

  try {
    const savedSession = localStorage.getItem("storeSession");

    session = savedSession
      ? JSON.parse(savedSession)
      : null;
  } catch (error) {
    console.error("Erreur lecture session :", error);
  }

  const storeName =
    session?.storeName || "Mon magasin";

  const storeId =
    session?.storeId || "";

  // =========================================================
  // DONNÉES
  // =========================================================

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [offlineSales, setOfflineSales] = useState([]);

  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // =========================================================
  // DATE
  // =========================================================

  const today = new Date();

  const [currentDate, setCurrentDate] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  );

  const [selectedDate, setSelectedDate] =
    useState(today);

  // =========================================================
  // NOMS DES MOIS
  // =========================================================

  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  const days = [
    "Lun",
    "Mar",
    "Mer",
    "Jeu",
    "Ven",
    "Sam",
    "Dim",
  ];

  // =========================================================
  // CONVERTIR LES DATES FIREBASE / ISO
  // =========================================================

  const getDate = (value) => {
    if (!value) {
      return null;
    }

    try {
      // Timestamp Firestore
      if (typeof value.toDate === "function") {
        return value.toDate();
      }

      // Date JavaScript
      if (value instanceof Date) {
        return value;
      }

      // ISO / texte / nombre
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    } catch (error) {
      console.error(
        "Erreur conversion date :",
        error
      );

      return null;
    }
  };

  // =========================================================
  // CHARGER LES VENTES FIREBASE
  // =========================================================

  useEffect(() => {
    if (!storeId) {
      setSales([]);
      setLoadingSales(false);
      return;
    }

    setLoadingSales(true);

    const salesQuery = query(
      collection(db, "sales"),
      where("storeId", "==", storeId)
    );

    const unsubscribe = onSnapshot(
      salesQuery,

      (snapshot) => {
        const data = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data(),
          })
        );

        setSales(data);
        setLoadingSales(false);
      },

      (error) => {
        console.error(
          "Erreur chargement ventes :",
          error
        );

        setLoadingSales(false);
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  // =========================================================
  // CHARGER LES DÉPENSES FIREBASE
  // =========================================================

  useEffect(() => {
    if (!storeId) {
      setExpenses([]);
      setLoadingExpenses(false);
      return;
    }

    setLoadingExpenses(true);

    const expensesQuery = query(
      collection(db, "expenses"),
      where("storeId", "==", storeId)
    );

    const unsubscribe = onSnapshot(
      expensesQuery,

      (snapshot) => {
        const data = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data(),
          })
        );

        setExpenses(data);
        setLoadingExpenses(false);
      },

      (error) => {
        console.error(
          "Erreur chargement dépenses :",
          error
        );

        setLoadingExpenses(false);
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  // =========================================================
  // CHARGER LES VENTES HORS CONNEXION
  // =========================================================

  useEffect(() => {
    const loadOfflineSales = () => {
      try {
        const saved = localStorage.getItem(
          OFFLINE_SALES_KEY
        );

        const parsed = saved
          ? JSON.parse(saved)
          : [];

        const storeOfflineSales =
          Array.isArray(parsed)
            ? parsed.filter(
                (sale) =>
                  !sale.storeId ||
                  sale.storeId === storeId
              )
            : [];

        setOfflineSales(storeOfflineSales);
      } catch (error) {
        console.error(
          "Erreur lecture ventes hors connexion :",
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
      "online",
      loadOfflineSales
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadOfflineSales
      );

      window.removeEventListener(
        "online",
        loadOfflineSales
      );
    };
  }, [storeId]);

  // =========================================================
  // FUSIONNER FIREBASE + VENTES HORS LIGNE
  // =========================================================

  const allSales = useMemo(() => {
    const firebaseOfflineIds = new Set(
      sales
        .map((sale) => sale.offlineSaleId)
        .filter(Boolean)
    );

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
  // COMPARER DEUX DATES
  // =========================================================

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) {
      return false;
    }

    return (
      date1.getFullYear() ===
        date2.getFullYear() &&
      date1.getMonth() ===
        date2.getMonth() &&
      date1.getDate() ===
        date2.getDate()
    );
  };

  // =========================================================
  // VENTES DU JOUR SÉLECTIONNÉ
  // =========================================================

  const selectedSales = useMemo(() => {
    return allSales.filter((sale) => {
      // Ne pas compter les ventes annulées
      if (sale.status === "cancelled") {
        return false;
      }

      const saleDate = getDate(
        sale.offlineCreatedAt ||
          sale.createdAt ||
          sale.date
      );

      if (!saleDate) {
        return false;
      }

      return isSameDay(
        saleDate,
        selectedDate
      );
    });
  }, [allSales, selectedDate]);

  // =========================================================
  // DÉPENSES DU JOUR SÉLECTIONNÉ
  // =========================================================

  const selectedExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = getDate(
        expense.createdAt ||
          expense.date
      );

      if (!expenseDate) {
        return false;
      }

      return isSameDay(
        expenseDate,
        selectedDate
      );
    });
  }, [expenses, selectedDate]);

  // =========================================================
  // CHIFFRE D'AFFAIRES
  // =========================================================

  const totalSales = useMemo(() => {
    return selectedSales.reduce(
      (total, sale) =>
        total + Number(sale.total || 0),
      0
    );
  }, [selectedSales]);

  // =========================================================
  // NOMBRE D'ARTICLES VENDUS
  // =========================================================

  const totalItems = useMemo(() => {
    return selectedSales.reduce(
      (total, sale) => {
        // Si totalItems existe déjà dans la vente
        if (
          sale.totalItems !== undefined &&
          sale.totalItems !== null
        ) {
          return (
            total +
            Number(sale.totalItems || 0)
          );
        }

        // Sinon calculer à partir des articles
        const items = Array.isArray(
          sale.items
        )
          ? sale.items
          : [];

        const saleItems =
          items.reduce(
            (sum, item) =>
              sum +
              Number(item.quantity || 0),
            0
          );

        return total + saleItems;
      },
      0
    );
  }, [selectedSales]);

  // =========================================================
  // TOTAL DES DÉPENSES
  // =========================================================

  const totalExpenses = useMemo(() => {
    return selectedExpenses.reduce(
      (total, expense) =>
        total +
        Number(expense.amount || 0),
      0
    );
  }, [selectedExpenses]);

  // =========================================================
  // BÉNÉFICE DES VENTES
  // =========================================================

  const totalProfit = useMemo(() => {
    return selectedSales.reduce(
      (total, sale) => {
        if (
          sale.profit !== undefined &&
          sale.profit !== null
        ) {
          return (
            total +
            Number(sale.profit || 0)
          );
        }

        const items = Array.isArray(
          sale.items
        )
          ? sale.items
          : [];

        const saleProfit =
          items.reduce(
            (sum, item) => {
              const quantity =
                Number(
                  item.quantity || 0
                );

              const sellingPrice =
                Number(
                  item.sellingPrice ||
                    item.price ||
                    0
                );

              const purchasePrice =
                Number(
                  item.purchasePrice || 0
                );

              return (
                sum +
                (sellingPrice -
                  purchasePrice) *
                  quantity
              );
            },
            0
          );

        return total + saleProfit;
      },
      0
    );
  }, [selectedSales]);

  // =========================================================
  // BÉNÉFICE NET APRÈS DÉPENSES
  // =========================================================

  const netProfit =
    totalProfit - totalExpenses;

  // =========================================================
  // FORMAT DES MONTANTS
  // =========================================================

  const formatMoney = (amount) => {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        maximumFractionDigits: 2,
      }
    ).format(Number(amount || 0));
  };

  // =========================================================
  // CHANGER DE MOIS
  // =========================================================

  const previousMonth = () => {
    setCurrentDate((prev) => {
      return new Date(
        prev.getFullYear(),
        prev.getMonth() - 1,
        1
      );
    });
  };

  const nextMonth = () => {
    setCurrentDate((prev) => {
      return new Date(
        prev.getFullYear(),
        prev.getMonth() + 1,
        1
      );
    });
  };

  // =========================================================
  // RETOUR AUJOURD'HUI
  // =========================================================

  const goToToday = () => {
    const now = new Date();

    setCurrentDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );

    setSelectedDate(now);
  };

  // =========================================================
  // CONSTRUIRE LE CALENDRIER
  // =========================================================

  const calendarDays = useMemo(() => {
    const year =
      currentDate.getFullYear();

    const month =
      currentDate.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const lastDay = new Date(
      year,
      month + 1,
      0
    );

    const numberOfDays =
      lastDay.getDate();

    let startDay =
      firstDay.getDay();

    if (startDay === 0) {
      startDay = 7;
    }

    const result = [];

    // Cases vides avant le premier jour
    for (
      let i = 1;
      i < startDay;
      i++
    ) {
      result.push(null);
    }

    // Jours du mois
    for (
      let day = 1;
      day <= numberOfDays;
      day++
    ) {
      result.push(
        new Date(
          year,
          month,
          day
        )
      );
    }

    return result;
  }, [currentDate]);

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatSelectedDate = (date) => {
    return date.toLocaleDateString(
      "fr-FR",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  };

  // =========================================================
  // JOUR AYANT UNE ACTIVITÉ
  // =========================================================

  const hasActivity = (date) => {
    if (!date) {
      return false;
    }

    const hasSale = allSales.some(
      (sale) => {
        if (
          sale.status ===
          "cancelled"
        ) {
          return false;
        }

        const saleDate = getDate(
          sale.offlineCreatedAt ||
            sale.createdAt ||
            sale.date
        );

        return (
          saleDate &&
          isSameDay(
            saleDate,
            date
          )
        );
      }
    );

    if (hasSale) {
      return true;
    }

    return expenses.some(
      (expense) => {
        const expenseDate = getDate(
          expense.createdAt ||
            expense.date
        );

        return (
          expenseDate &&
          isSameDay(
            expenseDate,
            date
          )
        );
      }
    );
  };

  // =========================================================
  // CHARGEMENT
  // =========================================================

  const loading =
    loadingSales ||
    loadingExpenses;

  // =========================================================
  // AFFICHAGE
  // =========================================================

  return (
    <div className={styles.page}>

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className={styles.header}>

        <button
          type="button"
          className={styles.backButton}
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ←
        </button>

        <div>
          <h1>
            Calendrier
          </h1>

          <p>
            {storeName}
          </p>
        </div>

        <div
          className={
            styles.calendarIcon
          }
        >
          📅
        </div>

      </header>

      {/* ================================================= */}
      {/* CONTENU */}
      {/* ================================================= */}

      <main className={styles.content}>

        {/* ================================================= */}
        {/* CALENDRIER */}
        {/* ================================================= */}

        <section
          className={
            styles.calendarCard
          }
        >

          <div
            className={
              styles.monthHeader
            }
          >

            <button
              type="button"
              onClick={
                previousMonth
              }
              className={
                styles.monthButton
              }
            >
              ‹
            </button>

            <div>

              <h2>
                {
                  months[
                    currentDate.getMonth()
                  ]
                }
              </h2>

              <span>
                {
                  currentDate.getFullYear()
                }
              </span>

            </div>

            <button
              type="button"
              onClick={
                nextMonth
              }
              className={
                styles.monthButton
              }
            >
              ›
            </button>

          </div>

          {/* JOURS DE LA SEMAINE */}

          <div
            className={
              styles.weekDays
            }
          >

            {days.map((day) => (
              <div key={day}>
                {day}
              </div>
            ))}

          </div>

          {/* JOURS */}

          <div
            className={
              styles.daysGrid
            }
          >

            {calendarDays.map(
              (date, index) => {

                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className={
                        styles.emptyDay
                      }
                    />
                  );
                }

                const selected =
                  isSameDay(
                    date,
                    selectedDate
                  );

                const todayDate =
                  isSameDay(
                    date,
                    today
                  );

                const activity =
                  hasActivity(date);

                return (
                  <button
                    type="button"
                    key={
                      date.toISOString()
                    }
                    className={`
                      ${styles.dayButton}
                      ${
                        selected
                          ? styles.selectedDay
                          : ""
                      }
                      ${
                        todayDate
                          ? styles.today
                          : ""
                      }
                    `}
                    onClick={() =>
                      setSelectedDate(
                        date
                      )
                    }
                  >

                    {date.getDate()}

                    {activity && (
                      <span
                        style={{
                          position:
                            "absolute",
                          bottom: "3px",
                          width: "4px",
                          height: "4px",
                          borderRadius:
                            "50%",
                          background:
                            selected
                              ? "white"
                              : "#2563eb",
                        }}
                      />
                    )}

                  </button>
                );
              }
            )}

          </div>

          <button
            type="button"
            className={
              styles.todayButton
            }
            onClick={goToToday}
          >
            Aujourd'hui
          </button>

        </section>

        {/* ================================================= */}
        {/* DATE SÉLECTIONNÉE */}
        {/* ================================================= */}

        <section
          className={
            styles.selectedDateCard
          }
        >

          <span>
            DATE SÉLECTIONNÉE
          </span>

          <h2>
            {formatSelectedDate(
              selectedDate
            )}
          </h2>

        </section>

        {/* ================================================= */}
        {/* ACTIVITÉ */}
        {/* ================================================= */}

        <section
          className={
            styles.activitySection
          }
        >

          <div
            className={
              styles.activityTitle
            }
          >

            <div>

              <h2>
                Activité de la journée
              </h2>

              <p>
                Résumé des opérations
                du magasin
              </p>

            </div>

          </div>

          {/* CHARGEMENT */}

          {loading ? (

            <div
              className={
                styles.emptyActivity
              }
            >

              <div>
                ⏳
              </div>

              <h3>
                Chargement...
              </h3>

              <p>
                Récupération des
                données du magasin.
              </p>

            </div>

          ) : (

            <>
              {/* STATISTIQUES */}

              <div
                className={
                  styles.statsGrid
                }
              >

                {/* CHIFFRE D'AFFAIRES */}

                <div
                  className={
                    styles.statCard
                  }
                >

                  <span>
                    Chiffre d'affaires
                  </span>

                  <strong>
                    {formatMoney(
                      totalSales
                    )}
                  </strong>

                </div>

                {/* VENTES */}

                <div
                  className={
                    styles.statCard
                  }
                >

                  <span>
                    Ventes
                  </span>

                  <strong>
                    {
                      selectedSales.length
                    }
                  </strong>

                </div>

                {/* ARTICLES */}

                <div
                  className={
                    styles.statCard
                  }
                >

                  <span>
                    Articles vendus
                  </span>

                  <strong>
                    {totalItems}
                  </strong>

                </div>

                {/* DÉPENSES */}

                <div
                  className={
                    styles.statCard
                  }
                >

                  <span>
                    Dépenses
                  </span>

                  <strong>
                    {formatMoney(
                      totalExpenses
                    )}
                  </strong>

                </div>

              </div>

              {/* ================================================= */}
              {/* RÉSUMÉ FINANCIER */}
              {/* ================================================= */}

              {(selectedSales.length > 0 ||
                selectedExpenses.length > 0) && (

                <div
                  className={
                    styles.emptyActivity
                  }
                >


                  <h3>
                    Résumé de la journée
                  </h3>

                  <p>
                    {
                      selectedSales.length
                    }{" "}
                    vente
                    {
                      selectedSales.length >
                      1
                        ? "s"
                        : ""
                    }
                    {" • "}
                    {totalItems} article
                    {
                      totalItems > 1
                        ? "s"
                        : ""
                    }{" "}
                    vendu
                    {
                      totalItems > 1
                        ? "s"
                        : ""
                    }
                  </p>

                  <p>
                    Bénéfice des ventes :{" "}
                    <strong>
                      {formatMoney(
                        totalProfit
                      )}
                    </strong>
                  </p>

                  <p>
                    Bénéfice après
                    dépenses :{" "}
                    <strong>
                      {formatMoney(
                        netProfit
                      )}
                    </strong>
                  </p>

                </div>

              )}

              {/* ================================================= */}
              {/* AUCUNE ACTIVITÉ */}
              {/* ================================================= */}

              {selectedSales.length === 0 &&
                selectedExpenses.length === 0 && (

                  <div
                    className={
                      styles.emptyActivity
                    }
                  >


                    <h3>
                      Aucune activité
                    </h3>

                    <p>
                      Aucune vente ni
                      dépense enregistrée
                      pour cette date.
                    </p>

                  </div>

                )}

            </>

          )}

        </section>

      </main>

    </div>
  );
}

export default Calendar;