import { useState, useEffect, useCallback } from 'react';

/**
 * Módulos que devem receber imunidade total à inatividade de 15 minutos:
 * 1. Previsão de Horas
 * 2. Portal de Inventário
 * 3. Gestão de Expedição
 * 4. Central de Fardamento & Admissões
 * 5. Oficina Elétrica
 * 6. Check List & Inspeções
 */
export const rotasImunesInatividade: string[] = [
  // 1. Previsão de Horas
  '/previsao-horas',
  '/previsao-he',
  '/app/previsao-he',
  '/previsao',

  // 2. Portal de Inventário
  '/inventario',
  '/inventarios',
  '/portal-inventario',
  '/app/inventarios',

  // 3. Gestão de Expedição
  '/expedicao',
  '/gestao-expedicao',
  '/app/gestao-expedicao',

  // 4. Central de Fardamento & Admissões
  '/fardamentos-admissoes',
  '/central-fardamento',
  '/app/central-fardamento',

  // 5. Oficina Elétrica
  '/oficina-eletrica',
  '/app/oficina-eletrica',

  // 6. Check List & Inspeções
  '/inspecoes',
  '/checklist',
  '/app/checklist'
];

export const viewsImunesInatividade: string[] = [
  'previsao-he',
  'portal-inventario',
  'gestao-expedicao',
  'central-fardamento',
  'oficina-eletrica',
  'CHECKLIST'
];

/**
 * Função utilitária para checar se a rota ou tela atual possui imunidade ao timeout de inatividade.
 */
export function checkIsRotaOuModuloImune(pathname?: string): boolean {
  if (typeof window === 'undefined') return false;

  const currentPath = pathname ?? window.location.pathname;
  const currentHash = window.location.hash.replace(/^#/, '');

  // 1. Checa correspondência por prefixo de rota ou hash
  const matchesRoute = rotasImunesInatividade.some(rota => 
    currentPath.startsWith(rota) || currentHash.startsWith(rota)
  );
  if (matchesRoute) return true;

  // 2. Checa se há marcador no DOM para módulos operacionais ou Modo TV
  if (typeof document !== 'undefined') {
    if (document.getElementById('active-immune-module-flag') !== null) {
      return true;
    }
    if (document.querySelector('[data-immune-module="true"]') !== null) {
      return true;
    }
    if (document.getElementById('active-tv-mode-flag') !== null) {
      return true;
    }
  }

  return false;
}

/**
 * Hook de rota para acompanhar alterações de rota/pathname em ambientes SPA.
 */
export function useLocation() {
  const [location, setLocation] = useState(() => ({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    search: typeof window !== 'undefined' ? window.location.search : '',
    hash: typeof window !== 'undefined' ? window.location.hash : ''
  }));

  const updateLocation = useCallback(() => {
    if (typeof window === 'undefined') return;
    setLocation({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', updateLocation);
    window.addEventListener('locationchange', updateLocation);

    return () => {
      window.removeEventListener('popstate', updateLocation);
      window.removeEventListener('locationchange', updateLocation);
    };
  }, [updateLocation]);

  return location;
}
