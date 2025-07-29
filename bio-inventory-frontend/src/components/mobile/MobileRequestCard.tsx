import React from 'react';
import { User, Package, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Eye, ThumbsUp, ThumbsDown, ShoppingCart, RotateCcw } from 'lucide-react';

interface RequestItem {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  requested_by: string | { username?: string; name?: string; first_name?: string; email?: string } | null;
  request_date: string;
  status: string;
  vendor?: string | { name?: string };
  notes?: string;
  urgency?: string;
  received_by_name?: string;
  approved_by_name?: string;
}

interface MobileRequestCardProps {
  request: RequestItem;
  onClick?: (request: RequestItem) => void;
  onApprove?: (request: RequestItem) => void;
  onReject?: (request: RequestItem) => void;
  onMarkReceived?: (request: RequestItem) => void;
  onReopen?: (request: RequestItem) => void;
}

const MobileRequestCard: React.FC<MobileRequestCardProps> = ({
  request,
  onClick,
  onApprove,
  onReject,
  onMarkReceived,
  onReopen
}) => {
  const getStatusConfig = () => {
    switch (request.status) {
      case 'NEW':
        return {
          color: 'border-l-info-500 bg-info-50',
          textColor: 'text-info-700',
          bgColor: 'bg-info-100',
          icon: AlertCircle,
          label: 'New Request'
        };
      case 'APPROVED':
        return {
          color: 'border-l-success-500 bg-success-50',
          textColor: 'text-success-700',
          bgColor: 'bg-success-100',
          icon: CheckCircle,
          label: 'Approved'
        };
      case 'REJECTED':
        return {
          color: 'border-l-danger-500 bg-danger-50',
          textColor: 'text-danger-700',
          bgColor: 'bg-danger-100',
          icon: XCircle,
          label: 'Rejected'
        };
      case 'RECEIVED':
        return {
          color: 'border-l-success-500 bg-success-50',
          textColor: 'text-success-700',
          bgColor: 'bg-success-100',
          icon: CheckCircle,
          label: 'Received'
        };
      default:
        return {
          color: 'border-l-gray-300 bg-gray-50',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-100',
          icon: Clock,
          label: 'Processing'
        };
    }
  };

  const getUrgencyConfig = () => {
    switch (request.urgency) {
      case 'HIGH':
        return { color: 'text-danger-600', bg: 'bg-danger-100', label: 'Urgent' };
      case 'MEDIUM':
        return { color: 'text-warning-600', bg: 'bg-warning-100', label: 'Medium' };
      case 'LOW':
        return { color: 'text-success-600', bg: 'bg-success-100', label: 'Low' };
      default:
        return { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Normal' };
    }
  };

  const statusConfig = getStatusConfig();
  const urgencyConfig = getUrgencyConfig();
  const StatusIcon = statusConfig.icon;

  const getActionButtons = () => {
    const buttons: {
      icon: React.ElementType;
      label: string;
      onClick: () => void;
      color: string;
    }[] = [];
    
    switch (request.status) {
      case 'NEW':
        if (onApprove) {
          buttons.push({
            icon: ThumbsUp,
            label: 'Approve',
            onClick: () => onApprove(request),
            color: 'bg-success-600 hover:bg-success-700 text-white'
          });
        }
        if (onReject) {
          buttons.push({
            icon: ThumbsDown,
            label: 'Reject',
            onClick: () => onReject(request),
            color: 'bg-danger-600 hover:bg-danger-700 text-white'
          });
        }
        break;
      case 'APPROVED':
      case 'ORDERED':
        if (onMarkReceived) {
          buttons.push({
            icon: ShoppingCart,
            label: 'Mark Received',
            onClick: () => onMarkReceived(request),
            color: 'bg-primary-600 hover:bg-primary-700 text-white'
          });
        }
        break;
      case 'REJECTED':
        if (onReopen) {
          buttons.push({
            icon: RotateCcw,
            label: 'Reopen',
            onClick: () => onReopen(request),
            color: 'bg-gray-600 hover:bg-gray-700 text-white'
          });
        }
        break;
      case 'RECEIVED':
        // No additional actions for received requests
        break;
    }
    
    return buttons;
  };

  const actionButtons = getActionButtons();

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${statusConfig.color} border-l-4 mb-3 overflow-hidden transition-all duration-200 active:scale-98`}
      onClick={() => onClick?.(request)}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-lg flex-1 pr-3 leading-tight">
            {request.item_name}
          </h3>
          <button className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors duration-200 shadow-md hover:shadow-lg flex-shrink-0">
            <Eye size={16} />
          </button>
        </div>

        {/* Quantity and Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1">
            <Package size={16} className="text-gray-500" />
            <span className="text-lg font-bold text-gray-900">
              {request.quantity}
            </span>
            <span className="text-sm text-gray-500">{request.unit}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {request.urgency && (
              <div className={`flex items-center space-x-1 ${urgencyConfig.bg} ${urgencyConfig.color} px-3 py-1 rounded-full min-h-[24px]`}>
                <span className="text-xs font-medium">{urgencyConfig.label}</span>
              </div>
            )}
            <div className={`flex items-center space-x-1 ${statusConfig.bgColor} ${statusConfig.textColor} px-3 py-1 rounded-full min-h-[24px]`}>
              <StatusIcon size={12} />
              <span className="text-xs font-medium">{statusConfig.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-center space-x-3 text-sm text-gray-600">
          <User size={16} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium min-w-0">
            {request.status === 'RECEIVED' ? 'Received by:' : 'Requested by:'}
          </span>
          <span className="truncate">
            {(() => {
              // For RECEIVED status, show received_by_name if available
              if (request.status === 'RECEIVED' && request.received_by_name) {
                return request.received_by_name;
              }
              
              // Handle different data structures for requested_by
              if (typeof request.requested_by === 'string' && request.requested_by) {
                return request.requested_by;
              } else if (typeof request.requested_by === 'object' && request.requested_by !== null) {
                const userObj = request.requested_by as any;
                return userObj.username || userObj.name || userObj.first_name || userObj.email || 'Unknown User';
              } else {
                return 'Unknown User';
              }
            })()}
          </span>
        </div>
        
        <div className="flex items-center space-x-3 text-sm text-gray-600">
          <Calendar size={16} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium min-w-0">Request date:</span>
          <span className="truncate">{new Date(request.request_date).toLocaleDateString('en-US')}</span>
        </div>
        
        {request.vendor && (
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <Package size={16} className="text-gray-400 flex-shrink-0" />
            <span className="font-medium min-w-0">Vendor:</span>
            <span className="truncate">
              {typeof request.vendor === 'object' && request.vendor !== null
                ? (request.vendor as any).name || 'Unknown Vendor'
                : request.vendor}
            </span>
          </div>
        )}
        
        {request.notes && (
          <div className="mt-3 p-2 bg-gray-50 rounded-md">
            <span className="text-sm text-gray-700">{request.notes}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {actionButtons.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex gap-2 flex-wrap">
            {actionButtons.map((button, index) => {
              const ButtonIcon = button.icon;
              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    button.onClick();
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 ${button.color}`}
                >
                  <ButtonIcon size={16} />
                  <span>{button.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileRequestCard;