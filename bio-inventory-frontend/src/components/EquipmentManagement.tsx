import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  Monitor, 
  Plus, 
  Search, 
  Filter, 
  QrCode, 
  MapPin, 
  Clock, 
  User, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Settings,
  Edit3,
  Trash2,
  BookOpen,
  Timer,
  X
} from 'lucide-react';
import { AuthContext } from './AuthContext.tsx';
import { Equipment, equipmentApi, Booking } from "../services/scheduleApi.ts";

interface EquipmentManagementProps {
  onShowQRCode?: (equipment: Equipment) => void;
  onQRScan?: (mode: 'checkin' | 'checkout') => void;
  onBookEquipment?: (equipment: Equipment) => void;
  onEditEquipment?: (equipment: Equipment) => void;
}

interface EquipmentFormData {
  name: string;
  description: string;
  location: string;
  is_bookable: boolean;
  requires_qr_checkin: boolean;
}

const EquipmentManagement: React.FC<EquipmentManagementProps> = ({
  onShowQRCode,
  onQRScan,
  onBookEquipment,
  onEditEquipment
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
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'location' | 'status' | 'usage'>('name');
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    description: '',
    location: '',
    is_bookable: true,
    requires_qr_checkin: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Quick actions state
  const [quickActions, setQuickActions] = useState({
    showAvailableOnly: false,
    showBookableOnly: false,
    showQROnly: false
  });

  // Fetch equipment data
  const fetchEquipment = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const data = await equipmentApi.getEquipment(token);
      setEquipment(data);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      // Mock data for development
      setEquipment([
        {
          id: 1,
          name: 'Biological Safety Cabinet A',
          description: 'Class II Type A2 BSC for cell culture work',
          location: 'Lab Room 101',
          is_bookable: true,
          requires_qr_checkin: true,
          qr_code: 'BSC-A2-001',
          is_in_use: false,
          current_user: null,
          current_checkin_time: null,
          current_usage_duration: null
        },
        {
          id: 2,
          name: 'Microscope - Zeiss',
          description: 'Confocal microscope for imaging',
          location: 'Imaging Room',
          is_bookable: true,
          requires_qr_checkin: false,
          qr_code: null,
          is_in_use: true,
          current_user: { id: 1, username: 'alice', first_name: 'Alice', last_name: 'Johnson' },
          current_checkin_time: '2024-01-15T09:30:00Z',
          current_usage_duration: '2 hours 15 minutes'
        },
        {
          id: 3,
          name: 'Centrifuge',
          description: 'High-speed centrifuge for sample preparation',
          location: 'Lab Room 102',
          is_bookable: true,
          requires_qr_checkin: true,
          qr_code: 'CENT-001',
          is_in_use: false,
          current_user: null,
          current_checkin_time: null,
          current_usage_duration: null
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch bookings for selected equipment
  const fetchBookings = useCallback(async (equipmentId: number) => {
    if (!token) return;
    
    try {
      const bookingsData = await equipmentApi.getEquipmentBookings(token, equipmentId);
      setBookings(bookingsData);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]); // Set empty array on error
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
          requires_qr_checkin: formData.requires_qr_checkin,
          qr_code: formData.requires_qr_checkin ? `EQ-${Date.now()}` : undefined,
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
          is_bookable: true,
          requires_qr_checkin: false
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

  const handleEquipmentSelect = (eq: Equipment) => {
    setSelectedEquipment(eq);
    fetchBookings(eq.id);
  };

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString();
  };

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
          <p className="text-gray-600">Manage lab equipment, bookings, and QR check-in/out</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onQRScan?.('checkin')}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Quick Check In
          </button>
          <button
            onClick={() => onQRScan?.('checkout')}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Quick Check Out
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Equipment
          </button>
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipment List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Equipment ({filteredEquipment.length})
              </h3>
            </div>
            
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredEquipment.length === 0 ? (
                <div className="p-8 text-center">
                  <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No equipment found matching your criteria</p>
                </div>
              ) : (
                filteredEquipment.map((eq) => (
                  <div
                    key={eq.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedEquipment?.id === eq.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                    onClick={() => handleEquipmentSelect(eq)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-gray-900">{eq.name}</h4>
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            eq.is_in_use 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {eq.is_in_use ? 'In Use' : 'Available'}
                          </div>
                        </div>
                        
                        {eq.description && (
                          <p className="text-sm text-gray-600 mb-2">{eq.description}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{eq.location}</span>
                          </div>
                          
                          {eq.requires_qr_checkin && (
                            <div className="flex items-center gap-1">
                              <QrCode className="w-4 h-4" />
                              <span>QR Required</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Bookable: {eq.is_bookable ? 'Yes' : 'No'}</span>
                          </div>
                        </div>

                        {eq.is_in_use && eq.current_user && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="flex items-center gap-2 text-yellow-800 text-sm">
                              <User className="w-4 h-4" />
                              <span>Used by {eq.current_user.first_name} {eq.current_user.last_name}</span>
                            </div>
                            {eq.current_usage_duration && (
                              <div className="flex items-center gap-2 text-yellow-700 text-xs mt-1">
                                <Timer className="w-3 h-3" />
                                <span>Duration: {eq.current_usage_duration}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        {eq.requires_qr_checkin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowQRCode?.(eq);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Show QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}
                        
                        {eq.is_bookable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookEquipment?.(eq);
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title="Book Equipment"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEquipment?.(eq);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit Equipment"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Equipment Details and Bookings */}
        <div className="space-y-6">
          {selectedEquipment ? (
            <>
              {/* Equipment Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Equipment Details</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900">{selectedEquipment.name}</p>
                  </div>
                  
                  {selectedEquipment.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="text-gray-900">{selectedEquipment.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Location</label>
                    <p className="text-gray-900">{selectedEquipment.location}</p>
                  </div>
                  
                  {selectedEquipment.qr_code && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">QR Code</label>
                      <p className="text-gray-900 font-mono">{selectedEquipment.qr_code}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {selectedEquipment.requires_qr_checkin && (
                    <button
                      onClick={() => onShowQRCode?.(selectedEquipment)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Show QR
                    </button>
                  )}
                  
                  {selectedEquipment.is_bookable && (
                    <button
                      onClick={() => onBookEquipment?.(selectedEquipment)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book
                    </button>
                  )}
                </div>
              </div>

              {/* Recent Bookings */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Bookings</h3>
                
                {bookings.length === 0 ? (
                  <div className="text-center py-6">
                    <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No recent bookings</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {booking.user}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDateTime(booking.start_time)} - {formatDateTime(booking.end_time)}</span>
                          </div>
                          <div className="text-gray-500">
                            {booking.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select equipment to view details and bookings</p>
            </div>
          )}
        </div>
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

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.requires_qr_checkin}
                    onChange={(e) => setFormData(prev => ({ ...prev, requires_qr_checkin: e.target.checked }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm font-medium text-gray-700">Requires QR code check-in</span>
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
    </div>
  );
};

export default EquipmentManagement;