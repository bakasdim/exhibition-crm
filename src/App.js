import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Camera, User, LogOut, Save, X, Edit2, Trash2, Plus, ChevronDown, ChevronUp, Download, BarChart3, Search, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import './App.css';

// ⚠️ REPLACE THESE WITH YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://xgpzjkjcqohebsiyofol.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncHpqa2pjcW9oZWJzaXlvZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzQ1MDYsImV4cCI6MjA3NjExMDUwNn0.Dlm26WcwP8vu01XlrQ15owcpt3fkhfS0U5R43cUFsgA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [activePage, setActivePage] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [expandedContact, setExpandedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [lastSaved, setLastSaved] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const [contactForm, setContactForm] = useState({
    name: '',
    priority: 5,
    email: '',
    phone: '',
    company: '',
    businessType: 'apartments',
    photos: [],
    products: [],
    notes: '',
    salesPerson: ''
  });

  const [productForm, setProductForm] = useState({
    productType: 'chair',
    customProductType: '',
    productName: '',
    color: '',
    pieces: '',
    details: ''
  });

  const [showCamera, setShowCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState('product');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const businessTypes = [
    { value: 'apartments', label: 'Apartments' },
    { value: 'airbnbs', label: 'Airbnbs' },
    { value: 'hotels', label: 'Hotels' },
    { value: 'cafe-restaurant', label: 'Cafe/Restaurant' }
  ];

  const productTypes = [
    'chair', 'armchair', 'stool', 'table', 'coffee table', 
    'side table', 'console', 'cabinet', 'shelving', 'other'
  ];

  // Show notification
  const showNotification = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Load contacts from Supabase
  const loadContacts = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error loading contacts:', error);
      showNotification('Failed to load contacts: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadContacts();
    }
  }, [currentUser, loadContacts]);

  // Filter contacts
  useEffect(() => {
    let filtered = contacts;

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(c => c.business_type === filterType);
    }

    if (filterPriority !== 'all') {
      if (filterPriority === 'high') {
        filtered = filtered.filter(c => c.priority >= 8);
      } else if (filterPriority === 'medium') {
        filtered = filtered.filter(c => c.priority >= 5 && c.priority < 8);
      } else if (filterPriority === 'low') {
        filtered = filtered.filter(c => c.priority < 5);
      }
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, filterType, filterPriority]);

  // Check for duplicates
  const checkDuplicate = (email, phone, excludeId = null) => {
    if (!email && !phone) return null;
    
    return contacts.find(c => 
      c.id !== excludeId && 
      ((email && c.email === email) || (phone && c.phone === phone))
    );
  };

  // Handle login
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginEmail.trim()) {
      setCurrentUser({ email: loginEmail.trim() });
      setContactForm(prev => ({ ...prev, salesPerson: loginEmail.trim() }));
    }
  };

  // Handle logout
  const handleLogout = () => {
    setCurrentUser(null);
    setLoginEmail('');
    setContacts([]);
    setActivePage('contacts');
  };

  // Handle form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  // Camera functions
  const startCamera = async (mode = 'product') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setShowCamera(true);
      setCaptureMode(mode);
    } catch (error) {
      console.error('Camera error:', error);
      showNotification('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setContactForm(prev => ({
          ...prev,
          photos: [...prev.photos, { url, blob, type: captureMode }]
        }));
        stopCamera();
        showNotification('Photo captured!', 'success');
      }, 'image/jpeg', 0.95);
    }
  };

  const removePhoto = (index) => {
    setContactForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  // Product functions
  const addProduct = () => {
    if (!productForm.productType && !productForm.customProductType) {
      showNotification('Please select or enter a product type');
      return;
    }

    const product = {
      id: Date.now(),
      type: productForm.productType === 'other' ? productForm.customProductType : productForm.productType,
      name: productForm.productName,
      color: productForm.color,
      pieces: productForm.pieces,
      details: productForm.details
    };

    setContactForm(prev => ({
      ...prev,
      products: [...prev.products, product]
    }));

    setProductForm({
      productType: 'chair',
      customProductType: '',
      productName: '',
      color: '',
      pieces: '',
      details: ''
    });

    showNotification('Product added!', 'success');
  };

  const removeProduct = (id) => {
    setContactForm(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id)
    }));
  };

  // Upload photos to Supabase Storage
  const uploadPhotos = async (contactId, photos) => {
    const photoUrls = [];
    
    for (const photo of photos) {
      try {
        const fileName = `${contactId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const { error } = await supabase.storage
          .from('product-photos')
          .upload(fileName, photo.blob, {
            contentType: 'image/jpeg'
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('product-photos')
          .getPublicUrl(fileName);

        photoUrls.push({ url: urlData.publicUrl, type: photo.type });
      } catch (error) {
        console.error('Photo upload error:', error);
      }
    }

    return photoUrls;
  };

  // Save/Update contact
  const handleContactSubmit = async () => {
    // Validations
    if (!contactForm.name || !contactForm.name.trim()) {
      showNotification('Contact name is required');
      return;
    }

    if (contactForm.phone) {
      const digitsOnly = contactForm.phone.replace(/\D/g, '');
      if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
        showNotification(`Telephone must be exactly 10 digits (currently ${digitsOnly.length} digits)`);
        return;
      }
    }

    const duplicate = checkDuplicate(contactForm.email, contactForm.phone, editingContact?.id);
    if (duplicate && (contactForm.email || contactForm.phone)) {
      const duplicateField = contactForm.email === duplicate.email ? 'email' : 'phone number';
      const confirmed = window.confirm(`Duplicate found: ${duplicate.name} has the same ${duplicateField}. Save anyway?`);
      if (!confirmed) return;
    }

    setLoading(true);

    try {
      if (editingContact) {
        // Update existing contact
        let photoUrls = editingContact.photo_urls || [];
        
        if (contactForm.photos.length > 0) {
          const newPhotoUrls = await uploadPhotos(editingContact.id, contactForm.photos);
          photoUrls = [...photoUrls, ...newPhotoUrls];
        }

        const { error } = await supabase
          .from('contacts')
          .update({
            name: contactForm.name,
            email: contactForm.email,
            phone: contactForm.phone,
            company: contactForm.company,
            business_type: contactForm.businessType,
            priority: parseInt(contactForm.priority),
            notes: contactForm.notes,
            products: contactForm.products,
            photo_urls: photoUrls
          })
          .eq('id', editingContact.id);

        if (error) throw error;

        showNotification('Contact updated successfully!', 'success');
        setEditingContact(null);
      } else {
        // Create new contact
        const contactData = {
          name: contactForm.name,
          email: contactForm.email,
          phone: contactForm.phone,
          company: contactForm.company,
          business_type: contactForm.businessType,
          priority: parseInt(contactForm.priority),
          notes: contactForm.notes,
          sales_person: currentUser.email,
          products: contactForm.products
        };

        const { data, error } = await supabase
          .from('contacts')
          .insert([contactData])
          .select()
          .single();

        if (error) throw error;

        if (contactForm.photos.length > 0) {
          const photoUrls = await uploadPhotos(data.id, contactForm.photos);
          await supabase
            .from('contacts')
            .update({ photo_urls: photoUrls })
            .eq('id', data.id);
        }

        showNotification('Contact saved successfully!', 'success');
      }

      // Reset form
      setContactForm({
        name: '',
        priority: 5,
        email: '',
        phone: '',
        company: '',
        businessType: 'apartments',
        photos: [],
        products: [],
        notes: '',
        salesPerson: currentUser.email
      });

      await loadContacts();
      setActivePage('contacts');
    } catch (error) {
      console.error('Save error:', error);
      showNotification('Failed to save contact: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit contact
  const handleEdit = (contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      priority: contact.priority,
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      businessType: contact.business_type,
      photos: [],
      products: contact.products || [],
      notes: contact.notes || '',
      salesPerson: contact.sales_person
    });
    setActivePage('new-contact');
  };

  // Delete contact
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showNotification('Contact deleted successfully!', 'success');
      await loadContacts();
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('Failed to delete contact: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV
  const exportToCSV = (dataToExport) => {
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Business Type', 'Priority', 'Products', 'Notes', 'Salesperson', 'Date'];
    const rows = dataToExport.map(c => [
      c.name,
      c.company || '',
      c.email || '',
      c.phone || '',
      c.business_type,
      c.priority,
      (c.products || []).map(p => `${p.type} (${p.pieces || 'N/A'})`).join('; '),
      c.notes || '',
      c.sales_person,
      new Date(c.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Export completed!', 'success');
  };

  // Share via email
  const shareContact = (contact) => {
    const products = (contact.products || []).map(p => 
      `- ${p.type}${p.name ? ` (${p.name})` : ''}${p.pieces ? ` - ${p.pieces} pieces` : ''}${p.color ? ` - ${p.color}` : ''}${p.details ? ` - ${p.details}` : ''}`
    ).join('\n');

    const body = `New Contact Inquiry from Exhibition

Name: ${contact.name}
Company: ${contact.company || 'N/A'}
Email: ${contact.email || 'N/A'}
Phone: ${contact.phone || 'N/A'}
Business Type: ${contact.business_type}
Priority: ${contact.priority}/10

Products of Interest:
${products || 'None specified'}

Notes:
${contact.notes || 'None'}

---
Collected by: ${contact.sales_person}
Date: ${new Date(contact.created_at).toLocaleString()}`;

    const mailtoLink = `mailto:backoffice@yourcompany.com?subject=Exhibition Inquiry - ${contact.name}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  // Statistics
  const getStats = () => {
    const bySalesperson = contacts.reduce((acc, c) => {
      acc[c.sales_person] = (acc[c.sales_person] || 0) + 1;
      return acc;
    }, {});

    const byType = contacts.reduce((acc, c) => {
      acc[c.business_type] = (acc[c.business_type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: contacts.length,
      highPriority: contacts.filter(c => c.priority >= 8).length,
      salespeople: Object.keys(bySalesperson).length,
      bySalesperson,
      byType
    };
  };

  const stats = getStats();

  // Login Screen
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>🎪 Exhibition CRM</h1>
          <p style={{ color: '#666', marginBottom: '30px' }}>Sales Contact Tracker</p>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Enter your email"
              style={{ width: '100%', padding: '15px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '15px' }}
              required
            />
            <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Start Tracking
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontSize: '24px', color: '#333', margin: 0 }}>📋 Exhibition CRM</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          {lastSaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: '#10b981' }}>
              <CheckCircle size={16} />
              Saved {lastSaved.toLocaleTimeString()}
            </div>
          )}
          <span style={{ background: '#667eea', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px' }}>
            {currentUser.email}
          </span>
          <button onClick={handleLogout} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{ 
          background: notification.type === 'error' ? '#fee2e2' : notification.type === 'warning' ? '#fef3c7' : '#d1fae5', 
          border: `2px solid ${notification.type === 'error' ? '#ef4444' : notification.type === 'warning' ? '#f59e0b' : '#10b981'}`,
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {notification.type === 'error' ? <AlertCircle color="#ef4444" /> : <CheckCircle color="#10b981" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation */}
      <div style={{ background: 'white', padding: '10px', borderRadius: '12px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActivePage('new-contact')} 
          style={{ 
            flex: '1', 
            minWidth: '150px',
            background: activePage === 'new-contact' ? '#667eea' : '#f3f4f6', 
            color: activePage === 'new-contact' ? 'white' : '#333', 
            border: 'none', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Plus size={18} />
          New Contact
        </button>
        <button 
          onClick={() => setActivePage('contacts')} 
          style={{ 
            flex: '1',
            minWidth: '150px',
            background: activePage === 'contacts' ? '#667eea' : '#f3f4f6', 
            color: activePage === 'contacts' ? 'white' : '#333', 
            border: 'none', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <User size={18} />
          Contacts ({contacts.length})
        </button>
        <button 
          onClick={() => setActivePage('statistics')} 
          style={{ 
            flex: '1',
            minWidth: '150px',
            background: activePage === 'statistics' ? '#667eea' : '#f3f4f6', 
            color: activePage === 'statistics' ? 'white' : '#333', 
            border: 'none', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <BarChart3 size={18} />
          Statistics
        </button>
      </div>

      {/* Statistics Page */}
      {activePage === 'statistics' && (
        <div style={{ background: 'white', padding: '30px', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Exhibition Statistics</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: '#dbeafe', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#1e40af', marginBottom: '5px' }}>Total Contacts</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e3a8a' }}>{stats.total}</div>
            </div>
            <div style={{ background: '#fecaca', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#991b1b', marginBottom: '5px' }}>High Priority</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#7f1d1d' }}>{stats.highPriority}</div>
            </div>
            <div style={{ background: '#d1fae5', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#065f46', marginBottom: '5px' }}>Salespeople</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#064e3b' }}>{stats.salespeople}</div>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Contacts by Salesperson</h3>
            {Object.entries(stats.bySalesperson).map(([person, count]) => (
              <div key={person} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f9fafb', borderRadius: '8px', marginBottom: '8px' }}>
                <span>{person}</span>
                <span style={{ fontWeight: 'bold' }}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Contacts by Business Type</h3>
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f9fafb', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={{ textTransform: 'capitalize' }}>{type.replace('-', ' ')}</span>
                <span style={{ fontWeight: 'bold' }}>{count}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => exportToCSV(contacts)}
            style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <Download size={20} />
            Export All Contacts to CSV
          </button>
        </div>
      )}

      {/* Contacts Page */}
      {activePage === 'contacts' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '12px 12px 12px 40px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="all">All Types</option>
                {businessTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="all">All Priorities</option>
                <option value="high">High (8-10)</option>
                <option value="medium">Medium (5-7)</option>
                <option value="low">Low (1-4)</option>
              </select>
              <button
                onClick={() => exportToCSV(filteredContacts)}
                style={{ padding: '12px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
              >
                <Download size={18} />
                Export ({filteredContacts.length})
              </button>
            </div>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>}

          {!loading && filteredContacts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
              <p style={{ fontSize: '18px' }}>No contacts found</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredContacts.map(contact => (
              <div key={contact.id} style={{ background: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{contact.name}</h3>
                  <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '12px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    background: contact.priority >= 8 ? '#fecaca' : contact.priority >= 5 ? '#fef3c7' : '#dbeafe',
                    color: contact.priority >= 8 ? '#991b1b' : contact.priority >= 5 ? '#92400e' : '#1e40af'
                  }}>
                    Priority: {contact.priority}
                  </span>
                </div>

                {contact.photo_urls && contact.photo_urls.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <img src={contact.photo_urls[0].url} alt="Contact" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                  </div>
                )}

                <div style={{ marginBottom: '15px', fontSize: '14px', color: '#4b5563' }}>
                  {contact.company && <div style={{ marginBottom: '6px' }}><strong>Company:</strong> {contact.company}</div>}
                  {contact.email && <div style={{ marginBottom: '6px' }}><strong>Email:</strong> {contact.email}</div>}
                  {contact.phone && <div style={{ marginBottom: '6px' }}><strong>Phone:</strong> {contact.phone}</div>}
                  <div style={{ marginBottom: '6px' }}><strong>Type:</strong> {contact.business_type}</div>
                  {contact.products && contact.products.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Products:</strong> {contact.products.map(p => p.type).join(', ')}
                    </div>
                  )}
                  {contact.notes && <div style={{ marginBottom: '6px' }}><strong>Notes:</strong> {contact.notes}</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                  <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {new Date(contact.created_at).toLocaleDateString()}
                  </small>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => shareContact(contact)}
                      style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Share2 size={14} />
                      Share
                    </button>
                    <button
                      onClick={() => handleEdit(contact)}
                      style={{ padding: '6px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New/Edit Contact Page */}
      {activePage === 'new-contact' && (
        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
            {editingContact ? '✏️ Edit Contact' : '➕ New Contact'}
          </h2>

          {/* Contact Details */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Contact Details</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={contactForm.name}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Company</label>
                <input
                  type="text"
                  name="company"
                  value={contactForm.company}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Phone (10 digits)</label>
                <input
                  type="tel"
                  name="phone"
                  value={contactForm.phone}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Business Type</label>
                <select
                  name="businessType"
                  value={contactForm.businessType}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                >
                  {businessTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Priority: {contactForm.priority}
                </label>
                <input
                  type="range"
                  name="priority"
                  min="1"
                  max="10"
                  value={contactForm.priority}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Notes</label>
              <textarea
                name="notes"
                value={contactForm.notes}
                onChange={handleInputChange}
                rows="4"
                style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                placeholder="General notes about the contact..."
              />
            </div>
          </div>

          {/* Products */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Products of Interest</h3>
            
            <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Product Type</label>
                  <select
                    value={productForm.productType}
                    onChange={(e) => setProductForm({ ...productForm, productType: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
                  >
                    {productTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {productForm.productType === 'other' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Custom Type</label>
                    <input
                      type="text"
                      value={productForm.customProductType}
                      onChange={(e) => setProductForm({ ...productForm, customProductType: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
                      placeholder="Enter type"
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Product Name</label>
                  <input
                    type="text"
                    value={productForm.productName}
                    onChange={(e) => setProductForm({ ...productForm, productName: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Color</label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Pieces</label>
                  <input
                    type="text"
                    value={productForm.pieces}
                    onChange={(e) => setProductForm({ ...productForm, pieces: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="Optional"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Details</label>
                  <input
                    type="text"
                    value={productForm.details}
                    onChange={(e) => setProductForm({ ...productForm, details: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="Additional details"
                  />
                </div>
              </div>

              <button
                onClick={addProduct}
                style={{ width: '100%', padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={18} />
                Add Product
              </button>
            </div>

            {contactForm.products.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {contactForm.products.map(product => (
                  <div key={product.id} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px' }}>
                      <strong>{product.type}</strong>
                      {product.name && ` - ${product.name}`}
                      {product.color && ` (${product.color})`}
                      {product.pieces && ` - ${product.pieces} pieces`}
                      {product.details && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{product.details}</div>}
                    </div>
                    <button
                      onClick={() => removeProduct(product.id)}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Photos</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' }}>
              {contactForm.photos.map((photo, index) => (
                <div key={index} style={{ position: 'relative', paddingBottom: '100%', background: '#f3f4f6', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={photo.url} alt={`Photo ${index + 1}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => removePhoto(index)}
                    style={{ position: 'absolute', top: '5px', right: '5px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                    {photo.type}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => startCamera('product')}
                style={{ flex: 1, padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Camera size={18} />
                Capture Product Photo
              </button>
              <button
                onClick={() => startCamera('business-card')}
                style={{ flex: 1, padding: '12px', background: '#764ba2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Camera size={18} />
                Capture Business Card
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                setActivePage('contacts');
                setEditingContact(null);
                setContactForm({
                  name: '',
                  priority: 5,
                  email: '',
                  phone: '',
                  company: '',
                  businessType: 'apartments',
                  photos: [],
                  products: [],
                  notes: '',
                  salesPerson: currentUser.email
                });
              }}
              style={{ flex: 1, padding: '15px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              Cancel
            </button>
            <button
              onClick={handleContactSubmit}
              disabled={loading}
              style={{ flex: 2, padding: '15px', background: loading ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Save size={20} />
              {loading ? 'Saving...' : (editingContact ? 'Update Contact' : 'Save Contact')}
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '600px', width: '100%' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>
              {captureMode === 'business-card' ? '📇 Capture Business Card' : '📷 Capture Product Photo'}
            </h3>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px', marginBottom: '15px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={stopCamera}
                style={{ flex: 1, padding: '12px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                style={{ flex: 2, padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
              >
                📸 Capture
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;
