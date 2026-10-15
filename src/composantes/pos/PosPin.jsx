import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import "./posAccess.css";

const readDevice = () => { try { return JSON.parse(localStorage.getItem("stockManagerDeviceStore") || "null"); } catch { return null; } };
export default function PosPin({ onUnlock }) {
  const navigate = useNavigate();
  const [device] = useState(readDevice);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  useEffect(() => onAuthStateChanged(auth, user => {
    if (!user || !device || user.uid !== device.adminUid) { navigate("/", {replace:true}); return; }
    setVerified(true);
  }), [device, navigate]);
  const verify = async (code) => {
    if (!device || busy) return;
    setBusy(true); setError("");
    try {
      if (!navigator.onLine) throw new Error("Internet requis pour cette première version de vérification du PIN.");
      // Vérification provisoire pour les tests : à remplacer par une fonction serveur sécurisée.
      const settings = await getDoc(doc(db, "settings", device.storeId));
      const adminCode = String(settings.data()?.adminPosCode ?? "").trim();
      let account = null;
      if (adminCode && adminCode === code) {
        const admin = await getDoc(doc(db, "users", device.adminUid));
        if (!admin.exists() || admin.data().storeId !== device.storeId || admin.data().status === "inactive") throw new Error("Administrateur non autorisé.");
        account = {uid:device.adminUid,userId:device.adminUid,name:admin.data().name || "Administrateur",role:"admin",loginMode:"admin",storeId:device.storeId,storeName:device.storeName,permissions:{pos:true,sales:true,expenses:true,settings:true,"cash-history":true}};
      } else {
        const users = await getDocs(query(collection(db,"users"),where("storeId","==",device.storeId),where("code","==",code)));
        if (users.size !== 1) throw new Error("Code PIN incorrect ou attribué à plusieurs utilisateurs.");
        const item = users.docs[0], data = item.data();
        if (!["cashier","manager"].includes(data.role) || data.status === "inactive" || data.canAccessPOS === false || data.permissions?.pos !== true) throw new Error("Cet utilisateur n'est pas autorisé à utiliser le POS.");
        account = {uid:item.id,userId:item.id,name:data.name || "Employé",role:data.role,loginMode:"employeeCode",storeId:device.storeId,storeName:device.storeName,permissions:data.permissions || {}};
      }
      localStorage.setItem("storeSession",JSON.stringify(account));
      onUnlock(); navigate("/pos",{replace:true});
    } catch (e) { setError(e?.message || "Impossible de vérifier ce code."); setPin(""); }
    finally { setBusy(false); }
  };
  const digit = (value) => {
    if (busy) return;
    if (value === "erase") { setPin(s=>s.slice(0,-1)); setError(""); return; }
    const next = (pin + value).slice(0,4); setPin(next); setError("");
    if (next.length === 4) verify(next);
  };
  if (!verified) return <main className="sm-access">Vérification de la connexion…</main>;
  return <main className="sm-pin-screen"><section className="sm-pin-top">
    <div className="sm-logo">▦</div><h1>STOCK MANAGER <span>POS</span></h1>
    <p className="sm-store-name">{device?.storeName}</p><p>Saisissez votre code PIN</p>
    <div className="sm-pin-dots" aria-label={`${pin.length} chiffres saisis`}>{[0,1,2,3].map(i=><span key={i} className={i<pin.length?"filled":""}/>)}</div>
    {error && <p role="alert" className="sm-error">{error}</p>}{busy && <p>Vérification…</p>}
  </section><section className="sm-keypad" aria-label="Clavier numérique">
    {["1","2","3","4","5","6","7","8","9","","0","erase"].map((value,i)=>value ? <button key={i} type="button" disabled={busy} onClick={()=>digit(value)}>{value==="erase"?"Effacer":value}</button> : <div key={i}/>)}
  </section></main>;
}
