/**
 * LoadingFallback Component
 * Displays loading state with skeleton
 */

import React from 'react';
import { motion } from 'framer-motion';

export const LoadingFallback: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="bg-gray-200 rounded-lg aspect-square"
        />
      ))}
    </div>
  );
};

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-4 border-mia-green-200 border-t-mia-green-600 rounded-full"
      />
    </div>
  );
};

export default LoadingFallback;
