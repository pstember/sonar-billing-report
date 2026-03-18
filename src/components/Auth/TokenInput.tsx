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

    const trimmedKey = enterpriseKey.trim();
    if (!trimmedKey) {
      setError('Please enter your Enterprise Key. It identifies your enterprise and filters the list of organizations in the dashboard.');
      return;
    }

    setIsValidating(true);

    try {
      // Create service instance to validate
      const service = new SonarCloudService({
        baseUrl,
        token,
        enterpriseKey: trimmedKey,
      });

      // Validate token
      const isValid = await service.validateToken();

      if (!isValid) {
        setError('Invalid token. Please check your token and try again.');
        setIsValidating(false);
        return;
      }

      // Validate enterprise key: resolve UUID then fetch org list (enterprise-organizations uses enterpriseId)
      try {
        const enterprises = await service.getEnterpriseDetails(trimmedKey);
        const enterpriseId = enterprises?.[0]?.id;
        if (!enterpriseId) {
          setError('Invalid or unauthorized Enterprise Key. Please check the key and try again.');
          setIsValidating(false);
          return;
        }
        await service.getEnterpriseOrganizations(enterpriseId);
      } catch {
        setError('Invalid or unauthorized Enterprise Key. Please check the key and try again.');
        setIsValidating(false);
        return;
      }

      // Save to database — enterprise key is required; org is selected in dashboard
      await saveAuthConfig({
        token,
        baseUrl,
        enterpriseKey: trimmedKey,
        organization: undefined,
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

          <div className="mb-6 p-4 bg-sonar-blue/5 border-l-4 border-sonar-blue rounded">
            <h3 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">What you'll need</h3>
            <ul className="text-xs space-y-1 text-gray-600 dark:text-slate-300">
              <li>✓ A SonarCloud token with read access</li>
              <li>✓ Your enterprise key (found in Admin settings)</li>
              <li>✓ 2 minutes to set up your first cost centers</li>
            </ul>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(e); }} className="space-y-6">
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-sonar-purple dark:text-white mb-2 font-body"
              >
                SonarCloud Access Token *
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
                Need read access to: organizations, projects, and measures
                <br />
                <a
                  href="https://sonarcloud.io/account/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sonar-blue hover:underline"
                >
                  Generate token at sonarcloud.io/account/security →
                </a>
              </p>
            </div>

            <div>
              <label
                htmlFor="enterpriseKey"
                className="block text-sm font-medium text-sonar-purple dark:text-white mb-2 font-body"
              >
                Enterprise Key *
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
                Your enterprise identifier (e.g., "acme-corp")
                <br />
                Find it in SonarCloud under Administration → Enterprise
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
              {isValidating ? 'Connecting...' : 'Continue to Dashboard →'}
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
