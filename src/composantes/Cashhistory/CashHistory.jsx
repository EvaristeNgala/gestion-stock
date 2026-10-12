import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import styles from "./cashHistory.module.css";

const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FC`;
const asDate = (value) => {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const dateText = (value) => asDate(value)?.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) || "—";
const dateKey = (value) => {
  const d = asDate(value);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
};
const firstNumber = (obj, keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      const n = Number(obj[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};
const validSale = (sale) => !["cancelled", "canceled", "annulled"].includes(sale.status);
const saleDate = (sale) => sale.offlineCreatedAt || sale.createdAt || sale.date || null;

export default function CashHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [sales, setSales] = useState([]);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [salesReady, setSalesReady] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState(null);

  const session = (() => {
    try { return JSON.parse(localStorage.getItem("storeSession") || "null"); }
    catch { return null; }
  })();
  const storeId = session?.storeId;
  const authorized = session?.role === "admin" || session?.role === "manager";

  useEffect(() => {
    if (!storeId || !authorized) return;
    setSessionsReady(false);
    setSalesReady(false);
    setError("");
    const byStore = where("storeId", "==", storeId);
    const stopSessions = onSnapshot(
      query(collection(db, "cashSessions"), byStore),
      snap => {
        setSessions(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        setSessionsReady(true);
      },
      e => { setError(`Erreur de lecture des caisses : ${e.message}`); setSessionsReady(true); }
    );
    const stopSales = onSnapshot(
      query(collection(db, "sales"), byStore),
      snap => {
        setSales(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        setSalesReady(true);
      },
      e => { setError(`Erreur de lecture des ventes : ${e.message}`); setSalesReady(true); }
    );
    return () => { stopSessions(); stopSales(); };
  }, [storeId, authorized]);

  const { enriched, unmatched } = useMemo(() => {
    const bySession = new Map();
    const ids = new Set(sessions.map(s => s.id));
    const orphanSales = [];
    for (const sale of sales) {
      if (!validSale(sale)) continue;
      const id = sale.cashSessionId;
      if (!id || !ids.has(id)) {
        orphanSales.push(sale);
        continue;
      }
      if (!bySession.has(id)) bySession.set(id, []);
      bySession.get(id).push(sale);
    }
    const results = sessions.map(s => {
      const linked = bySession.get(s.id) || [];
      const actualTotal = linked.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
      const latestSale = linked.reduce((latest, sale) => {
        const date = asDate(saleDate(sale));
        return date && (!latest || date > latest) ? date : latest;
      }, null);
      return { ...s, actualTotal, actualCount: linked.length, latestSale,
        mismatch: Number(s.totalSales || 0) !== actualTotal || Number(s.numberOfSales || 0) !== linked.length };
    });
    results.sort((a, b) => {
      const t = s => Math.max(asDate(s.openedAt)?.getTime() || 0, asDate(s.closedAt)?.getTime() || 0, s.latestSale?.getTime() || 0);
      return t(b) - t(a);
    });
    return { enriched: results, unmatched: orphanSales };
  }, [sessions, sales]);

  const rows = useMemo(() => enriched.filter(s => {
    if (filter !== "all" && s.status !== filter) return false;
    if (search && !(s.userName || "").toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (day && ![dateKey(s.openedAt), dateKey(s.closedAt), dateKey(s.latestSale)].includes(day)) return false;
    return true;
  }), [enriched, filter, search, day]);

  if (!authorized) return <main className={styles.page}><section className={`${styles.surface} ${styles.access}`}><h2>Accès réservé</h2><p>Cette page est réservée à l'administrateur et au gérant.</p><button className={styles.button} onClick={() => navigate("/dashboard")}>Retour</button></section></main>;
  if (!storeId) return <main className={styles.page}>Aucun magasin connecté.</main>;

  const details = s => {
    const opening = firstNumber(s, ["openingAmount", "openingFloat", "openingCash", "openingBalance"]);
    const expenses = firstNumber(s, ["totalExpenses"]);
    const cashExpenses = firstNumber(s, ["cashExpenses"]);
    const expected = firstNumber(s, ["expectedCash"]);
    const counted = firstNumber(s, ["countedCash"]);
    const difference = firstNumber(s, ["cashDifference"]);
    return [
      ["Caissier", s.userName || "—"],
      ["Statut", s.status === "closed" ? "Fermée" : "Ouverte"],
      ["Ouverture", dateText(s.openedAt)],
      ["Fermeture", dateText(s.closedAt)],
      ["Dernière vente", dateText(s.latestSale)],
      ["Fonds initial", opening === null ? "Non enregistré" : money(opening)],
      ["Ventes enregistrées", money(s.actualTotal)],
      ["Nombre de ventes", s.actualCount],
      ["Total inscrit dans la session", money(s.totalSales)],
      ["Dépenses totales", expenses === null ? "Non enregistré" : money(expenses)],
      ["Dépenses en espèces", cashExpenses === null ? "Non enregistré" : money(cashExpenses)],
      ["Espèces attendues à la clôture", expected === null ? "Non enregistré" : money(expected)],
      ["Espèces comptées", counted === null ? "Non enregistré" : money(counted)],
      ["Écart de clôture", difference === null ? "Non enregistré" : money(difference)],
    ];
  };

  const loading = !sessionsReady || !salesReady;
  return <main className={styles.page}>
    <div className={styles.container}>
      <button className={styles.backButton} onClick={() => navigate("/dashboard")}>← Dashboard</button>
      <h1 className={styles.heading}>Historique des caisses</h1>
      <p className={styles.subtitle}>Sessions et ventes associées, actualisées depuis Firebase</p>
      <div className={`${styles.surface} ${styles.filters}`}>
        <input className={styles.field} aria-label="Rechercher un caissier" placeholder="Rechercher un caissier" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.field} aria-label="Filtrer par statut" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Toutes les caisses</option><option value="open">Ouvertes</option><option value="closed">Fermées</option>
        </select>
        <input className={styles.field} aria-label="Filtrer par date" type="date" value={day} onChange={e => setDay(e.target.value)} />
        <button className={styles.button} onClick={() => { setSearch(""); setFilter("all"); setDay(""); }}>Effacer les filtres</button>
      </div>
      {loading && <p>Chargement des caisses et des ventes…</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!loading && !error && <p className={styles.count}>{rows.length} session(s) trouvée(s)</p>}
      {!loading && !error && unmatched.length > 0 && <section className={styles.surface} style={{ marginBottom: 14, borderColor: "#f59e0b" }}>
        <strong>Attention : {unmatched.length} vente(s) sans session retrouvée.</strong>
        <p className={styles.muted}>Ces ventes existent dans Firebase, mais leur identifiant de caisse est absent ou ne correspond à aucune session du magasin. Elles ne sont pas attribuées à une caisse au hasard.</p>
        <p>Total concerné : <strong>{money(unmatched.reduce((sum, s) => sum + Number(s.total || 0), 0))}</strong></p>
        <p className={styles.muted}>Vérifiez le champ cashSessionId des ventes concernées et les documents cashSessions dans Firebase.</p>
      </section>}
      {!loading && !error && <div className={styles.cards}>
        {rows.map(s => <article key={s.id} className={styles.surface}>
          <div className={styles.cardTop}>
            <div><div className={styles.cashier}>{s.userName || "Caissier inconnu"}</div>
              <div className={styles.date}>Ouverture : {dateText(s.openedAt)}</div>
              <div className={styles.date}>Fermeture : {dateText(s.closedAt)}</div>
              <div className={styles.date}>Dernière vente : {dateText(s.latestSale)}</div>
            </div>
            <span className={`${styles.status} ${s.status === "closed" ? styles.closed : styles.open}`}>{s.status === "closed" ? "● Fermée" : "● Ouverte"}</span>
          </div>
          <div className={styles.summary}><span>Ventes : <strong>{money(s.actualTotal)}</strong></span><span>{s.actualCount} vente(s)</span></div>
          {s.mismatch && <p style={{ color: "#9a3412", fontSize: ".88rem" }}>⚠ Différence entre les ventes associées et les totaux mémorisés dans cette session.</p>}
          <button className={styles.button} onClick={() => setSelected(selected === s.id ? null : s.id)}>{selected === s.id ? "Masquer les détails" : "Voir les détails"}</button>
          {selected === s.id && <div className={styles.details}>{details(s).map(([label, value]) => <div key={label} className={styles.detail}><div className={styles.detailLabel}>{label}</div><div className={styles.detailValue}>{value}</div></div>)}</div>}
        </article>)}
      </div>}
      {!loading && !error && rows.length === 0 && <p className={styles.empty}>Aucune session ne correspond aux filtres.</p>}
    </div>
  </main>;
}
