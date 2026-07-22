/**
 * AdminAds Component
 * Manage advertising campaigns (manual + automatic CPM)
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Eye, Click, DollarSign } from 'lucide-react';

interface Ad {
  id: string;
  title: string;
  type: 'manual' | 'automatic';
  status: 'active' | 'paused' | 'ended';
  impressions: number;
  clicks: number;
  cpm: number;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
}

const mockAds: Ad[] = [
  {
    id: '1',
    title: 'Boutique Mode - Togo',
    type: 'manual',
    status: 'active',
    impressions: 15420,
    clicks: 342,
    cpm: 50,
    budget: 100000,
    spent: 77100,
    startDate: '2026-07-01',
    endDate: '2026-07-31',
  },
  {
    id: '2',
    title: 'Électronique Premium',
    type: 'automatic',
    status: 'active',
    impressions: 28950,
    clicks: 1205,
    cpm: 75,
    budget: 150000,
    spent: 142500,
    startDate: '2026-07-10',
    endDate: '2026-08-10',
  },
];

export const AdminAds: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>(mockAds);
  const [showForm, setShowForm] = useState(false);

  const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
  const totalSpent = ads.reduce((sum, ad) => sum + ad.spent, 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Impressions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {totalImpressions.toLocaleString()}
              </p>
            </div>
            <Eye className="text-mia-green-600" size={32} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Clics</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {totalClicks.toLocaleString()}
              </p>
            </div>
            <Click className="text-mia-orange-600" size={32} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">CTR</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{avgCTR}%</p>
            </div>
            <div className="text-mia-green-600 text-2xl">📊</div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Dépensé</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {(totalSpent / 1000).toFixed(0)}K XOF
              </p>
            </div>
            <DollarSign className="text-mia-orange-600" size={32} />
          </div>
        </motion.div>
      </div>

      {/* Add Campaign Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        <Plus size={20} />
        Nouvelle campagne
      </motion.button>

      {/* Campaign Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Créer une campagne publicitaire</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Titre de la campagne"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
            />
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600">
              <option>Type: Manuel</option>
              <option>Type: Automatique (CPM)</option>
            </select>
            <input
              type="number"
              placeholder="Budget (XOF)"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
            />
            <input
              type="number"
              placeholder="CPM (coût par 1000 impressions)"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
            />
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
            />
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Créer campagne
            </motion.button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </motion.div>
      )}

      {/* Campaigns List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Campagne</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Statut</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Impressions</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Clics</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">CPM</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Budget</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => (
              <tr key={ad.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-semibold text-gray-900">{ad.title}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    ad.type === 'manual'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {ad.type === 'manual' ? 'Manuel' : 'Auto (CPM)'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    ad.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : ad.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {ad.status === 'active' ? 'Actif' : ad.status === 'paused' ? 'Pausé' : 'Terminé'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-900">{ad.impressions.toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-900">{ad.clicks.toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-900">{ad.cpm} XOF</td>
                <td className="px-6 py-4 text-gray-900">
                  {ad.spent.toLocaleString()} / {ad.budget.toLocaleString()} XOF
                </td>
                <td className="px-6 py-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-mia-green-600 hover:text-mia-green-700 font-semibold text-sm"
                  >
                    Éditer
                  </motion.button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAds;
