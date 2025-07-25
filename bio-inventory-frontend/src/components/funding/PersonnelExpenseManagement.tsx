import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, User, DollarSign, Calendar, FileText, Filter, Download, Users } from 'lucide-react';

const PersonnelExpenseManagement = ({ token }) => {
    const [expenses, setExpenses] = useState([]);
    const [funds, setFunds] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);
    const [modalMode, setModalMode] = useState('create');
    const [filters, setFilters] = useState({
        fund_id: '',
        employee_id: '',
        expense_type: '',
        is_approved: '',
        start_date: '',
        end_date: ''
    });

    // Form data for modal
    const [formData, setFormData] = useState({
        fund_id: '',
        employee_id: '',
        employee_name: '',
        expense_type: 'salary',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
        reference_number: '',
        notes: ''
    });

    const expenseTypes = [
        { value: 'salary', label: 'Salary' },
        { value: 'benefits', label: 'Benefits' },
        { value: 'stipend', label: 'Stipend' },
        { value: 'bonus', label: 'Bonus' },
        { value: 'training', label: 'Training' },
        { value: 'travel', label: 'Travel' }
    ];

    useEffect(() => {
        fetchExpenses();
        fetchFunds();
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [filters]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });

            const response = await fetch(`http://127.0.0.1:8000/api/personnel-expenses/?${queryParams}`, {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setExpenses(data.results || data);
            }
        } catch (error) {
            console.error('Error fetching personnel expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFunds = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/funds/', {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setFunds(data.results || data);
            }
        } catch (error) {
            console.error('Error fetching funds:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/users/', {
                headers: { 'Authorization': `Token ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.results || data);
            } else {
                console.warn('Users API not available, using fallback');
                setUsers([]); // Fallback to empty list
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsers([]); // Fallback to empty list
        }
    };

    const handleCreateExpense = () => {
        setSelectedExpense(null);
        setModalMode('create');
        setFormData({
            fund_id: '',
            employee_id: '',
            employee_name: '',
            expense_type: 'salary',
            amount: '',
            expense_date: new Date().toISOString().split('T')[0],
            description: '',
            reference_number: '',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const handleEditExpense = (expense) => {
        setSelectedExpense(expense);
        setModalMode('edit');
        setFormData({
            fund_id: expense.fund?.id || '',
            employee_id: expense.employee?.id || '',
            employee_name: expense.employee_name,
            expense_type: expense.expense_type,
            amount: expense.amount,
            expense_date: expense.expense_date,
            description: expense.description || '',
            reference_number: expense.reference_number || '',
            notes: expense.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleUserSelection = (e) => {
        const selectedUserId = e.target.value;
        
        if (selectedUserId === 'manual') {
            setFormData(prev => ({
                ...prev,
                employee_id: '',
                employee_name: ''
            }));
        } else {
            const selectedUser = users.find(user => user.id === parseInt(selectedUserId));
            setFormData(prev => ({
                ...prev,
                employee_id: selectedUserId,
                employee_name: selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}`.trim() || selectedUser.username : ''
            }));
        }
    };

    const handleSaveExpense = async (e) => {
        e.preventDefault();
        
        const url = modalMode === 'create' 
            ? 'http://127.0.0.1:8000/api/personnel-expenses/'
            : `http://127.0.0.1:8000/api/personnel-expenses/${selectedExpense.id}/`;
        
        const method = modalMode === 'create' ? 'POST' : 'PUT';

        // Prepare form data, sending employee_id if selected
        const submitData = {
            fund_id: formData.fund_id,
            expense_type: formData.expense_type,
            amount: formData.amount,
            expense_date: formData.expense_date,
            description: formData.description,
            reference_number: formData.reference_number,
            notes: formData.notes
        };

        // Frontend validation
        const validationErrors = [];
        
        if (!formData.fund_id) validationErrors.push('Fund is required');
        if (!formData.expense_type) validationErrors.push('Expense type is required');
        if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
            validationErrors.push('Valid amount is required');
        }
        if (!formData.expense_date) validationErrors.push('Expense date is required');
        
        // Employee validation
        if (!formData.employee_id || formData.employee_id === 'manual') {
            if (!formData.employee_name || formData.employee_name.trim() === '') {
                validationErrors.push('Employee name is required');
            }
        }
        
        if (validationErrors.length > 0) {
            alert('Please fix the following errors:\n' + validationErrors.join('\n'));
            return;
        }

        // Add employee_id if selected, otherwise use employee_name
        if (formData.employee_id && formData.employee_id !== 'manual') {
            submitData.employee_id = parseInt(formData.employee_id);
        } else if (formData.employee_name) {
            submitData.employee_name = formData.employee_name;
        }

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify(submitData)
            });

            if (response.ok) {
                setIsModalOpen(false);
                fetchExpenses();
            } else {
                console.error('HTTP Error:', response.status, response.statusText);
                try {
                    const errorData = await response.json();
                    console.error('Error data:', errorData);
                    
                    // Create user-friendly error messages
                    let errorMessage = 'Failed to save personnel expense:\n';
                    if (typeof errorData === 'object') {
                        Object.entries(errorData).forEach(([field, errors]) => {
                            if (Array.isArray(errors)) {
                                errorMessage += `${field}: ${errors.join(', ')}\n`;
                            } else {
                                errorMessage += `${field}: ${errors}\n`;
                            }
                        });
                    } else {
                        errorMessage += errorData;
                    }
                    alert(errorMessage);
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    
                    // Try to get the raw response text for better debugging
                    response.text().then(textResponse => {
                        console.error('Raw error response:', textResponse);
                        
                        // Check if it's an HTML error page
                        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html>')) {
                            alert(`Server error (${response.status}): ${response.statusText}\n\nThe server returned an HTML error page instead of JSON. This usually indicates:\n1. A server configuration issue\n2. URL routing problem\n3. Internal server error\n\nPlease check the browser console for the full error page.`);
                        } else {
                            alert(`Server error (${response.status}): ${response.statusText}\n\nResponse: ${textResponse.substring(0, 200)}${textResponse.length > 200 ? '...' : ''}`);
                        }
                    }).catch(() => {
                        alert(`Server error (${response.status}): ${response.statusText}\nUnable to read error response.`);
                    });
                }
            }
        } catch (error) {
            console.error('Error saving expense:', error);
            
            // Provide more specific error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                alert('Network error: Unable to connect to server. Please check your internet connection and ensure the server is running.');
            } else if (error.name === 'AbortError') {
                alert('Request timed out. Please try again.');
            } else {
                alert(`Failed to save expense: ${error.message || 'Unknown error occurred'}`);
            }
        }
    };

    const handleApproveExpense = async (expenseId) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/personnel-expenses/${expenseId}/approve/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            });

            if (response.ok) {
                fetchExpenses();
            } else {
                alert('Failed to approve expense');
            }
        } catch (error) {
            console.error('Error approving expense:', error);
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                const response = await fetch(`http://127.0.0.1:8000/api/personnel-expenses/${expenseId}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Token ${token}` }
                });

                if (response.ok) {
                    fetchExpenses();
                } else {
                    alert('Failed to delete expense');
                }
            } catch (error) {
                console.error('Error deleting expense:', error);
            }
        }
    };

    const getExpenseTypeBadge = (type) => {
        const typeConfig = {
            'salary': { class: 'badge-primary', label: 'Salary' },
            'benefits': { class: 'badge-secondary', label: 'Benefits' },
            'stipend': { class: 'badge-info', label: 'Stipend' },
            'bonus': { class: 'badge-success', label: 'Bonus' },
            'training': { class: 'badge-warning', label: 'Training' },
            'travel': { class: 'badge-danger', label: 'Travel' }
        };
        const config = typeConfig[type] || { class: 'badge-secondary', label: type };
        return <span className={`badge ${config.class}`}>{config.label}</span>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl p-6 border border-primary-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Personnel Expense Management</h1>
                            <p className="text-primary-700">Track and manage personnel-related expenses</p>
                        </div>
                    </div>
                    <button
                        onClick={handleCreateExpense}
                        className="btn btn-primary hover:scale-105 transition-transform"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Personnel Expense
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <Filter className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fund</label>
                        <select
                            value={filters.fund_id}
                            onChange={(e) => setFilters({...filters, fund_id: e.target.value})}
                            className="select"
                        >
                            <option value="">All Funds</option>
                            {funds.map(fund => (
                                <option key={fund.id} value={fund.id}>{fund.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
                        <select
                            value={filters.employee_id}
                            onChange={(e) => setFilters({...filters, employee_id: e.target.value})}
                            className="select"
                        >
                            <option value="">All Employees</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}`
                                        : user.username
                                    }
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expense Type</label>
                        <select
                            value={filters.expense_type}
                            onChange={(e) => setFilters({...filters, expense_type: e.target.value})}
                            className="select"
                        >
                            <option value="">All Types</option>
                            {expenseTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Approval Status</label>
                        <select
                            value={filters.is_approved}
                            onChange={(e) => setFilters({...filters, is_approved: e.target.value})}
                            className="select"
                        >
                            <option value="">All</option>
                            <option value="true">Approved</option>
                            <option value="false">Pending</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                            className="input"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => setFilters({...filters, end_date: e.target.value})}
                            className="input"
                        />
                    </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                    <button
                        onClick={() => setFilters({
                            fund_id: '', employee_id: '', expense_type: '', is_approved: '', start_date: '', end_date: ''
                        })}
                        className="btn btn-secondary btn-sm"
                    >
                        Clear Filters
                    </button>
                    
                    <button className="btn btn-secondary btn-sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </button>
                </div>
            </div>

            {/* Expenses Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead className="table-header">
                            <tr>
                                <th className="table-header-cell">Employee Name</th>
                                <th className="table-header-cell">Fund</th>
                                <th className="table-header-cell">Type</th>
                                <th className="table-header-cell">Amount</th>
                                <th className="table-header-cell">Date</th>
                                <th className="table-header-cell">Status</th>
                                <th className="table-header-cell">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="table-body">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="table-cell text-center py-8">
                                        <div className="loading-spinner w-6 h-6 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="table-cell text-center py-8 text-gray-500">
                                        No personnel expenses found
                                    </td>
                                </tr>
                            ) : (
                                expenses.map(expense => (
                                    <tr key={expense.id} className="table-row">
                                        <td className="table-cell">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                    <User className="w-4 h-4 text-primary-600" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{expense.employee_name}</div>
                                                    {expense.employee?.username && (
                                                        <div className="text-xs text-gray-500">@{expense.employee.username}</div>
                                                    )}
                                                    {expense.reference_number && (
                                                        <div className="text-xs text-gray-500">Ref: {expense.reference_number}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <span className="badge badge-info">{expense.fund?.name || 'N/A'}</span>
                                        </td>
                                        <td className="table-cell">
                                            {getExpenseTypeBadge(expense.expense_type)}
                                        </td>
                                        <td className="table-cell">
                                            <div className="font-mono font-bold text-gray-900">${expense.amount}</div>
                                        </td>
                                        <td className="table-cell">
                                            <div className="text-sm text-gray-700">
                                                {new Date(expense.expense_date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            {expense.is_approved ? (
                                                <span className="badge badge-success">Approved</span>
                                            ) : (
                                                <span className="badge badge-warning">Pending</span>
                                            )}
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex items-center space-x-1">
                                                {!expense.is_approved && (
                                                    <button
                                                        onClick={() => handleApproveExpense(expense.id)}
                                                        className="p-2 hover:bg-success-50 rounded-lg transition-colors"
                                                        title="Approve expense"
                                                    >
                                                        <Check className="w-4 h-4 text-success-600" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditExpense(expense)}
                                                    className="p-2 hover:bg-primary-50 rounded-lg transition-colors"
                                                    title="Edit expense"
                                                >
                                                    <Edit className="w-4 h-4 text-primary-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteExpense(expense.id)}
                                                    className="p-2 hover:bg-danger-50 rounded-lg transition-colors"
                                                    title="Delete expense"
                                                >
                                                    <Trash2 className="w-4 h-4 text-danger-600" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-backdrop animate-fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="modal-panel animate-scale-in">
                            <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-5 border-b border-primary-200 rounded-t-2xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center">
                                            <DollarSign className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">
                                                {modalMode === 'create' ? 'Add Personnel Expense' : 'Edit Personnel Expense'}
                                            </h2>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-primary-200 rounded-lg">
                                        <X className="w-5 h-5 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Fund *
                                        </label>
                                        <select
                                            value={formData.fund_id}
                                            onChange={(e) => setFormData({...formData, fund_id: e.target.value})}
                                            required
                                            className="select"
                                        >
                                            <option value="">Select Fund</option>
                                            {funds.map(fund => (
                                                <option key={fund.id} value={fund.id}>{fund.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Employee *
                                        </label>
                                        <select
                                            value={formData.employee_id}
                                            onChange={handleUserSelection}
                                            className="select"
                                        >
                                            <option value="">Select Employee</option>
                                            {users.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.first_name && user.last_name 
                                                        ? `${user.first_name} ${user.last_name} (${user.username})`
                                                        : user.username
                                                    }
                                                </option>
                                            ))}
                                            <option value="manual">+ Manual Entry</option>
                                        </select>
                                        {formData.employee_name && formData.employee_id && (
                                            <div className="mt-2 text-sm text-gray-600">
                                                Selected: {formData.employee_name}
                                            </div>
                                        )}
                                        {formData.employee_id === '' && (
                                            <div className="mt-3 animate-fade-in">
                                                <input
                                                    type="text"
                                                    value={formData.employee_name}
                                                    onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
                                                    placeholder="Enter employee name manually"
                                                    className="input"
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Expense Type *
                                        </label>
                                        <select
                                            value={formData.expense_type}
                                            onChange={(e) => setFormData({...formData, expense_type: e.target.value})}
                                            required
                                            className="select"
                                        >
                                            {expenseTypes.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Amount *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                            required
                                            className="input"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Expense Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.expense_date}
                                            onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                                            required
                                            className="input"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Reference Number
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.reference_number}
                                            onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                                            className="input"
                                            placeholder="Invoice/reference number"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        rows={3}
                                        className="input resize-none"
                                        placeholder="Additional details about the expense"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Notes
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                        rows={2}
                                        className="input resize-none"
                                        placeholder="Internal notes"
                                    />
                                </div>

                                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="btn btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        {modalMode === 'create' ? 'Create Expense' : 'Update Expense'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelExpenseManagement;