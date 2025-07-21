import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';

const UserFormModal = ({ isOpen, onClose, onSave, token, initialData = null }) => {
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const isEditMode = initialData !== null;

    useEffect(() => {
        const emptyForm = { username: '', email: '', first_name: '', last_name: '', password: '', confirm_password: '', is_staff: false, is_active: true };
        if (isEditMode) {
            setFormData({
                username: initialData.username || '', email: initialData.email || '', first_name: initialData.first_name || '',
                last_name: initialData.last_name || '', is_staff: initialData.is_staff || false, is_active: initialData.is_active !== false,
                password: '', confirm_password: ''
            });
        } else { setFormData(emptyForm); }
    }, [initialData, isEditMode]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        
        if (!isEditMode && (!formData.password || formData.password.length < 8)) {
            setError('Password must be at least 8 characters long.');
            setIsSubmitting(false);
            return;
        }
        
        if (formData.password && formData.password !== formData.confirm_password) {
            setError('Passwords do not match.');
            setIsSubmitting(false);
            return;
        }

        const submitData = { ...formData };
        if (isEditMode && !submitData.password) {
            delete submitData.password;
            delete submitData.confirm_password;
        }

        const url = isEditMode ? `http://127.0.0.1:8000/api/users/${initialData.id}/` : 'http://127.0.0.1:8000/api/users/';
        const method = isEditMode ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(url, { 
                method, 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` }, 
                body: JSON.stringify(submitData) 
            });
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(Object.values(errorData).flat().join(', ')); 
            }
            onSave(); onClose();
        } catch (e) { setError(`Submission failed: ${e.message}`); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit User' : 'Add New User'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><X className="w-6 h-6 text-gray-600" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                        <div><label className="block text-sm font-medium text-gray-700">Username *</label><input type="text" name="username" value={formData.username || ''} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">First Name</label><input type="text" name="first_name" value={formData.first_name || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Last Name</label><input type="text" name="last_name" value={formData.last_name || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Password {!isEditMode && '*'}</label><input type="password" name="password" value={formData.password || ''} onChange={handleChange} required={!isEditMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder={isEditMode ? 'Leave blank to keep current password' : ''} /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Confirm Password {!isEditMode && '*'}</label><input type="password" name="confirm_password" value={formData.confirm_password || ''} onChange={handleChange} required={!isEditMode || !!formData.password} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" /></div>
                        <div className="flex items-center">
                            <input type="checkbox" name="is_staff" id="is_staff" checked={formData.is_staff || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="is_staff" className="ml-2 text-sm font-medium text-gray-700">Admin Privileges</label>
                        </div>
                        <div className="flex items-center">
                            <input type="checkbox" name="is_active" id="is_active" checked={formData.is_active !== false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">Active</label>
                        </div>
                    </div>
                    {error && <div className="px-6 pb-4 text-red-600 text-sm">{error}</div>}
                    <div className="p-6 bg-gray-50 rounded-b-lg flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
                            {isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}{isEditMode ? 'Update User' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserFormModal;
