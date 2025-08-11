import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  Monitor, 
  Plus, 
  Search, 
  X
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { Equipment, equipmentApi } from "../services/scheduleApi.ts";
import EquipmentCard from './EquipmentCard.tsx';
import { buildApiUrl } from "../config/api.ts";
import QuickBookModal from './QuickBookModal.tsx';

interface EquipmentManagementProps {
  onEditEquipment?: (equipment: Equipment) => void;
  isAdmin?: boolean;
}

interface EquipmentFormData {
  name: string;
  description: string;
  location: string;
  is_bookable: boolean;
}

const EquipmentManagement: React.FC<EquipmentManagementProps> = ({
  onEditEquipment,
  isAdmin = false
}) => {
  const authContext = useContext(AuthContext);
  const { token } = authContext || {};

  // State
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'in_use'>('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  // Booking modal state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedEquipmentForBooking, setSelectedEquipmentForBooking] = useState<Equipment | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Form state
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    description: '',
    location: '',
    is_bookable: true
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch equipment data
  const fetchEquipment = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const data = await equipmentApi.getEquipment(token);
      setEquipment(data);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      console.error('Failed to fetch equipment data:', error);
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  }, [token]);


  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // Handle form submission
  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Equipment name is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Create equipment via API
      const newEquipment = await equipmentApi.createEquipment(token, {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        is_bookable: formData.is_bookable,
        requires_qr_checkin: formData.requires_qr_checkin,
        qr_code: formData.requires_qr_checkin ? `EQ-${Date.now()}` : undefined
      });

      // Update local state
      setEquipment(prev => [newEquipment, ...prev]);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        location: '',
        is_bookable: true,
        requires_qr_checkin: false
      });
      setFormErrors({});
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding equipment:', error);
      
      // If API is not available (404), create mock equipment for demo
      if (error instanceof Error && error.message.includes('404')) {
        console.info('Equipment API not available, creating mock equipment');
        const mockEquipment: Equipment = {
          id: Date.now(),
          name: formData.name,
          description: formData.description,
          location: formData.location,
          is_bookable: formData.is_bookable,
          is_in_use: false,
          current_user: undefined,
          current_checkin_time: undefined,
          current_usage_duration: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setEquipment(prev => [mockEquipment, ...prev]);
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          location: '',
          is_bookable: true
        });
        setFormErrors({});
        setShowAddForm(false);
      } else {
        setFormErrors({ submit: 'Failed to add equipment. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter equipment
  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'available' && !eq.is_in_use) ||
                         (filterStatus === 'in_use' && eq.is_in_use);
    
    const matchesLocation = filterLocation === 'all' || eq.location === filterLocation;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });

  // Get unique locations for filter
  const locations = Array.from(new Set(equipment.map(eq => eq.location).filter(Boolean)));


  // Handle equipment booking with modal
  const handleBookEquipment = useCallback((equipment: Equipment) => {
    setSelectedEquipmentForBooking(equipment);
    setIsBookingModalOpen(true);
  }, []);

  // Handle booking modal submission
  const handleBookingSubmit = useCallback(async (bookingData: any) => {
    if (!token || !selectedEquipmentForBooking) return;
    
    setIsSubmittingBooking(true);
    try {
      // Call the equipment booking API (use absolute API base URL)
      const response = await fetch(buildApiUrl('api/schedule/quick-actions/quick_book_equipment/'), {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });
      // Guard against non-JSON responses (e.g., HTML error pages)
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMsg = typeof data === 'string' ? data : (data.error || 'Failed to book equipment');
        throw new Error(errorMsg);
      }

      // Close modal and refresh data
      setIsBookingModalOpen(false);
      setSelectedEquipmentForBooking(null);
      fetchEquipment(); // Refresh equipment list
      
      console.log('Equipment booked successfully:', data);
    } catch (error) {
      console.error('Error booking equipment:', error);
      // You could add toast notification here
    } finally {
      setIsSubmittingBooking(false);
    }
  }, [token, selectedEquipmentForBooking, fetchEquipment]);

  // Handle equipment status change (for check in/out)
  const handleStatusChange = useCallback(() => {
    fetchEquipment(); // Refresh equipment list when status changes
  }, [fetchEquipment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Equipment Management</h2>
          <p className="text-gray-600">Manage lab equipment and bookings</p>
        </div>
        
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Equipment
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="in_use">In Use</option>
          </select>

          {/* Location Filter */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEquipment.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-lg border border-gray-200">
            <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No equipment found matching your criteria</p>
          </div>
        ) : (
          filteredEquipment.map((eq) => (
            <EquipmentCard
              key={eq.id}
              equipment={eq}
              onBooking={handleBookEquipment}
              onStatusChange={handleStatusChange}
              currentUsername={authContext?.user?.username}
            />
          ))
        )}
      </div>

      {/* Add Equipment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add New Equipment</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter equipment name"
                  disabled={isSubmitting}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Enter equipment description"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    formErrors.location ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter equipment location"
                  disabled={isSubmitting}
                />
                {formErrors.location && <p className="text-red-500 text-xs mt-1">{formErrors.location}</p>}
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.is_bookable}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_bookable: e.target.checked }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm font-medium text-gray-700">Equipment is bookable</span>
                </label>

              </div>

              {formErrors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{formErrors.submit}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Equipment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Equipment Booking Modal */}
      {isBookingModalOpen && selectedEquipmentForBooking && (
        <QuickBookModal
          equipment={selectedEquipmentForBooking}
          isSubmitting={isSubmittingBooking}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedEquipmentForBooking(null);
          }}
          onSubmit={handleBookingSubmit}
        />
      )}
    </div>
  );
};

export default EquipmentManagement;