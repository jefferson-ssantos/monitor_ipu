import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import orysLogo from "@/assets/orys-logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="flex justify-center mb-8">
          <img src={orysLogo} alt="Orys Logo" className="h-16" />
        </div>
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Página não encontrada</p>
        <a href="/" className="text-secondary hover:text-secondary/80 underline">
          Voltar ao Início
        </a>
      </div>
    </div>
  );
};

export default NotFound;