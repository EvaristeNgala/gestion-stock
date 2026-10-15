import { useEffect, useState } from "react";



import { useNavigate } from "react-router-dom";

import { Capacitor, registerPlugin } from "@capacitor/core";



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



const ReceiptPrinter = registerPlugin("ReceiptPrinter");







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

  const [diagnosing, setDiagnosing] = useState(false);

  const [printerDiagnostic, setPrinterDiagnostic] = useState(null);

  const [printerDiagnosticError, setPrinterDiagnosticError] = useState("");
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const [selectedBluetoothAddress, setSelectedBluetoothAddress] = useState("");
  const [bluetoothLoading, setBluetoothLoading] = useState(false);
  const [bluetoothTesting, setBluetoothTesting] = useState(false);
  const [bluetoothMessage, setBluetoothMessage] = useState("");
  const [bluetoothError, setBluetoothError] = useState("");




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







  const handlePrinterDiagnostic = async () => {

    setPrinterDiagnosticError("");

    setPrinterDiagnostic(null);



    if (!Capacitor.isNativePlatform()) {

      setPrinterDiagnosticError(

        "Ce diagnostic fonctionne uniquement dans l'application Android installée sur le Q2i."

      );

      return;

    }



    setDiagnosing(true);

    try {

      const result = await ReceiptPrinter.diagnose();

      setPrinterDiagnostic(result);

    } catch (err) {

      setPrinterDiagnosticError(

        err?.message || "Impossible d'exécuter le diagnostic de l'imprimante."

      );

    } finally {

      setDiagnosing(false);

    }

  };



  const handleBluetoothSearch = async () => {
    setBluetoothError("");
    setBluetoothMessage("");
    if (!Capacitor.isNativePlatform()) {
      setBluetoothError("Disponible uniquement dans l'APK Android Stock Manager.");
      return;
    }
    setBluetoothLoading(true);
    try {
      const result = await ReceiptPrinter.getBluetoothPrinters();
      const devices = Array.isArray(result?.devices) ? result.devices : [];
      setBluetoothDevices(devices);
      const saved = localStorage.getItem(`stockManagerBluetoothPrinter:${storeId}`);
      setSelectedBluetoothAddress((current) =>
        devices.some((device) => device.address === current) ? current :
        devices.some((device) => device.address === saved) ? saved : ""
      );
      setBluetoothMessage(devices.length
        ? `${devices.length} appareil(s) Bluetooth associé(s) trouvé(s).`
        : "Aucun appareil associé. Vérifie le Bluetooth dans les paramètres Android.");
    } catch (err) {
      setBluetoothError(err?.message || "Recherche Bluetooth impossible.");
    } finally {
      setBluetoothLoading(false);
    }
  };

  const handleBluetoothTest = async () => {
    setBluetoothError("");
    setBluetoothMessage("");
    if (!selectedBluetoothAddress) {
      setBluetoothError("Sélectionne d'abord une imprimante.");
      return;
    }
    setBluetoothTesting(true);
    try {
      const result = await ReceiptPrinter.testBluetoothPrinter({
        address: selectedBluetoothAddress
      });
      setBluetoothMessage(
        result?.message || "Commandes envoyées. Vérifie si un ticket est sorti."
      );
    } catch (err) {
      setBluetoothError(err?.message || "Échec du test Bluetooth.");
    } finally {
      setBluetoothTesting(false);
    }
  };

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



    if (value.length > 4) return;







    setSettings((prev) => ({



      ...prev,



      adminPosCode: value,



    }));







    setMessage("");



    setError("");



  };







  const handleConfirmCodeChange = (e) => {



    const value = e.target.value.replace(/\D/g, "");



    if (value.length > 4) return;







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



      !/^\d{4}$/.test(settings.adminPosCode)



    ) {



      setError(



        "Le code administrateur POS doit contenir exactement 4 chiffres."



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



                      placeholder="4 chiffres"



                      maxLength={4}



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



                    maxLength={4}



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



        <section className={styles.settingsCard} style={{ marginTop: 20 }}>

          <div className={styles.cardHeader}>

            <div>

              <h2>Diagnostic de l'imprimante Q2i</h2>

              <p>Recherche des services d'impression Android installés sur le terminal.</p>

            </div>

          </div>



          <button

            type="button"

            className={styles.secondaryButton}

            onClick={handlePrinterDiagnostic}

            disabled={diagnosing}

          >

            {diagnosing ? "Diagnostic en cours..." : "Diagnostiquer l'imprimante"}

          </button>



          {printerDiagnosticError && (

            <p role="alert" style={{ color: "#b42318", marginTop: 12 }}>

              {printerDiagnosticError}

            </p>

          )}



          {printerDiagnostic && (

            <div style={{ marginTop: 16 }}>

              <strong>Résultats du diagnostic</strong>

              <pre style={{

                whiteSpace: "pre-wrap",

                overflowWrap: "anywhere",

                background: "#f3f4f6",

                color: "#111827",

                borderRadius: 8,

                padding: 12,

                fontSize: 12,

                maxHeight: 380,

                overflowY: "auto"

              }}>

                {JSON.stringify(printerDiagnostic, null, 2)}

              </pre>

              <button

                type="button"

                className={styles.secondaryButton}

                onClick={async () => {

                  try {

                    await navigator.clipboard.writeText(JSON.stringify(printerDiagnostic, null, 2));

                  } catch (err) {

                    setPrinterDiagnosticError("Copie indisponible : faites une capture d'écran des résultats.");

                  }

                }}

              >

                Copier les résultats

              </button>

            </div>

          )}

        </section>



        <section className={styles.settingsCard} style={{ marginTop: 20 }}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Imprimante Bluetooth — test Q2i</h2>
              <p>Recherche des appareils associés et test direct ESC/POS. L'impression actuelle reste disponible.</p>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <button type="button" className={styles.secondaryButton}
              onClick={handleBluetoothSearch} disabled={bluetoothLoading || bluetoothTesting}>
              {bluetoothLoading ? "Recherche en cours..." : "Rechercher les appareils Bluetooth"}
            </button>
          </div>

          <div className={styles.field} style={{ marginBottom: 14 }}>
            <label htmlFor="q2i-bluetooth-device">Appareil Bluetooth associé</label>
            <select id="q2i-bluetooth-device" value={selectedBluetoothAddress}
              onChange={(event) => {
                const address = event.target.value;
                setSelectedBluetoothAddress(address);
                setBluetoothError("");
                setBluetoothMessage("");
                if (address) {
                  localStorage.setItem(`stockManagerBluetoothPrinter:${storeId}`, address);
                } else {
                  localStorage.removeItem(`stockManagerBluetoothPrinter:${storeId}`);
                }
              }}>
              <option value="">Sélectionner une imprimante...</option>
              {bluetoothDevices.map((device) => (
                <option key={device.address} value={device.address}>
                  {device.name} — {device.address}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className={styles.secondaryButton}
            onClick={handleBluetoothTest}
            disabled={!selectedBluetoothAddress || bluetoothLoading || bluetoothTesting}>
            {bluetoothTesting ? "Test en cours..." : "Imprimer un ticket de test Bluetooth"}
          </button>

          {bluetoothMessage && (
            <p role="status" style={{ marginTop: 12, color: "#166534" }}>
              {bluetoothMessage}
            </p>
          )}
          {bluetoothError && (
            <p role="alert" style={{ marginTop: 12, color: "#b42318" }}>
              {bluetoothError}
            </p>
          )}
          <p style={{ marginTop: 12, fontSize: 13 }}>
            Ce test envoie seulement un petit ticket. Un message d'envoi réussi ne garantit
            pas que le papier est sorti. Vérifie directement l'imprimante intégrée.
          </p>
        </section>

    </div>



  );



}







export default Settings;
