import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Building, FileText } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../../config/api';

const FundModal = ({ isOpen, onClose, fund, mode, onSave, token }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        total_budget: '',
        funding_source: '',
        grant_number: '',
        principal_investigator: '',
        start_date: '',
        end_date: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && fund) {
                setFormData({
                    name: fund.name || '',
                    description: fund.description || '',
                    total_budget: fund.total_budget || '',
                    funding_source: fund.funding_source || '',
                    grant_number: fund.grant_number || '',
                    principal_investigator: fund.principal_investigator || '',
                    start_date: fund.start_date || '',
                    end_date: fund.end_date || '',
                    notes: fund.notes || ''
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    total_budget: '',
                    funding_source: '',
                    grant_number: '',
                    principal_investigator: '',
                    start_date: '',
                    end_date: '',
                    notes: ''
                });
            }
            setErrors({});
        }
    }, [isOpen, mode, fund]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Fund name is required';
        }

        if (!formData.total_budget || parseFloat(formData.total_budget) <= 0) {
            newErrors.total_budget = 'Total budget must be greater than 0';
        }

        if (formData.end_date && formData.start_date && new Date(formData.end_date) <= new Date(formData.start_date)) {
            newErrors.end_date = 'End date must be after start date';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const url = mode === 'edit' 
                ? buildApiUrl(`/api/funds/${fund.id}/`)
                : buildApiUrl(API_ENDPOINTS.FUNDS);
            
            const method = mode === 'edit' ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    total_budget: parseFloat(formData.total_budget)
                })
            });

            if (response.ok) {
                onSave();
                onClose();
            } else if (response.status === 404) {
                setErrors({ general: 'Funding API is not yet implemented on the backend. Please contact your system administrator.' });
            } else {
                try {
                    const errorData = await response.json();
                    setErrors(errorData);
                } catch {
                    setErrors({ general: 'Server error. Please try again later.' });
                }
            }
        } catch (error) {
            console.error('Error saving fund:', error);
            if (error.message.includes('Failed to fetch')) {
                setErrors({ general: 'Cannot connect to server. Please check your internet connection and try again.' });
            } else {
                setErrors({ general: 'Failed to save fund. The funding system may not be fully implemented yet.' });
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-secondary-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-secondary-900">
                            {mode === 'edit' ? 'Edit Fund' : 'Create New Fund'}
                        </h2>
                        <p className="text-secondary-600 mt-1">
                            {mode === 'edit' ? 'Update fund information and budget' : 'Set up a new funding source for the laboratory'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-secondary-100 transition-colors"
                        disabled={loading}
                    >
                        <X className="w-6 h-6 text-secondary-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {errors.general && (
                        <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                            {errors.general}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Basic Information */}
                        <div className="md:col-span-2">
                            <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
                                <DollarSign className="w-5 h-5 mr-2" />
                                Basic Information
                            </h3>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Fund Name *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className={`input w-full ${errors.name ? 'border-danger-300' : ''}`}
                                placeholder="e.g., NIH Grant R01-2024, Equipment Fund"
                                disabled={loading}
                            />
                            {errors.name && <p className="text-danger-600 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Description
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={3}
                                className="input w-full"
                                placeholder="Brief description of the fund purpose and scope"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Total Budget *
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-secondary-500 sm:text-sm">$</span>
                                </div>
                                <input
                                    type="number"
                                    name="total_budget"
                                    value={formData.total_budget}
                                    onChange={handleInputChange}
                                    className={`input w-full pl-7 ${errors.total_budget ? 'border-danger-300' : ''}`}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    disabled={loading}
                                />
                            </div>
                            {errors.total_budget && <p className="text-danger-600 text-sm mt-1">{errors.total_budget}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Grant Number
                            </label>
                            <input
                                type="text"
                                name="grant_number"
                                value={formData.grant_number}
                                onChange={handleInputChange}
                                className="input w-full"
                                placeholder="e.g., R01-AI123456"
                                disabled={loading}
                            />
                        </div>

                        {/* Funding Source Information */}
                        <div className="md:col-span-2 mt-6">
                            <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
                                <Building className="w-5 h-5 mr-2" />
                                Funding Source
                            </h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Funding Source
                            </label>
                            <input
                                type="text"
                                name="funding_source"
                                value={formData.funding_source}
                                onChange={handleInputChange}
                                className="input w-full"
                                placeholder="e.g., National Institutes of Health, University"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Principal Investigator
                            </label>
                            <input
                                type="text"
                                name="principal_investigator"
                                value={formData.principal_investigator}
                                onChange={handleInputChange}
                                className="input w-full"
                                placeholder="e.g., Dr. Jane Smith"
                                disabled={loading}
                            />
                        </div>

                        {/* Timeline */}
                        <div className="md:col-span-2 mt-6">
                            <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
                                <Calendar className="w-5 h-5 mr-2" />
                                Timeline
                            </h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleInputChange}
                                className="input w-full"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleInputChange}
                                className={`input w-full ${errors.end_date ? 'border-danger-300' : ''}`}
                                disabled={loading}
                            />
                            {errors.end_date && <p className="text-danger-600 text-sm mt-1">{errors.end_date}</p>}
                        </div>

                        {/* Additional Notes */}
                        <div className="md:col-span-2 mt-6">
                            <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2" />
                                Additional Information
                            </h3>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Notes
                            </label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                rows={4}
                                className="input w-full"
                                placeholder="Any additional notes or restrictions about this fund"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-secondary-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center">
                                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                                    Saving...
                                </div>
                            ) : (
                                mode === 'edit' ? 'Update Fund' : 'Create Fund'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FundModal;