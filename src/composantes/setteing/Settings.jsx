import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./settings.module.css";

function Settings() {
  // ==============================
  // ÉTAT
  // ==============================

  const [settings, setSettings] = useState({
    storeName: "",
    phone: "",
    address: "",
    currency: "FC",
    adminName: "",
    posAccessCode: "",
    defaultAlertStock: 10,
    lowStockAlerts: true,
  });

  const [showCode, setShowCode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==============================
  // CHARGER LES PARAMÈTRES
  // ==============================

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsRef = doc(db, "settings", "general");
        const snapshot = await getDoc(settingsRef);

        if (snapshot.exists()) {
          setSettings((prev) => ({
            ...prev,
            ...snapshot.data(),
          }));
        }
      } catch (err) {
        console.error("Erreur chargement paramètres :", err);
        setError("Impossible de charger les paramètres.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // ==============================
  // MODIFIER UN CHAMP
  // ==============================

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setMessage("");
    setError("");
  };

  // ==============================
  // SAUVEGARDER
  // ==============================

  const handleSave = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    // Vérification
    if (!settings.storeName.trim()) {
      setError("Veuillez entrer le nom du magasin.");
      return;
    }

    if (!settings.adminName.trim()) {
      setError("Veuillez entrer le nom de l'administrateur.");
      return;
    }

    if (
      settings.posAccessCode &&
      (settings.posAccessCode.length < 4 ||
        settings.posAccessCode.length > 10)
    ) {
      setError("Le code POS doit contenir entre 4 et 10 caractères.");
      return;
    }

    if (
      Number(settings.defaultAlertStock) < 0 ||
      settings.defaultAlertStock === ""
    ) {
      setError("Le seuil d'alerte du stock est invalide.");
      return;
    }

    try {
      setSaving(true);

      const settingsRef = doc(db, "settings", "general");

      await setDoc(
        settingsRef,
        {
          ...settings,
          defaultAlertStock: Number(settings.defaultAlertStock),
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setMessage("Les paramètres ont été enregistrés avec succès.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (err) {
      console.error("Erreur sauvegarde paramètres :", err);
      setError("Une erreur est survenue pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ==============================
  // CHARGEMENT
  // ==============================

  if (loading) {
    return (
      <div className={styles.settings}>
        <div className={styles.loading}>
          Chargement des paramètres...
        </div>
      </div>
    );
  }

  // ==============================
  // AFFICHAGE
  // ==============================

  return (
    <div className={styles.settings}>
      {/* ==========================
          EN-TÊTE
      ========================== */}

      <header className={styles.header}>
        <div>
          <h1>Paramètres</h1>
          <p>
            Configurez les informations et le fonctionnement de votre magasin.
          </p>
        </div>
      </header>

      {/* ==========================
          MESSAGES
      ========================== */}

      {message && (
        <div className={styles.successMessage}>
          ✓ {message}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className={styles.settingsGrid}>

          {/* ==========================
              MAGASIN
          ========================== */}

          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>🏪</div>

              <div>
                <h2>Magasin</h2>
                <p>Informations générales du magasin</p>
              </div>
            </div>

            <div className={styles.formGrid}>

              <div className={styles.field}>
                <label htmlFor="storeName">
                  Nom du magasin
                </label>

                <input
                  id="storeName"
                  type="text"
                  name="storeName"
                  value={settings.storeName}
                  onChange={handleChange}
                  placeholder="Ex : Evariste Store"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="phone">
                  Téléphone
                </label>

                <input
                  id="phone"
                  type="text"
                  name="phone"
                  value={settings.phone}
                  onChange={handleChange}
                  placeholder="Ex : +243 ..."
                />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label htmlFor="address">
                  Adresse
                </label>

                <input
                  id="address"
                  type="text"
                  name="address"
                  value={settings.address}
                  onChange={handleChange}
                  placeholder="Adresse du magasin"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="currency">
                  Devise
                </label>

                <select
                  id="currency"
                  name="currency"
                  value={settings.currency}
                  onChange={handleChange}
                >
                  <option value="FC">FC</option>
                  <option value="$">Dollar ($)</option>
                  <option value="€">Euro (€)</option>
                </select>
              </div>

            </div>
          </section>

          {/* ==========================
              ADMINISTRATEUR
          ========================== */}

          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>👤</div>

              <div>
                <h2>Administrateur</h2>
                <p>Informations du responsable</p>
              </div>
            </div>

            <div className={styles.formGrid}>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label htmlFor="adminName">
                  Nom de l'administrateur
                </label>

                <input
                  id="adminName"
                  type="text"
                  name="adminName"
                  value={settings.adminName}
                  onChange={handleChange}
                  placeholder="Ex : Evariste"
                />
              </div>

            </div>
          </section>

          {/* ==========================
              SÉCURITÉ / POS
          ========================== */}

          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>🔐</div>

              <div>
                <h2>Sécurité</h2>
                <p>Configuration de l'accès au point de vente</p>
              </div>
            </div>

            <div className={styles.formGrid}>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label htmlFor="posAccessCode">
                  Code d'accès POS
                </label>

                <div className={styles.passwordContainer}>
                  <input
                    id="posAccessCode"
                    type={showCode ? "text" : "password"}
                    name="posAccessCode"
                    value={settings.posAccessCode}
                    onChange={handleChange}
                    placeholder="Entrez le code d'accès"
                    maxLength={10}
                  />

                  <button
                    type="button"
                    className={styles.showButton}
                    onClick={() => setShowCode((prev) => !prev)}
                  >
                    {showCode ? "Masquer" : "Afficher"}
                  </button>
                </div>

                <small>
                  Le code doit contenir entre 4 et 10 caractères.
                </small>
              </div>

            </div>
          </section>

          {/* ==========================
              STOCK
          ========================== */}

          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>📦</div>

              <div>
                <h2>Stock</h2>
                <p>Configuration des alertes de stock</p>
              </div>
            </div>

            <div className={styles.formGrid}>

              <div className={styles.field}>
                <label htmlFor="defaultAlertStock">
                  Seuil d'alerte
                </label>

                <input
                  id="defaultAlertStock"
                  type="number"
                  name="defaultAlertStock"
                  value={settings.defaultAlertStock}
                  onChange={handleChange}
                  min="0"
                />

                <small>
                  Niveau à partir duquel un produit est considéré comme ayant
                  un stock faible.
                </small>
              </div>

              <div className={styles.toggleField}>
                <div>
                  <strong>Alertes de stock faible</strong>
                  <p>
                    Activer les alertes lorsque le stock devient faible.
                  </p>
                </div>

                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    name="lowStockAlerts"
                    checked={settings.lowStockAlerts}
                    onChange={handleChange}
                  />

                  <span className={styles.slider}></span>
                </label>
              </div>

            </div>
          </section>

          {/* ==========================
              EMPLOYÉS
          ========================== */}

          <section className={`${styles.settingsCard} ${styles.employeeCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>👥</div>

              <div>
                <h2>Employés</h2>
                <p>Gestion des vendeurs et de leurs permissions</p>
              </div>
            </div>

            <div className={styles.employeeContent}>
              <div>
                <strong>Gérer les employés</strong>

                <p>
                  Créez des comptes vendeurs et définissez leurs accès au POS,
                  aux produits, au stock et aux rapports.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  alert("La gestion des employés sera ajoutée prochainement.")
                }
              >
                Gérer les employés
              </button>
            </div>
          </section>

        </div>

        {/* ==========================
            BOUTON ENREGISTRER
        ========================== */}

        <div className={styles.saveContainer}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={saving}
          >
            {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;