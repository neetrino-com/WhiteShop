import React from 'react';

export type ProductLabelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ProductLabel {
  id: string;
  type: 'text' | 'percentage';
  value: string;
  position: ProductLabelPosition;
  color: string | null;
}

interface ProductLabelsProps {
  labels: ProductLabel[];
}

/**
 * ProductLabels
 *
 * UI-комպոնենտ, որը corner-երով խմբավորում է product-ի labels-ը
 * և նույն position ունեցող labels-ը ցուցադրում է vertical stack-ով։
 * Սա ապահովում է, որ միաժամանակ մի քանի label ունենալու դեպքում
 * դրանք իրար վրա չեն նստում, այլ ունեն հստակ вертикալ հեռավորություն։
 */
export const ProductLabels: React.FC<ProductLabelsProps> = ({ labels }) => {
  if (!labels || labels.length === 0) return null;

  // Փոքր logging, որ հեշտ լինի debug անել label-ների խնդիրները
  console.info('[UI][ProductLabels] Rendering labels', {
    total: labels.length,
    positions: labels.map((l) => l.position),
  });

  const positions: ProductLabelPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  const getColorClasses = (label: ProductLabel) => {
    if (label.color) {
      return '';
    }

    if (label.type === 'percentage') {
      return 'bg-red-600 text-white';
    }

    const value = label.value.toLowerCase();
    if (value.includes('new') || value.includes('նոր')) {
      return 'bg-green-600 text-white';
    }
    if (value.includes('hot') || value.includes('տաք')) {
      return 'bg-orange-600 text-white';
    }
    if (value.includes('sale') || value.includes('զեղչ')) {
      return 'bg-red-600 text-white';
    }

    return 'bg-blue-600 text-white';
  };

  const getCornerPositionClasses = (position: ProductLabelPosition) => {
    switch (position) {
      case 'top-left':
        return 'top-2 left-2 items-start';
      case 'top-right':
        return 'top-2 right-2 items-end';
      case 'bottom-left':
        return 'bottom-2 left-2 items-start';
      case 'bottom-right':
        return 'bottom-2 right-2 items-end';
      default:
        return '';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {positions.map((position) => {
        const labelsForPosition = labels.filter((label) => label.position === position);
        if (labelsForPosition.length === 0) return null;

        return (
          <div
            key={position}
            className={`absolute flex flex-col gap-1 ${getCornerPositionClasses(position)}`}
          >
            {labelsForPosition.map((label) => (
              <div
                key={label.id}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md shadow-sm pointer-events-auto ${getColorClasses(
                  label,
                )}`}
                style={label.color ? { backgroundColor: label.color, color: 'white' } : undefined}
              >
                {label.type === 'percentage' ? `${label.value}%` : label.value}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};






