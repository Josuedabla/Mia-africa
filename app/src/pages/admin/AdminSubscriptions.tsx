/**
 * AdminSubscriptions Component
 * Manage subscription thresholds and user subscriptions
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Truck, TrendingUp } from 'lucide-react';

interface Subscription {
  id: string;
  userName: string;
  type: 'vendor' | 'driver';
  status: 'free' | 'premium';
  count: number;
  threshold: number;
  startDate: string;
  endDate?: string;
}

const mockSubscriptions: Subscription[] = [
  {
    id: '1',
    userName: 'Boutique Mode Togo',
    type: 'vendor',
    status: 'free',
    count: 145,
    threshold: 500,
    startDate: '2026-06-01',
  },
  {
    id: '2',
    userName: 'Électronique Plus',
    type: 'vendor',
    status: 'premium',
    count: 523,
    threshold: 500,
    startDate: '2026-05-15',
    endDate: '2026-08-15',
  },
  {
    id: '3',
    userName: 'Livreur Rapide',
    type: 'driver',
    status: 'free',
    count: 87,
    threshold: 100,
    startDate: '2026-07-01',
  },
];

export const AdminSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(mockSubscriptions);
  const [vendorThreshold, setVendorThreshold] = useState(500);
  const [driverThreshold, setDriverThreshold] = useState(100);

  const freeVendors = subscriptions.filter(s => s.type === 'vendor' && s.status === 'free').length;
  const premiumVendors = subscriptions.filter(s => s.type === 'vendor' && s.status === 'premium').length;
  const freeDrivers = subscriptions.filter(s => s.type === 'driver' && s.status === 'free').length;
  const premiumDrivers = subscriptions.filter(s => s.type === 'driver' && s.status === 'premium').length;

  return (
    <div className="space-y-6">
      {/* Thresholds Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-md p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-6">Configuration des seuils</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Seuil vendeur (commandes gratuites)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={vendorThreshold}
                onChange={(e) => setVendorThreshold(parseInt(e.target.value))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
              <span className="text-2xl font-bold text-mia-green-600">{vendorThreshold}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Les vendeurs payent après {vendorThreshold} commandes
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Seuil livreur (livraisons gratuites)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={driverThreshold}
                onChange={(e) => setDriverThreshold(parseInt(e.target.value))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
              <span className="text-2xl font-bold text-mia-green-600">{driverThreshold}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Les livreurs payent après {driverThreshold} livraisons
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-6 bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          Enregistrer les seuils
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Vendeurs Gratuits</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{freeVendors}</p>
            </div>
            <Users className="text-blue-600" size={32} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Vendeurs Premium</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{premiumVendors}</p>
            </div>
            <TrendingUp className="text-mia-green-600" size={32} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Livreurs Gratuits</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{freeDrivers}</p>
            </div>
            <Truck className="text-blue-600" size={32} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Livreurs Premium</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{premiumDrivers}</p>
            </div>
            <TrendingUp className="text-mia-green-600" size={32} />
          </div>
        </motion.div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Utilisateur</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Statut</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Progression</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date début</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => {
              const progress = (sub.count / sub.threshold) * 100;
              return (
                <tr key={sub.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{sub.userName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      sub.type === 'vendor'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {sub.type === 'vendor' ? 'Vendeur' : 'Livreur'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      sub.status === 'free'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {sub.status === 'free' ? 'Gratuit' : 'Premium'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-mia-green-600 transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {sub.count}/{sub.threshold}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 text-sm">{sub.startDate}</td>
                  <td className="px-6 py-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="text-mia-green-600 hover:text-mia-green-700 font-semibold text-sm"
                    >
                      Prolonger
                    </motion.button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSubscriptions;
