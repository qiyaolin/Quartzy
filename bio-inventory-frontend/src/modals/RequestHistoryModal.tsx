import React from 'react';

const RequestHistoryModal = ({ isOpen, onClose, history }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Request History</h2>
            <ul className="space-y-2">
                {history.map(entry => (
                    <li key={entry.id} className="p-2 bg-gray-50 rounded-md text-sm">
                        Status changed from <strong>{entry.old_status}</strong> to <strong>{entry.new_status}</strong> by {entry.user?.username || 'system'} on {new Date(entry.timestamp).toLocaleString()}
                    </li>
                ))}
            </ul>
            <div className="mt-6 flex justify-end"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold text-gray-800 hover:bg-gray-300">Close</button></div>
        </div></div>
    );
};

export default RequestHistoryModal;
