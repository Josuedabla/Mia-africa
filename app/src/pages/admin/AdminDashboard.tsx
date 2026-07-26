/**
 * AdminDashboard Component
 * Main admin dashboard with ads management and subscription settings
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, Zap, Settings, TrendingUp } from 'lucide-react';
import AdminAds from './AdminAds';
import AdminSubscriptions from './AdminSubscriptions';
import AdminStats from './AdminStats';

type TabType = 'stats' | 'ads' | 'subscriptions' | 'settings';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('stats');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'stats', label: 'Statistiques', icon: <BarChart3 size={20} /> },
    { id: 'ads', label: 'Publicités', icon: <Zap size={20} /> },
    { id: 'subscriptions', label: 'Abonnements', icon: <Users size={20} /> },
    { id: 'settings', label: 'Paramètres', icon: <Settings size={20} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-mia-green-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-mia-green-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        {activeTab === 'stats' && <AdminStats />}
        {activeTab === 'ads' && <AdminAds />}
        {activeTab === 'subscriptions' && <AdminSubscriptions />}
        {activeTab === 'settings' && <AdminSettings />}
      </motion.div>
    </div>
  );
};

/**
 * AdminSettings Component
 */
const AdminSettings: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Paramètres Admin</h2>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Seuils d'abonnement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Livraisons gratuites (livreur)
              </label>
              <input
                type="number"
                defaultValue="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commandes gratuites (vendeur)
              </label>
              <input
                type="number"
                defaultValue="500"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Prix des abonnements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Abonnement livreur (XOF/mois)
              </label>
              <input
                type="number"
                defaultValue="5000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Abonnement vendeur (XOF/mois)
              </label>
              <input
                type="number"
                defaultValue="10000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Commission MIA</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission vendeur (%)
              </label>
              <input
                type="number"
                defaultValue="5"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission livreur (%)
              </label>
              <input
                type="number"
                defaultValue="10"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission publicité (%)
              </label>
              <input
                type="number"
                defaultValue="15"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          Enregistrer les paramètres
        </motion.button>
      </div>
    </div>
  );
};

export default AdminDashboard;
