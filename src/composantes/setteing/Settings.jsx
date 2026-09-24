import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./settings.module.css";

function Settings() {
  const navigate = useNavigate();

  const savedSession = localStorage.getItem("storeSession");
  const session = savedSession ? JSON.parse(savedSession) : null;
  const storeId = session?.storeId || "";

  const [settings, setSettings] = useState({
    storeName: "",
    phone: "",
    address: "",
    currency: "FC",
    adminName: "",
    adminEmail: "",
    defaultAlertStock: 10,
    lowStockAlerts: true,
    adminPosCode: "",
  });

  const [confirmAdminPosCode, setConfirmAdminPosCode] = useState("");
  const [showAdminPosCode, setShowAdminPosCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      if (!storeId) {
        setError("Aucun magasin connecté.");
        setLoading(false);
        return;
      }

      try {
        const usersQuery = query(
          collection(db, "users"),
          where("storeId", "==", storeId),
          where("role", "==", "admin")
        );

        const usersSnapshot = await getDocs(usersQuery);
        let adminData = null;

        if (!usersSnapshot.empty) {
          adminData = usersSnapshot.docs[0].data();
        }

        const settingsRef = doc(db, "settings", storeId);
        const settingsSnapshot = await getDoc(settingsRef);

        if (settingsSnapshot.exists()) {
          const savedSettings = settingsSnapshot.data();

          setSettings((prev) => ({
            ...prev,
            ...savedSettings,
            storeName:
              savedSettings.storeName ||
              adminData?.storeName ||
              "",
            adminName:
              savedSettings.adminName ||
              adminData?.name ||
              "",
            adminEmail:
              adminData?.email ||
              savedSettings.adminEmail ||
              "",
            adminPosCode: savedSettings.adminPosCode || "",
          }));

          setConfirmAdminPosCode(savedSettings.adminPosCode || "");
        } else {
          setSettings((prev) => ({
            ...prev,
            storeName: adminData?.storeName || "",
            adminName: adminData?.name || "",
            adminEmail: adminData?.email || "",
          }));
        }
      } catch (err) {
        console.error("Erreur chargement paramètres :", err);
        setError("Impossible de charger les informations du magasin.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [storeId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setMessage("");
    setError("");
  };

  const handleAdminPosCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length > 6) return;

    setSettings((prev) => ({
      ...prev,
      adminPosCode: value,
    }));

    setMessage("");
    setError("");
  };

  const handleConfirmCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length > 6) return;

    setConfirmAdminPosCode(value);
    setMessage("");
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!storeId) {
      setError("Aucun magasin connecté.");
      return;
    }

    if (!settings.storeName.trim()) {
      setError("Le nom du magasin est obligatoire.");
      return;
    }

    if (!settings.adminName.trim()) {
      setError("Le nom de l'administrateur est obligatoire.");
      return;
    }

    if (
      settings.defaultAlertStock === "" ||
      Number(settings.defaultAlertStock) < 0
    ) {
      setError("Le seuil d'alerte du stock est invalide.");
      return;
    }

    if (
      settings.adminPosCode &&
      !/^\d{4,6}$/.test(settings.adminPosCode)
    ) {
      setError(
        "Le code administrateur POS doit contenir entre 4 et 6 chiffres."
      );
      return;
    }

    if (settings.adminPosCode !== confirmAdminPosCode) {
      setError(
        "La confirmation du code administrateur POS ne correspond pas."
      );
      return;
    }

    try {
      setSaving(true);

      const settingsRef = doc(db, "settings", storeId);

      await setDoc(
        settingsRef,
        {
          storeId,
          storeName: settings.storeName.trim(),
          phone: settings.phone.trim(),
          address: settings.address.trim(),
          currency: settings.currency,
          adminName: settings.adminName.trim(),
          adminEmail: settings.adminEmail.trim(),
          defaultAlertStock: Number(settings.defaultAlertStock),
          lowStockAlerts: settings.lowStockAlerts,
          adminPosCode: settings.adminPosCode,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Les paramètres ont été enregistrés avec succès.");
    } catch (err) {
      console.error("Erreur sauvegarde paramètres :", err);
      setError("Une erreur est survenue pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.settings}>
        <div className={styles.loading}>
          Chargement des paramètres...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settings}>
      <header className={styles.header}>
        <h1>Paramètres</h1>
        <p>Configurez les informations et le fonctionnement de votre magasin.</p>
      </header>

      {message && (
        <div className={styles.successMessage}>✓ {message}</div>
      )}

      {error && (
        <div className={styles.errorMessage}>⚠ {error}</div>
      )}

      <form onSubmit={handleSave}>
        <div className={styles.settingsGrid}>
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
                <label>Nom du magasin</label>
                <input
                  name="storeName"
                  value={settings.storeName}
                  onChange={handleChange}
                  placeholder="Nom du magasin"
                />
              </div>

              <div className={styles.field}>
                <label>Téléphone</label>
                <input
                  name="phone"
                  value={settings.phone}
                  onChange={handleChange}
                  placeholder="+243..."
                />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Adresse</label>
                <input
                  name="address"
                  value={settings.address}
                  onChange={handleChange}
                  placeholder="Adresse du magasin"
                />
              </div>

              <div className={styles.field}>
                <label>Devise</label>
                <select
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

          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>👤</div>
              <div>
                <h2>Administrateur</h2>
                <p>Informations du responsable du magasin</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Nom de l'administrateur</label>
                <input
                  name="adminName"
                  value={settings.adminName}
                  onChange={handleChange}
                />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Adresse email</label>
                <input
                  type="email"
                  name="adminEmail"
                  value={settings.adminEmail}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </section>

          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>🔐</div>
              <div>
                <h2>Sécurité et accès</h2>
                <p>Code administrateur et accès employés</p>
              </div>
            </div>

            <div className={styles.adminCodeBox}>
              <div className={styles.adminCodeTitle}>
                <div>
                  <strong>Code administrateur POS</strong>
                  <p>
                    Ce code permettra à l'administrateur d'accéder au POS et
                    d'autoriser les opérations sensibles, comme l'annulation
                    d'une vente depuis le compte d'un caissier.
                  </p>
                </div>
                <span className={styles.adminBadge}>ADMIN</span>
              </div>

              <div className={styles.adminCodeFields}>
                <div className={styles.field}>
                  <label>Code administrateur</label>
                  <div className={styles.passwordField}>
                    <input
                      type={showAdminPosCode ? "text" : "password"}
                      inputMode="numeric"
                      value={settings.adminPosCode}
                      onChange={handleAdminPosCodeChange}
                      placeholder="4 à 6 chiffres"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      className={styles.showCodeButton}
                      onClick={() =>
                        setShowAdminPosCode((current) => !current)
                      }
                    >
                      {showAdminPosCode ? "Masquer" : "Voir"}
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Confirmer le code</label>
                  <input
                    type={showAdminPosCode ? "text" : "password"}
                    inputMode="numeric"
                    value={confirmAdminPosCode}
                    onChange={handleConfirmCodeChange}
                    placeholder="Répétez le code"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className={styles.codeUsageInfo}>
                <strong>Ce code sera utilisé pour :</strong>
                <ul>
                  <li>l'accès administrateur au POS ;</li>
                  <li>confirmer l'annulation d'une vente ;</li>
                  <li>autoriser les futures opérations sensibles.</li>
                </ul>
              </div>
            </div>

            <div className={styles.securityInfo}>
              <strong>Accès des employés</strong>
              <p>
                Chaque employé garde son propre code et ses propres permissions.
                L'administrateur conserve tous les droits du magasin.
              </p>
            </div>
          </section>

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
                <label>Seuil d'alerte</label>
                <input
                  type="number"
                  name="defaultAlertStock"
                  value={settings.defaultAlertStock}
                  onChange={handleChange}
                  min="0"
                />
              </div>

              <div className={styles.toggleField}>
                <div>
                  <strong>Alertes de stock faible</strong>
                  <p>Activer les alertes de stock.</p>
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

          <section
            className={`${styles.settingsCard} ${styles.employeeCard}`}
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>👥</div>
              <div>
                <h2>Employés</h2>
                <p>Gestion des utilisateurs et permissions</p>
              </div>
            </div>

            <div className={styles.employeeContent}>
              <div>
                <strong>Gérer les employés</strong>
                <p>
                  Créez les comptes des caissiers et managers et choisissez
                  leurs permissions.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => navigate("/settings/employees")}
              >
                Gérer les employés →
              </button>
            </div>
          </section>
        </div>

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
