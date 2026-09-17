import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";

import styles from "./employees.module.css";

function Employees() {
  const navigate = useNavigate();

  // ==========================================
  // SESSION
  // ==========================================

  const savedSession =
    localStorage.getItem("storeSession");

  let session = null;

  try {
    session = savedSession
      ? JSON.parse(savedSession)
      : null;
  } catch (error) {
    console.error(
      "Session invalide :",
      error
    );
  }

  const storeId =
    session?.storeId || "";

  const storeName =
    session?.storeName || "";

  // ==========================================
  // ÉTATS
  // ==========================================

  const [employees, setEmployees] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [name, setName] =
    useState("");

  const [code, setCode] =
    useState("");

  const [role, setRole] =
    useState("cashier");

  const [permissions, setPermissions] =
    useState({
      pos: true,
      products: false,
      stock: false,
      sales: false,
      expenses: false,
      reports: false,
      settings: false,
    });

  const [saving, setSaving] =
    useState(false);

  // ==========================================
  // PERMISSIONS CAISSIER
  // ==========================================

  const cashierPermissions = {
    pos: true,
    products: false,
    stock: false,
    sales: false,
    expenses: false,
    reports: false,
    settings: false,
  };

  // ==========================================
  // PERMISSIONS MANAGER
  // ==========================================

  const managerPermissions = {
    pos: true,
    products: true,
    stock: true,
    sales: true,
    expenses: true,
    reports: true,
    settings: false,
  };

  // ==========================================
  // CHARGER LES EMPLOYÉS
  // ==========================================

  useEffect(() => {
    if (!storeId) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    const employeesQuery = query(
      collection(db, "users"),
      where(
        "storeId",
        "==",
        storeId
      ),
      where(
        "role",
        "in",
        [
          "cashier",
          "manager",
        ]
      )
    );

    const unsubscribe =
      onSnapshot(
        employeesQuery,
        (snapshot) => {
          const employeesList =
            snapshot.docs.map(
              (employeeDoc) => ({
                id: employeeDoc.id,
                ...employeeDoc.data(),
              })
            );

          // Trier par date de création
          employeesList.sort(
            (a, b) => {
              const dateA =
                a.createdAt?.toDate?.() ||
                new Date(0);

              const dateB =
                b.createdAt?.toDate?.() ||
                new Date(0);

              return dateB - dateA;
            }
          );

          setEmployees(
            employeesList
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            "Erreur chargement employés :",
            error
          );

          setEmployees([]);
          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, [storeId]);

  // ==========================================
  // GÉNÉRER UN CODE
  // ==========================================

  const generateCode = () => {
    const generatedCode =
      Math.floor(
        100000 +
          Math.random() * 900000
      ).toString();

    setCode(generatedCode);
  };

  // ==========================================
  // CHANGEMENT DU RÔLE
  // ==========================================

  const handleRoleChange = (
    newRole
  ) => {
    setRole(newRole);

    if (
      newRole === "manager"
    ) {
      setPermissions({
        ...managerPermissions,
      });
    } else {
      setPermissions({
        ...cashierPermissions,
      });
    }
  };

  // ==========================================
  // CHANGER UNE PERMISSION
  // ==========================================

  const handlePermissionChange = (
    permission
  ) => {
    setPermissions(
      (previous) => ({
        ...previous,
        [permission]:
          !previous[permission],
      })
    );
  };

  // ==========================================
  // AJOUTER UN EMPLOYÉ
  // ==========================================

  const handleAddEmployee =
    async (e) => {
      e.preventDefault();

      if (!storeId) {
        alert(
          "Aucun magasin connecté."
        );
        return;
      }

      if (!storeName) {
        alert(
          "Le nom du magasin est introuvable dans la session."
        );
        return;
      }

      if (!name.trim()) {
        alert(
          "Veuillez entrer le nom de l'employé."
        );
        return;
      }

      if (!code.trim()) {
        alert(
          "Veuillez entrer ou générer un code."
        );
        return;
      }

      if (
        code.trim().length !== 6
      ) {
        alert(
          "Le code doit contenir exactement 6 chiffres."
        );
        return;
      }

      try {
        setSaving(true);

        // ==========================================
        // VÉRIFIER SI LE CODE EXISTE DÉJÀ
        // DANS CE MAGASIN
        // ==========================================

        const duplicateQuery =
          query(
            collection(
              db,
              "users"
            ),
            where(
              "storeId",
              "==",
              storeId
            ),
            where(
              "code",
              "==",
              code.trim()
            )
          );

        const duplicateSnapshot =
          await getDocs(
            duplicateQuery
          );

        if (
          !duplicateSnapshot.empty
        ) {
          alert(
            "Ce code est déjà utilisé par un employé de ce magasin."
          );
          return;
        }

        // ==========================================
        // CRÉER L'EMPLOYÉ
        // ==========================================

        const employeeData = {
          storeId,

          storeName,

          name:
            name.trim(),

          code:
            code.trim(),

          role,

          status:
            "active",

          permissions: {
            ...permissions,
          },

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        };

        await addDoc(
          collection(
            db,
            "users"
          ),
          employeeData
        );

        // ==========================================
        // NETTOYER LE FORMULAIRE
        // ==========================================

        setName("");

        setCode("");

        setRole(
          "cashier"
        );

        setPermissions({
          ...cashierPermissions,
        });

        alert(
          "Employé ajouté avec succès."
        );

      } catch (error) {
        console.error(
          "Erreur ajout employé :",
          error
        );

        alert(
          "Une erreur est survenue lors de l'ajout de l'employé."
        );
      } finally {
        setSaving(false);
      }
    };

  // ==========================================
  // CHANGER LE STATUT
  // ==========================================

  const toggleEmployeeStatus =
    async (employee) => {
      try {
        const employeeRef =
          doc(
            db,
            "users",
            employee.id
          );

        await updateDoc(
          employeeRef,
          {
            status:
              employee.status ===
              "active"
                ? "inactive"
                : "active",

            updatedAt:
              serverTimestamp(),
          }
        );
      } catch (error) {
        console.error(
          "Erreur changement statut :",
          error
        );

        alert(
          "Impossible de modifier le statut."
        );
      }
    };

  // ==========================================
  // SUPPRIMER UN EMPLOYÉ
  // ==========================================

  const handleDeleteEmployee =
    async (employee) => {
      const confirmation =
        window.confirm(
          `Voulez-vous vraiment supprimer ${employee.name} ?`
        );

      if (!confirmation) {
        return;
      }

      try {
        await deleteDoc(
          doc(
            db,
            "users",
            employee.id
          )
        );
      } catch (error) {
        console.error(
          "Erreur suppression employé :",
          error
        );

        alert(
          "Impossible de supprimer cet employé."
        );
      }
    };

  // ==========================================
  // LABEL PERMISSION
  // ==========================================

  const permissionLabels = {
    pos: "Caisse / POS",
    products: "Produits",
    stock: "Stock",
    sales: "Ventes",
    expenses: "Charges",
    reports: "Rapports",
    settings: "Paramètres",
  };

  // ==========================================
  // AFFICHAGE
  // ==========================================

  return (
    <div
      className={
        styles.container
      }
    >

      {/* ======================================
          EN-TÊTE
      ====================================== */}

      <div
        className={
          styles.header
        }
      >

        <button
          className={
            styles.backButton
          }
          onClick={() =>
            navigate(
              "/settings"
            )
          }
        >
          ← Retour
        </button>

        <div>

          <h1>
            Gestion des employés
          </h1>

          <p>
            Créez les accès et définissez
            les permissions de chaque employé.
          </p>

        </div>

      </div>

      <div
        className={
          styles.content
        }
      >

        {/* ======================================
            FORMULAIRE
        ====================================== */}

        <div
          className={
            styles.formCard
          }
        >

          <h2>
            Ajouter un employé
          </h2>

          <form
            onSubmit={
              handleAddEmployee
            }
          >

            {/* NOM */}

            <div
              className={
                styles.formGroup
              }
            >

              <label>
                Nom de l'employé
              </label>

              <input
                type="text"
                placeholder="Ex : Jean"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
              />

            </div>

            {/* RÔLE */}

            <div
              className={
                styles.formGroup
              }
            >

              <label>
                Rôle
              </label>

              <select
                value={role}
                onChange={(e) =>
                  handleRoleChange(
                    e.target.value
                  )
                }
              >

                <option value="cashier">
                  Caissier
                </option>

                <option value="manager">
                  Manager
                </option>

              </select>

            </div>

            {/* CODE */}

            <div
              className={
                styles.formGroup
              }
            >

              <label>
                Code personnel
              </label>

              <div
                className={
                  styles.codeRow
                }
              >

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 chiffres"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.replace(
                        /\D/g,
                        ""
                      )
                    )
                  }
                />

                <button
                  type="button"
                  className={
                    styles.generateButton
                  }
                  onClick={
                    generateCode
                  }
                >
                  Générer
                </button>

              </div>

              <small>
                Ce code sera utilisé par
                l'employé pour se connecter.
              </small>

            </div>

            {/* PERMISSIONS */}

            <div
              className={
                styles.permissionsSection
              }
            >

              <h3>
                Permissions
              </h3>

              <div
                className={
                  styles.permissionsGrid
                }
              >

                {Object.keys(
                  permissionLabels
                ).map(
                  (permission) => (
                    <label
                      key={
                        permission
                      }
                      className={
                        styles.permissionItem
                      }
                    >

                      <input
                        type="checkbox"
                        checked={
                          permissions[
                            permission
                          ] === true
                        }
                        onChange={() =>
                          handlePermissionChange(
                            permission
                          )
                        }
                      />

                      <span>
                        {
                          permissionLabels[
                            permission
                          ]
                        }
                      </span>

                    </label>
                  )
                )}

              </div>

            </div>

            {/* BOUTON */}

            <button
              type="submit"
              className={
                styles.saveButton
              }
              disabled={saving}
            >
              {saving
                ? "Création..."
                : "Ajouter l'employé"}
            </button>

          </form>

        </div>

        {/* ======================================
            LISTE DES EMPLOYÉS
        ====================================== */}

        <div
          className={
            styles.listCard
          }
        >

          <div
            className={
              styles.listHeader
            }
          >

            <div>

              <h2>
                Employés
              </h2>

              <p>
                {employees.length} employé
                {employees.length > 1
                  ? "s"
                  : ""}
              </p>

            </div>

          </div>

          {loading ? (
            <div
              className={
                styles.emptyMessage
              }
            >
              Chargement...
            </div>
          ) : employees.length ===
            0 ? (
            <div
              className={
                styles.emptyMessage
              }
            >
              Aucun employé pour le moment.
            </div>
          ) : (
            <div
              className={
                styles.employeeList
              }
            >

              {employees.map(
                (employee) => (
                  <div
                    key={
                      employee.id
                    }
                    className={
                      styles.employeeCard
                    }
                  >

                    {/* INFORMATIONS */}

                    <div
                      className={
                        styles.employeeMain
                      }
                    >

                      <div
                        className={
                          styles.employeeAvatar
                        }
                      >
                        {employee.name
                          ?.charAt(0)
                          ?.toUpperCase() ||
                          "?"}
                      </div>

                      <div>

                        <h3>
                          {
                            employee.name
                          }
                        </h3>

                        <span
                          className={
                            styles.roleBadge
                          }
                        >
                          {
                            employee.role ===
                            "manager"
                              ? "Manager"
                              : "Caissier"
                          }
                        </span>

                      </div>

                    </div>

                    {/* CODE */}

                    <div
                      className={
                        styles.employeeCode
                      }
                    >

                      <span>
                        Code
                      </span>

                      <strong>
                        {
                          employee.code
                        }
                      </strong>

                    </div>

                    {/* PERMISSIONS */}

                    <div
                      className={
                        styles.permissionBadges
                      }
                    >

                      {Object.entries(
                        employee.permissions ||
                          {}
                      )
                        .filter(
                          ([, value]) =>
                            value === true
                        )
                        .map(
                          ([
                            permission,
                          ]) => (
                            <span
                              key={
                                permission
                              }
                              className={
                                styles.permissionBadge
                              }
                            >
                              {
                                permissionLabels[
                                  permission
                                ]
                              }
                            </span>
                          )
                        )}

                    </div>

                    {/* STATUT */}

                    <div
                      className={
                        styles.statusRow
                      }
                    >

                      <span
                        className={
                          employee.status ===
                          "active"
                            ? styles.active
                            : styles.inactive
                        }
                      >
                        {
                          employee.status ===
                          "active"
                            ? "Actif"
                            : "Désactivé"
                        }
                      </span>

                    </div>

                    {/* ACTIONS */}

                    <div
                      className={
                        styles.actions
                      }
                    >

                      <button
                        type="button"
                        className={
                          styles.statusButton
                        }
                        onClick={() =>
                          toggleEmployeeStatus(
                            employee
                          )
                        }
                      >
                        {
                          employee.status ===
                          "active"
                            ? "Désactiver"
                            : "Activer"
                        }
                      </button>

                      <button
                        type="button"
                        className={
                          styles.deleteButton
                        }
                        onClick={() =>
                          handleDeleteEmployee(
                            employee
                          )
                        }
                      >
                        Supprimer
                      </button>

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default Employees;
