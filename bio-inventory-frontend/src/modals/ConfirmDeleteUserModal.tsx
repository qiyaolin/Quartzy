import React from 'react';

const ConfirmDeleteUserModal = ({ isOpen, onClose, onConfirm, userName }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-800">Confirm Deletion</h2>
                <p className="mt-4 text-gray-600">Are you sure you want to delete user: <strong>{userName}</strong>? This action cannot be undone.</p>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-semibold text-white hover:bg-red-700">Delete User</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteUserModal;
