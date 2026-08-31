import { useNavigate } from "react-router-dom";
import styles from "./dashbord.module.css";

function Dashboard() {
  const navigate = useNavigate();

  const cards = [

    {
      title: "Produits",
      description:
        "Gestion des produits",
      path: "/products",
      icon: "📦"
    },

    {
      title: "Stock",
      description:
        "Gestion des stocks",
      path: "/stock",
      icon: "🏪"
    },

    {
      title: "POS",
      description:
        "Point de vente",
      path: "/pos",
      icon: "💳"
    },

    {
      title: "Rapports",
      description:
        "Statistiques et rapports",
      path: "/reports",
      icon: "📊"
    },

    {
      title: "Paramètres",
      description:
        "Configuration système",
      path: "/settings",
      icon: "⚙️"
    }

  ];
  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.menu}>☰</div>

        <h1>Stock Manager</h1>

        <div className={styles.logo}>🏪</div>
      </header>

      <section className={styles.userCard}>
        <div className={styles.avatar}>👤</div>

        <div>
          <h2>Bienvenue Evariste</h2>
          <p>Mode Local</p>
          <span>Version Active</span>
        </div>
      </section>

      <section className={styles.banner}>
        <div>
          <h3>Meilleure solution</h3>
          <p>pour gérer votre magasin</p>
        </div>

        <div className={styles.phone}>📱</div>
      </section>

      <section className={styles.grid}>
        {cards.map((item) => (
          <button
            key={item.title}
            className={styles.card}
            onClick={() => navigate(item.path)}
          >
            <h2 style={{ color:'#1e3a8a'}}>{item.title}</h2>
            <p style={{marginTop:'-10px'}}>
              {item.description}
            </p>
          </button>
        ))}
      </section>

      <nav className={styles.bottomNav}>
        <button className={styles.active}>🏠</button>
        <button>🔔</button>
        <button>🧾</button>
        <button>👤</button>
      </nav>
    </div>
  );
}

export default Dashboard;