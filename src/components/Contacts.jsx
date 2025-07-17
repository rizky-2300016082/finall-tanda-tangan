import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';

const Contacts = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    const filtered = contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.phone && contact.phone.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredContacts(filtered);
  }, [searchTerm, contacts]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data);
    } catch (err) {
      setError('Failed to fetch contacts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (contact = null) => {
    setIsModalOpen(true);
    if (contact) {
      setIsEditing(true);
      setCurrentContact(contact);
      setName(contact.name);
      setEmail(contact.email);
      setPhone(contact.phone || '');
    } else {
      setIsEditing(false);
      setCurrentContact(null);
      setName('');
      setEmail('');
      setPhone('');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError('');
  };

  const handleSaveContact = async () => {
    if (!name || !email) {
      setError('Name and email are required');
      return;
    }

    const contactData = {
      user_id: user.id,
      name,
      email,
      phone,
    };

    try {
      let result;
      if (isEditing) {
        result = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', currentContact.id);
      } else {
        result = await supabase
          .from('contacts')
          .insert(contactData);
      }
      
      const { error } = result;

      if (error) throw error;
      
      fetchContacts();
      closeModal();
    } catch (err) {
      setError('Failed to save contact');
      console.error(err);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      try {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', contactId);
        
        if (error) throw error;
        fetchContacts();
      } catch (err) {
        setError('Failed to delete contact');
        console.error(err);
      }
    }
  };

  if (loading) return <p>Loading contacts...</p>;
  
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Kontak</h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600"
        >
          <Plus size={18} />
          Tambah Kontak
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-700">Daftar Kontak</h3>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kontak..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm pl-10 p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telepon</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContacts.map(contact => (
                <tr key={contact.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{contact.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{contact.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{contact.phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button onClick={() => openModal(contact)} className="text-blue-500 hover:text-blue-700 mr-2">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDeleteContact(contact.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal for Add/Edit Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Kontak' : 'Tambah Kontak Baru'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 mt-1"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 mt-1"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telepon (Opsional)</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 mt-1"/>
              </div>
            </div>

            <div className="flex justify-end mt-8 space-x-4">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                Batal
              </button>
              <button onClick={handleSaveContact} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
