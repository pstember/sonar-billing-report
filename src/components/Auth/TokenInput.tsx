/**
 * Token Input Component
 * Handles SonarCloud token authentication
 */

import { useState } from 'react';
import { saveAuthConfig } from '../../services/db';
import SonarCloudService from '../../services/sonarcloud';
import ThemeSelector from '../ThemeSelector';

interface TokenInputProps {
  onSuccess: () => void;
}

export default function TokenInput({ onSuccess }: TokenInputProps) {
  const [token, setToken] = useState('');
  const [baseUrl] = useState(''); // Empty string to use proxy server
  const [enterpriseKey, setEnterpriseKey] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Please enter your SonarCloud token');
      return;
    }

    setIsValidating(true);

    try {
      // Create service instance to validate
      const service = new SonarCloudService({
        baseUrl,
        token,
        enterpriseKey: enterpriseKey || undefined,
      });

      // Validate token
      const isValid = await service.validateToken();

      if (!isValid) {
        setError('Invalid token. Please check your token and try again.');
        setIsValidating(false);
        return;
      }

      // Save to database
      // Don't save a default organization when using enterprise mode
      // The dropdown will handle organization selection
      await saveAuthConfig({
        token,
        baseUrl,
        enterpriseKey: enterpriseKey || undefined,
        organization: undefined, // Let user select from dropdown
        organizationName: undefined,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate token');
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sonar-background to-sonar-blue-light dark:from-slate-950 dark:to-slate-900 p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-8 border-t-4 border-sonar-blue">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-sonar-purple dark:text-white mb-2">
              SonarCloud Billing
            </h1>
            <p className="text-gray-600 dark:text-slate-300 font-body">
              Enter your enterprise credentials to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-sonar-purple dark:text-white mb-2 font-body"
              >
                Personal Access Token *
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sonar-blue focus:border-sonar-blue dark:bg-gray-700 dark:text-white font-body transition-all"
                placeholder="Enter your SonarCloud token"
                disabled={isValidating}
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-300 font-body">
                Generate from: Account → Security → Tokens
              </p>
            </div>

            <div>
              <label
                htmlFor="enterpriseKey"
                className="block text-sm font-medium text-sonar-purple dark:text-white mb-2 font-body"
              >
                Enterprise Key (Optional)
              </label>
              <input
                id="enterpriseKey"
                type="text"
                value={enterpriseKey}
                onChange={(e) => setEnterpriseKey(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sonar-blue focus:border-sonar-blue dark:bg-gray-700 dark:text-white font-body transition-all"
                placeholder="your-enterprise-key"
                disabled={isValidating}
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-300 font-body">
                Leave blank to access all organizations you have access to
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-body">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isValidating}
              className="btn-sonar-primary w-full py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isValidating ? 'Validating...' : 'Connect to SonarCloud'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-slate-300 text-center font-body">
              Your token is stored securely in your browser's local database.
              <br />
              It is never sent to any server except SonarCloud.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
