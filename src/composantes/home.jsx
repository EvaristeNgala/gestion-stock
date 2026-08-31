import { useNavigate } from "react-router-dom";

function Home() {

  const navigate = useNavigate();

  return (

    <div style={styles.container}>

      {/* Overlay */}

      <div style={styles.overlay}></div>

      {/* Content */}

      <div style={styles.content}>

        {/* Logo */}

        <div style={styles.logoContainer}>

          <img
            src="https://cdn-icons-png.flaticon.com/512/263/263142.png"
            alt="Logo"
            style={styles.logo}
          />

        </div>

        {/* Nom boutique */}

        <h1 style={styles.title}>
          Mon Magasin POS
        </h1>

        {/* Description */}

        <p style={styles.subtitle}>
          Gestion simple et intelligente
          des produits, stocks et ventes
        </p>

        {/* Bouton */}

        <button
          style={styles.button}
          onClick={() => navigate("/dashboard")}
        >
          Entrer dans le système
        </button>

      </div>

    </div>
  );
}

const styles = {

  container: {
    position: "relative",
    width: "100%",
    height: "100vh",
    backgroundImage:
      "url('https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=1400&auto=format&fit=crop')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },

  overlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    background: "rgba(15, 23, 42, 0.75)"
  },

  content: {
    position: "relative",
    zIndex: 2,
    textAlign: "center",
    color: "white",
    padding: 20,
    width: "100%",
    maxWidth: 500
  },

  logoContainer: {
    marginBottom: 20
  },

  logo: {
    width: 120,
    height: 120,
    objectFit: "contain"
  },

  title: {
    fontSize: "3rem",
    fontWeight: "bold",
    marginBottom: 15
  },

  subtitle: {
    fontSize: "1.1rem",
    lineHeight: 1.6,
    color: "#e2e8f0",
    marginBottom: 30
  },

  button: {
    padding: "15px 30px",
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "white",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "0.3s"
  }
};

export default Home;