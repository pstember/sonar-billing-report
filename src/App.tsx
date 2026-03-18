import { useEffect, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from './config/queryClient';
import { getAuthConfig } from './services/db';
import TokenInput from './components/Auth/TokenInput';
import BillingDashboard from './components/Billing/BillingDashboard';
import ThemeSelector from './components/ThemeSelector';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const auth = await getAuthConfig();
    // Enterprise key is required; treat missing key as not authenticated
    setIsAuthenticated(!!(auth?.token && auth?.enterpriseKey?.trim()));
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sonar-background relative">
        <div className="absolute top-4 right-4">
          <ThemeSelector />
        </div>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-sonar-blue mx-auto"></div>
          <p className="mt-4 text-sonar-purple dark:text-white font-body font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <TokenInput onSuccess={() => setIsAuthenticated(true)} />
      </PersistQueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <BillingDashboard />
    </PersistQueryClientProvider>
  );
}

export default App;
