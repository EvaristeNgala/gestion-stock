
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

  // ==============================
  // SESSION / MAGASIN
  // ==============================

  const savedSession = localStorage.getItem("storeSession");

  const session = savedSession
    ? JSON.parse(savedSession)
    : null;

  const storeId = session?.storeId || "";

  // ==============================
  // ÉTAT
  // ==============================

  const [settings, setSettings] = useState({
    storeName: "",
    phone: "",
    address: "",
    currency: "FC",
    adminName: "",
    adminEmail: "",
    defaultAlertStock: 10,
    lowStockAlerts: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==============================
  // CHARGER PARAMÈTRES + ADMIN
  // ==============================

  useEffect(() => {
    const loadSettings = async () => {
      // ============================
      // VERIFICATION MAGASIN
      // ============================

      if (!storeId) {
        setError("Aucun magasin connecté.");
        setLoading(false);
        return;
      }

      try {
        // =====================================================
        // 1. CHERCHER L'ADMINISTRATEUR DU MAGASIN
        // =====================================================

        const usersQuery = query(
          collection(db, "users"),
          where("storeId", "==", storeId),
          where("role", "==", "admin")
        );

        const usersSnapshot = await getDocs(usersQuery);

        let adminData = null;

        if (!usersSnapshot.empty) {
          // On prend le premier administrateur trouvé
          adminData = usersSnapshot.docs[0].data();
        }

        // =====================================================
        // 2. CHARGER LES PARAMÈTRES DU MAGASIN
        // =====================================================

        const settingsRef = doc(
          db,
          "settings",
          storeId
        );

        const settingsSnapshot =
          await getDoc(settingsRef);

        // =====================================================
        // 3. INFORMATIONS DE BASE VENANT DE L'ADMIN
        // =====================================================

        const adminDefaults = {
          storeName:
            adminData?.storeName || "",

          adminName:
            adminData?.name || "",

          adminEmail:
            adminData?.email || "",
        };

        // =====================================================
        // 4. SI DES PARAMÈTRES EXISTENT DÉJÀ
        //    ON LES GARDE
        // =====================================================

        if (settingsSnapshot.exists()) {
          const savedSettings =
            settingsSnapshot.data();

          setSettings((prev) => ({
            ...prev,

            ...adminDefaults,

            ...savedSettings,

            // L'email vient toujours
            // de la fiche administrateur
            adminEmail:
              adminData?.email ||
              savedSettings.adminEmail ||
              "",
          }));

        } else {
          // ===================================================
          // 5. AUCUN PARAMÈTRE ENCORE ENREGISTRÉ
          //    ON UTILISE LES INFOS DE L'ADMIN
          // ===================================================

          setSettings((prev) => ({
            ...prev,
            ...adminDefaults,
          }));
        }

      } catch (err) {
        console.error(
          "Erreur chargement paramètres :",
          err
        );

        setError(
          "Impossible de charger les informations du magasin."
        );
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [storeId]);

  // ==============================
  // MODIFIER UN CHAMP
  // ==============================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
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

    // ============================
    // VERIFICATION MAGASIN
    // ============================

    if (!storeId) {
      setError(
        "Aucun magasin connecté."
      );

      return;
    }

    // ============================
    // VERIFICATION NOM MAGASIN
    // ============================

    if (!settings.storeName.trim()) {
      setError(
        "Le nom du magasin est obligatoire."
      );

      return;
    }

    // ============================
    // VERIFICATION ADMIN
    // ============================

    if (!settings.adminName.trim()) {
      setError(
        "Le nom de l'administrateur est obligatoire."
      );

      return;
    }

    // ============================
    // VERIFICATION STOCK
    // ============================

    if (
      settings.defaultAlertStock === "" ||
      Number(settings.defaultAlertStock) < 0
    ) {
      setError(
        "Le seuil d'alerte du stock est invalide."
      );

      return;
    }

    try {
      setSaving(true);

      // ============================
      // DOCUMENT SETTINGS
      // ============================

      const settingsRef = doc(
        db,
        "settings",
        storeId
      );

      await setDoc(
        settingsRef,
        {
          storeId,

          storeName:
            settings.storeName.trim(),

          phone:
            settings.phone.trim(),

          address:
            settings.address.trim(),

          currency:
            settings.currency,

          adminName:
            settings.adminName.trim(),

          adminEmail:
            settings.adminEmail.trim(),

          defaultAlertStock:
            Number(
              settings.defaultAlertStock
            ),

          lowStockAlerts:
            settings.lowStockAlerts,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setMessage(
        "Les paramètres ont été enregistrés avec succès."
      );

      setTimeout(() => {
        setMessage("");
      }, 3000);

    } catch (err) {
      console.error(
        "Erreur sauvegarde paramètres :",
        err
      );

      setError(
        "Une erreur est survenue pendant l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==============================
  // OUVRIR GESTION EMPLOYÉS
  // ==============================

  const handleManageEmployees = () => {
    navigate("/settings/employees");
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
          <h1>
            Paramètres
          </h1>

          <p>
            Configurez les informations et
            le fonctionnement de votre magasin.
          </p>
        </div>
      </header>

      {/* ==========================
          MESSAGES
      ========================== */}

      {message && (
        <div
          className={
            styles.successMessage
          }
        >
          ✓ {message}
        </div>
      )}

      {error && (
        <div
          className={
            styles.errorMessage
          }
        >
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSave}>

        <div className={styles.settingsGrid}>

          {/* ==========================
              MAGASIN
          ========================== */}

          <section
            className={
              styles.settingsCard
            }
          >

            <div
              className={
                styles.cardHeader
              }
            >

              <div
                className={
                  styles.cardIcon
                }
              >
                🏪
              </div>

              <div>
                <h2>
                  Magasin
                </h2>

                <p>
                  Informations générales
                  du magasin
                </p>
              </div>

            </div>

            <div
              className={
                styles.formGrid
              }
            >

              {/* NOM MAGASIN */}

              <div
                className={
                  styles.field
                }
              >

                <label htmlFor="storeName">
                  Nom du magasin
                </label>

                <input
                  id="storeName"
                  type="text"
                  name="storeName"
                  value={
                    settings.storeName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ex : Elva"
                />

                <small>
                  Récupéré automatiquement
                  depuis le compte administrateur.
                </small>

              </div>

              {/* TELEPHONE */}

              <div
                className={
                  styles.field
                }
              >

                <label htmlFor="phone">
                  Téléphone
                </label>

                <input
                  id="phone"
                  type="text"
                  name="phone"
                  value={
                    settings.phone
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ex : +243 ..."
                />

              </div>

              {/* ADRESSE */}

              <div
                className={`${styles.field} ${styles.fullWidth}`}
              >

                <label htmlFor="address">
                  Adresse
                </label>

                <input
                  id="address"
                  type="text"
                  name="address"
                  value={
                    settings.address
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Adresse du magasin"
                />

              </div>

              {/* DEVISE */}

              <div
                className={
                  styles.field
                }
              >

                <label htmlFor="currency">
                  Devise
                </label>

                <select
                  id="currency"
                  name="currency"
                  value={
                    settings.currency
                  }
                  onChange={
                    handleChange
                  }
                >

                  <option value="FC">
                    FC
                  </option>

                  <option value="$">
                    Dollar ($)
                  </option>

                  <option value="€">
                    Euro (€)
                  </option>

                </select>

              </div>

            </div>

          </section>

          {/* ==========================
              ADMINISTRATEUR
          ========================== */}

          <section
            className={
              styles.settingsCard
            }
          >

            <div
              className={
                styles.cardHeader
              }
            >

              <div
                className={
                  styles.cardIcon
                }
              >
                👤
              </div>

              <div>
                <h2>
                  Administrateur
                </h2>

                <p>
                  Informations du responsable
                  du magasin
                </p>
              </div>

            </div>

            <div
              className={
                styles.formGrid
              }
            >

              {/* NOM ADMIN */}

              <div
                className={`${styles.field} ${styles.fullWidth}`}
              >

                <label htmlFor="adminName">
                  Nom de l'administrateur
                </label>

                <input
                  id="adminName"
                  type="text"
                  name="adminName"
                  value={
                    settings.adminName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Nom de l'administrateur"
                />

              </div>

              {/* EMAIL ADMIN */}

              <div
                className={`${styles.field} ${styles.fullWidth}`}
              >

                <label htmlFor="adminEmail">
                  Adresse email
                </label>

                <input
                  id="adminEmail"
                  type="email"
                  name="adminEmail"
                  value={
                    settings.adminEmail
                  }
                  readOnly
                  disabled
                />

                <small>
                  Cette adresse provient du
                  compte administrateur.
                </small>

              </div>

            </div>

          </section>

          {/* ==========================
              SÉCURITÉ
          ========================== */}

          <section
            className={
              styles.settingsCard
            }
          >

            <div
              className={
                styles.cardHeader
              }
            >

              

              <div>
                <h2>
                  Sécurité et accès
                </h2>

                <p>
                  Gestion des accès au système
                </p>
              </div>

            </div>

            <div
              className={
                styles.securityInfo
              }
            >

              <div>
                <strong>
                  Accès des employés
                </strong>

                <p>
                  Chaque employé possède
                  maintenant son propre code
                  d'accès et ses propres
                  permissions.
                </p>
              </div>

              <div>
                <strong>
                  Administrateur
                </strong>

                <p>
                  L'administrateur possède
                  les droits de gestion du
                  magasin et des employés.
                </p>
              </div>

            </div>

          </section>

          {/* ==========================
              STOCK
          ========================== */}

          <section
            className={
              styles.settingsCard
            }
          >

            <div
              className={
                styles.cardHeader
              }
            >



              <div>
                <h2>
                  Stock
                </h2>

                <p>
                  Configuration des alertes
                  de stock
                </p>
              </div>

            </div>

            <div
              className={
                styles.formGrid
              }
            >

              {/* SEUIL */}

              <div
                className={
                  styles.field
                }
              >

                <label htmlFor="defaultAlertStock">
                  Seuil d'alerte
                </label>

                <input
                  id="defaultAlertStock"
                  type="number"
                  name="defaultAlertStock"
                  value={
                    settings.defaultAlertStock
                  }
                  onChange={
                    handleChange
                  }
                  min="0"
                />

                <small>
                  Niveau à partir duquel
                  un produit est considéré
                  comme ayant un stock faible.
                </small>

              </div>

              {/* SWITCH */}

              <div
                className={
                  styles.toggleField
                }
              >

                <div>
                  <strong>
                    Alertes de stock faible
                  </strong>

                  <p>
                    Activer les alertes
                    lorsque le stock devient
                    faible.
                  </p>
                </div>

                <label
                  className={
                    styles.switch
                  }
                >

                  <input
                    type="checkbox"
                    name="lowStockAlerts"
                    checked={
                      settings.lowStockAlerts
                    }
                    onChange={
                      handleChange
                    }
                  />

                  <span
                    className={
                      styles.slider
                    }
                  ></span>

                </label>

              </div>

            </div>

          </section>

          {/* ==========================
              EMPLOYÉS
          ========================== */}

          <section
            className={`${styles.settingsCard} ${styles.employeeCard}`}
          >

            <div
              className={
                styles.cardHeader
              }
            >

             

              <div>
                <h2>
                  Employés
                </h2>

                <p>
                  Gestion des utilisateurs
                  et de leurs permissions
                </p>
              </div>

            </div>

            <div
              className={
                styles.employeeContent
              }
            >

              <div>

                <strong>
                  Gérer les employés
                </strong>

                <p>
                  Créez les comptes de vos
                  employés et définissez leur
                  rôle et leurs limites d'accès.
                </p>

                <p>
                  Par exemple, un caissier
                  peut avoir uniquement accès
                  au POS, tandis qu'un manager
                  peut avoir accès au stock,
                  aux produits et aux rapports.
                </p>

              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  handleManageEmployees
                }
              >
                Gérer les employés →
              </button>

            </div>

          </section>

        </div>

        {/* ==========================
            BOUTON ENREGISTRER
        ========================== */}

        <div
          className={
            styles.saveContainer
          }
        >

          <button
            type="submit"
            className={
              styles.saveButton
            }
            disabled={saving}
          >
            {saving
              ? "Enregistrement..."
              : "Enregistrer les paramètres"}
          </button>

        </div>

      </form>

    </div>
  );
}

export default Settings;

