/**
 * EmptyState Component
 * Displays when no products are available
 */

import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Aucun produit trouvé',
  description = 'Essayez de changer vos filtres ou sélectionnez un autre pays.',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <ShoppingBag className="text-gray-300 mb-4" size={48} />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 text-center text-sm">{description}</p>
    </div>
  );
};

export default EmptyState;
