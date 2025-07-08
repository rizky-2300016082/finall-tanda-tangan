import React from 'react';
import { Pencil, Download, Trash2, AlertTriangle, Copy } from 'lucide-react';

/**
 * A responsive, modern document card component for a digital signature application.
 * @param {object} props
 * @param {object} props.document - The document object to display.
 * @param {string} props.document.name - The name of the document file.
 * @param {string} props.document.createdDate - The creation date of the document.
 * @param {string} props.document.status - The primary status of the document.
 * @param {string} [props.document.subStatus] - An optional, more detailed status message.
 * @param {Function} props.onSetup - Handler for the setup action.
 * @param {Function} props.onDownload - Handler for the download action.
 * @param {Function} props.onDelete - Handler for the delete action.
 * @param {Function} [props.onCopyLink] - Handler for the copy link action.
 */
const DocumentCard = ({ document, onSetup, onDownload, onDelete, onCopyLink }) => {
  const { name, createdDate, status, subStatus } = document;

  const statusConfig = {
    'Action Required': { bgColor: 'bg-orange-100', textColor: 'text-orange-800', icon: <AlertTriangle size={15} className="mr-1.5" /> },
    'Sent': { bgColor: 'bg-blue-100', textColor: 'text-blue-800', icon: null },
    'Signed': { bgColor: 'bg-green-100', textColor: 'text-green-800', icon: null },
    'default': { bgColor: 'bg-gray-100', textColor: 'text-gray-800', icon: null },
  };

  const currentStatus = statusConfig[status] || statusConfig['default'];

  return (
    <div className="bg-white rounded-xl shadow-md p-5 flex flex-col space-y-4 border border-gray-200 hover:shadow-lg transition-shadow duration-300 max-w-md mx-auto">
      
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-gray-900 truncate" title={name}>{name}</h3>
        <p className="text-sm text-gray-500 mt-1">Created: {createdDate}</p>
      </div>

      <div>
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${currentStatus.bgColor} ${currentStatus.textColor}`}>
          {currentStatus.icon}
          {status}
        </div>
        {subStatus && (<p className="text-sm text-gray-600 mt-2 italic">{subStatus}</p>)}
      </div>

      <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 pt-4 border-t border-gray-100">
        
        {/* Conditional "Setup" Button */}
        {status === 'Action Required' && (
          <button 
            onClick={onSetup}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Pencil size={16} />
            Setup
          </button>
        )}

        {/* Conditional "Copy Link" Button */}
        {status === 'Sent' && (
           <button 
            onClick={onCopyLink}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
          >
            <Copy size={16} />
            Copy Link
          </button>
        )}

        <button 
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
        >
          <Download size={16} />
          Download
        </button>
        <button 
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </div>
  );
};

export const DocumentCardPreview = () => {
    // ... Preview logic can be updated if needed, but not essential for the change
    return <div>Preview placeholder</div>
};

export default DocumentCard;
