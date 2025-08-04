import React from 'react';
import { Package, AlertTriangle, TrendingUp, DollarSign, Users, FileText } from 'lucide-react';

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  onClick?: () => void;
}

interface MobileStatsCardsProps {
  stats: StatCard[];
  columns?: 2 | 3;
}

const MobileStatsCards: React.FC<MobileStatsCardsProps> = ({ 
  stats, 
  columns = 2 
}) => {
  const getChangeColor = (changeType?: string) => {
    switch (changeType) {
      case 'increase':
        return 'text-success-600';
      case 'decrease':
        return 'text-danger-600';
      default:
        return 'text-gray-600';
    }
  };

  const gridClass = columns === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-4 p-4`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            onClick={stat.onClick}
            className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[120px] ${
              stat.onClick ? 'cursor-pointer hover:shadow-md active:scale-95 touch-manipulation' : ''
            } transition-all duration-200`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center shadow-sm`}>
                <Icon size={22} className="text-white" />
              </div>
              {stat.change && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getChangeColor(stat.changeType)}`}>
                  {stat.change}
                </span>
              )}
            </div>
            
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {stat.value}
              </p>
              <p className="text-sm text-gray-600 leading-tight font-medium">
                {stat.title}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Pre-configured stats for inventory overview
export const InventoryStatsCards: React.FC<{
  totalItems: number;
  lowStockItems: number;
  expiringSoon: number;
  totalValue: string;
  onLowStockClick?: () => void;
  onExpiringClick?: () => void;
}> = ({
  totalItems,
  lowStockItems,
  expiringSoon,
  totalValue,
  onLowStockClick,
  onExpiringClick
}) => {
  const stats: StatCard[] = [
    {
      title: 'Total Items',
      value: totalItems,
      icon: Package,
      color: 'bg-primary-500'
    },
    {
      title: 'Low Stock',
      value: lowStockItems,
      icon: AlertTriangle,
      color: 'bg-danger-500',
      onClick: onLowStockClick
    },
    {
      title: 'Expiring Soon',
      value: expiringSoon,
      icon: TrendingUp,
      color: 'bg-warning-500',
      onClick: onExpiringClick
    },
    {
      title: 'Total Value',
      value: totalValue,
      icon: DollarSign,
      color: 'bg-success-500'
    }
  ];

  return <MobileStatsCards stats={stats} />;
};

// Pre-configured stats for requests overview
export const RequestsStatsCards: React.FC<{
  newRequests: number;
  approvedRequests: number;
  totalRequests: number;
  onNewRequestsClick?: () => void;
  onApprovedClick?: () => void;
}> = ({
  newRequests,
  approvedRequests,
  totalRequests,
  onNewRequestsClick,
  onApprovedClick
}) => {
  const stats: StatCard[] = [
    {
      title: 'New Requests',
      value: newRequests,
      icon: AlertTriangle,
      color: 'bg-info-500',
      onClick: onNewRequestsClick
    },
    {
      title: 'Approved',
      value: approvedRequests,
      icon: FileText,
      color: 'bg-success-500',
      onClick: onApprovedClick
    },
    {
      title: 'Total Requests',
      value: totalRequests,
      icon: FileText,
      color: 'bg-gray-500'
    }
  ];

  return <MobileStatsCards stats={stats} columns={3} />;
};

export default MobileStatsCards;