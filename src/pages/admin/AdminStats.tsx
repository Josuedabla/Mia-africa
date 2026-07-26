/**
 * AdminStats Component
 * Display overall platform statistics
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Users, ShoppingBag, TrendingUp, DollarSign, Truck, Eye } from 'lucide-react';

export const AdminStats: React.FC = () => {
  const stats = [
    {
      label: 'Utilisateurs',
      value: '12,453',
      change: '+15%',
      icon: <Users size={32} />,
      color: 'text-blue-600',
    },
    {
      label: 'Vendeurs',
      value: '2,841',
      change: '+8%',
      icon: <ShoppingBag size={32} />,
      color: 'text-mia-green-600',
    },
    {
      label: 'Livreurs',
      value: '1,204',
      change: '+12%',
      icon: <Truck size={32} />,
      color: 'text-mia-orange-600',
    },
    {
      label: 'Commandes',
      value: '45,821',
      change: '+23%',
      icon: <ShoppingBag size={32} />,
      color: 'text-purple-600',
    },
    {
      label: 'Revenus',
      value: '2.3M XOF',
      change: '+31%',
      icon: <DollarSign size={32} />,
      color: 'text-green-600',
    },
    {
      label: 'Vues',
      value: '892K',
      change: '+45%',
      icon: <Eye size={32} />,
      color: 'text-pink-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">{stat.label}</h3>
              <div className={stat.color}>{stat.icon}</div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
            <p className="text-sm font-semibold text-green-600">{stat.change} ce mois</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Revenus (7 derniers jours)</h3>
          <div className="space-y-3">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, i) => {
              const height = Math.random() * 80 + 20;
              return (
                <div key={day} className="flex items-end gap-2">
                  <span className="w-8 text-xs font-semibold text-gray-600">{day}</span>
                  <div className="flex-1 bg-mia-green-200 rounded-t" style={{ height: `${height}px` }} />
                  <span className="text-xs font-semibold text-gray-600">{Math.round(height * 1000)} K</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Top Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Catégories populaires</h3>
          <div className="space-y-4">
            {[
              { name: 'Mode', percentage: 28 },
              { name: 'Électronique', percentage: 22 },
              { name: 'Beauté', percentage: 18 },
              { name: 'Maison', percentage: 15 },
              { name: 'Autres', percentage: 17 },
            ].map((cat) => (
              <div key={cat.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                  <span className="text-sm font-bold text-gray-900">{cat.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mia-green-600 transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-lg shadow-md p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-4">Activité récente</h3>
        <div className="space-y-3">
          {[
            { action: 'Nouvelle boutique créée', user: 'Boutique Mode Togo', time: 'Il y a 2h' },
            { action: 'Commande complétée', user: 'Client #12453', time: 'Il y a 4h' },
            { action: 'Livreur inscrit', user: 'Livreur Rapide', time: 'Il y a 6h' },
            { action: 'Campagne publicitaire lancée', user: 'Électronique Plus', time: 'Il y a 8h' },
            { action: 'Produit signalé', user: 'Modération', time: 'Il y a 10h' },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-500">{activity.user}</p>
              </div>
              <span className="text-xs font-semibold text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminStats;
