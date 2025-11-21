import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, User, LogOut, Save, X, Edit2, Trash2, Plus, ChevronDown, ChevronUp, Download, BarChart3, Search, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Read from environment variables
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ExhibitionCRM() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authLoading, setAuthLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [activePage, setActivePage] = useState('new-contact');
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [expandedContact, setExpandedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSalesperson, setFilterSalesperson] = useState('all');
  const [lastSaved, setLastSaved] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  
  const [contactForm, setContactForm] = useState({
    name: '',
    priority: 5,
    email: '',
    phone: '',
    company: '',
    businessType: 'apartments',
    products: [],
    notes: '',
    timestamp: '',
    salesPerson: ''
  });

  const [productForm, setProductForm] = useState({
    productType: 'chair',
    customProductType: '',
    productName: '',
    color: '',
    pieces: '',
    details: '',
    photos: []
  });
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [notification, setNotification] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showNotification = useCallback((message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      .animate-slide-in {
        animation: slideIn 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Check for existing session on mount
  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Get user role from metadata (default to 'user' if not set)
      const userRole = session.user.user_metadata?.role || 'user';
      
      setCurrentUser({ 
        email: session.user.email, 
        id: session.user.id,
        role: userRole
      });
    }
  }, []);

  useEffect(() => {
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const userRole = session.user.user_metadata?.role || 'user';
        setCurrentUser({ 
          email: session.user.email, 
          id: session.user.id,
          role: userRole
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkSession]);

  // Load contacts from Supabase when user logs in
  const loadContactsFromSupabase = useCallback(async () => {
    try {
      let query = supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      // If user is not admin, only show their own contacts
      if (currentUser?.role !== 'admin') {
        query = query.eq('sales_person', currentUser?.email);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert Supabase format to app format
      const formattedContacts = (data || []).map(contact => ({
        id: contact.id,
        name: contact.name,
        priority: contact.priority,
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        businessType: contact.business_type,
        products: contact.products || [],
        notes: contact.notes || '',
        timestamp: contact.created_at,
        salesPerson: contact.sales_person
      }));

      setContacts(formattedContacts);
      setFilteredContacts(formattedContacts);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error loading contacts:', error);
      showNotification('Failed to load contacts from database', 'error');
    }
  }, [showNotification, currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadContactsFromSupabase();
    }
  }, [currentUser, loadContactsFromSupabase]);

  const applyFilters = useCallback(() => {
    let filtered = [...contacts];

    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.includes(searchTerm)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(contact => contact.businessType === filterType);
    }

    if (filterPriority !== 'all') {
      const [min, max] = filterPriority.split('-').map(Number);
      filtered = filtered.filter(contact => contact.priority >= min && contact.priority <= max);
    }

    if (filterSalesperson !== 'all') {
      filtered = filtered.filter(contact => contact.salesPerson === filterSalesperson);
    }

    setFilteredContacts(filtered);
  }, [searchTerm, filterType, filterPriority, filterSalesperson, contacts]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Check if email is from bn-group.gr domain
    if (!authEmail.toLowerCase().endsWith('@bn-group.gr')) {
      showNotification('Only @bn-group.gr email addresses are allowed to sign up', 'error');
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      if (error) throw error;

      if (data.user) {
        showNotification('Account created! Check your email to verify before logging in.', 'success');
        setAuthMode('login');
        setAuthPassword('');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) throw error;

      if (data.user) {
        // Check if email is verified
        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setShowResendVerification(true);
          showNotification('Please verify your email before logging in. Check your inbox for the verification link.', 'error');
          return;
        }

        // Get user role from metadata (default to 'user' if not set)
        const userRole = data.user.user_metadata?.role || 'user';

        setCurrentUser({ 
          email: data.user.email, 
          id: data.user.id,
          role: userRole
        });
        showNotification('Login successful!', 'success');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!authEmail) {
      showNotification('Please enter your email address', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: authEmail,
      });

      if (error) throw error;

      showNotification('Verification email sent! Please check your inbox.', 'success');
      setShowResendVerification(false);
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setContacts([]);
    setFilteredContacts([]);
    showNotification('Logged out successfully', 'success');
  };

  const checkDuplicate = (email, phone, excludeId = null) => {
    return contacts.find(contact => 
      contact.id !== excludeId && 
      (contact.email === email || contact.phone === phone)
    );
  };

  // Upload photos to Supabase Storage
  const uploadPhotosToStorage = async (photos, contactId) => {
    const uploadedUrls = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      
      // Convert base64 to blob
      const response = await fetch(photo);
      const blob = await response.blob();
      
      const fileName = `${contactId}_${Date.now()}_${i}.jpg`;
      
      try {
        const { error: uploadError } = await supabase.storage
          .from('product-photos')
          .upload(fileName, blob, {
            contentType: 'image/jpeg'
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('product-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }

    return uploadedUrls;
  };

  const handleContactSubmit = async () => {
    if (!contactForm.name || !contactForm.name.trim()) {
      showNotification('Contact name is required', 'error');
      return;
    }
    
    if (contactForm.phone) {
      const digitsOnly = contactForm.phone.replace(/\D/g, '');
      if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
        showNotification(`Telephone must be exactly 10 digits (currently ${digitsOnly.length} digits)`, 'error');
        return;
      }
    }

    const duplicate = checkDuplicate(contactForm.email, contactForm.phone, editingContact?.id);
    if (duplicate && (contactForm.email || contactForm.phone)) {
      const duplicateField = contactForm.email === duplicate.email ? 'email' : 'phone number';
      showNotification(`A contact with this ${duplicateField} already exists: ${duplicate.name}. Please verify the information.`, 'warning');
      if (!window.confirm(`Duplicate found: ${duplicate.name} has the same ${duplicateField}. Save anyway?`)) {
        return;
      }
    }

    try {
      // Upload photos for all products
      const productsWithUploadedPhotos = await Promise.all(
        contactForm.products.map(async (product) => {
          if (product.photos && product.photos.length > 0) {
            const uploadedUrls = await uploadPhotosToStorage(product.photos, editingContact?.id || Date.now());
            return {
              ...product,
              photos: uploadedUrls
            };
          }
          return product;
        })
      );

      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update({
            name: contactForm.name,
            priority: contactForm.priority,
            email: contactForm.email,
            phone: contactForm.phone,
            company: contactForm.company,
            business_type: contactForm.businessType,
            products: productsWithUploadedPhotos,
            notes: contactForm.notes,
            sales_person: contactForm.salesPerson
          })
          .eq('id', editingContact.id);

        if (error) throw error;

        setEditingContact(null);
        showNotification('Contact updated successfully!', 'success');
      } else {
        // Create new contact
        const { error } = await supabase
          .from('contacts')
          .insert([{
            name: contactForm.name,
            priority: contactForm.priority,
            email: contactForm.email,
            phone: contactForm.phone,
            company: contactForm.company,
            business_type: contactForm.businessType,
            products: productsWithUploadedPhotos,
            notes: contactForm.notes,
            sales_person: currentUser.email
          }]);

        if (error) throw error;

        showNotification('Contact saved successfully!', 'success');
      }

      // Reload contacts from Supabase
      await loadContactsFromSupabase();
      
      setTimeout(() => setActivePage('contacts'), 1000);

      setContactForm({
        name: '',
        priority: 5,
        email: '',
        phone: '',
        company: '',
        businessType: 'apartments',
        products: [],
        notes: '',
        timestamp: '',
        salesPerson: ''
      });
    } catch (error) {
      console.error('Error saving contact:', error);
      showNotification('Failed to save contact to database', 'error');
    }
  };

  const handleEditContact = (contact) => {
    setContactForm(contact);
    setEditingContact(contact);
    setActivePage('new-contact');
    window.scrollTo(0, 0);
  };

  const handleDeleteContact = (contactId) => {
    const contactToDelete = contacts.find(c => c.id === contactId);
    setDeleteConfirm({
      id: contactId,
      name: contactToDelete?.name || 'this contact'
    });
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', deleteConfirm.id);

        if (error) throw error;

        await loadContactsFromSupabase();
        setExpandedContact(null);
        setDeleteConfirm(null);
        showNotification('Contact deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting contact:', error);
        showNotification('Failed to delete contact', 'error');
      }
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleAddProductToContact = () => {
    if (productForm.productType === 'other' && !productForm.customProductType.trim()) {
      showNotification('Please enter a custom product type', 'error');
      return;
    }
    
    if (!productForm.productName.trim() && productForm.photos.length === 0) {
      showNotification('Please enter a product name or take a photo', 'error');
      return;
    }
    
    const finalProductType = productForm.productType === 'other' 
      ? productForm.customProductType 
      : productForm.productType;
    
    if (editingProduct !== null) {
      const updatedProducts = contactForm.products.map((p, idx) => 
        idx === editingProduct ? { ...productForm, productType: finalProductType, id: p.id } : p
      );
      setContactForm({ ...contactForm, products: updatedProducts });
      setEditingProduct(null);
      showNotification('Product updated successfully!', 'success');
    } else {
      const newProduct = {
        ...productForm,
        productType: finalProductType,
        id: Date.now()
      };
      setContactForm({
        ...contactForm,
        products: [...contactForm.products, newProduct]
      });
      showNotification('Product added successfully!', 'success');
    }
    setProductForm({ 
      productType: 'chair',
      customProductType: '',
      productName: '', 
      color: '',
      pieces: '',
      details: '',
      photos: []
    });
  };

  const handleEditProduct = (index) => {
    setEditingProduct(index);
    setProductForm(contactForm.products[index]);
  };

  const handleDeleteProduct = (index) => {
    if (window.confirm('Delete this product?')) {
      setContactForm({
        ...contactForm,
        products: contactForm.products.filter((_, idx) => idx !== index)
      });
      showNotification('Product removed', 'success');
    }
  };

  const exportToCSV = (contactsToExport) => {
    if (contactsToExport.length === 0) {
      showNotification('No contacts to export', 'warning');
      return;
    }

    const headers = ['Name', 'Company', 'Email', 'Phone', 'Business Type', 'Priority', 'Products', 'Notes', 'Sales Person', 'Date'];
    const rows = contactsToExport.map(contact => [
      contact.name,
      contact.company,
      contact.email,
      contact.phone,
      contact.businessType,
      contact.priority,
      contact.products.map(p => {
        const name = p.productName || '[Photo only - identify from image]';
        const qty = p.pieces ? ` (Qty: ${p.pieces})` : '';
        const color = p.color ? ` - ${p.color}` : '';
        const photoNote = p.photos && p.photos.length > 0 ? ` [${p.photos.length} photo(s)]` : '';
        return `${p.productType}: ${name}${qty}${color}${photoNote}`;
      }).join('; '),
      contact.notes,
      contact.salesPerson,
      new Date(contact.timestamp).toLocaleDateString()
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exhibition-contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    showNotification(`Exported ${contactsToExport.length} contacts to CSV`, 'success');
  };

  const shareWithBackoffice = (contact) => {
    const subject = encodeURIComponent(`Exhibition Lead: ${contact.name}`);
    const body = encodeURIComponent(`
New Exhibition Lead

Contact Information:
- Name: ${contact.name}
- Company: ${contact.company}
- Email: ${contact.email}
- Phone: ${contact.phone}
- Business Type: ${contact.businessType}
- Priority: ${contact.priority}/10

Products of Interest:
${contact.products.map(p => {
  const name = p.productName || '[Photo only - identify from image]';
  const qty = p.pieces ? ` (Qty: ${p.pieces})` : '';
  const color = p.color ? ` (${p.color})` : '';
  const details = p.details ? ` - ${p.details}` : '';
  const photoNote = p.photos && p.photos.length > 0 ? ` [${p.photos.length} photo(s) attached]` : '';
  return `- ${p.productType}: ${name}${qty}${color}${details}${photoNote}`;
}).join('\n')}

Notes:
${contact.notes || 'No additional notes'}

Collected by: ${contact.salesPerson}
Date: ${new Date(contact.timestamp).toLocaleString()}
    `);

    window.location.href = `mailto:backoffice@yourcompany.com?subject=${subject}&body=${body}`;
    showNotification('Opening email client...', 'success');
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      showNotification('Camera access denied or not available. Please check your browser permissions.', 'error');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const photoData = canvas.toDataURL('image/jpeg');
      
      setProductForm({
        ...productForm,
        photos: [...productForm.photos, photoData]
      });
      stopCamera();
      showNotification('Product photo captured successfully!', 'success');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const removePhoto = (index) => {
    setProductForm({
      ...productForm,
      photos: productForm.photos.filter((_, i) => i !== index)
    });
  };

  const getStatistics = () => {
    const stats = {
      total: contacts.length,
      bySalesperson: {},
      byBusinessType: {},
      highPriority: contacts.filter(c => c.priority >= 8).length
    };

    contacts.forEach(contact => {
      stats.bySalesperson[contact.salesPerson] = (stats.bySalesperson[contact.salesPerson] || 0) + 1;
      stats.byBusinessType[contact.businessType] = (stats.byBusinessType[contact.businessType] || 0) + 1;
    });

    return stats;
  };

  // Login/Signup Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Exhibition CRM</h1>
            <p className="text-gray-600">
              {authMode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>
          
          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={authMode === 'signup' ? 'name@bn-group.gr' : 'name@company.com'}
                required
              />
              {authMode === 'signup' && (
                <p className="text-xs text-gray-500 mt-1">Only @bn-group.gr email addresses are allowed</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={authMode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                required
                minLength={authMode === 'signup' ? 6 : undefined}
              />
              {authMode === 'signup' && (
                <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthPassword('');
                setShowResendVerification(false);
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {authMode === 'login' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>

          {showResendVerification && authMode === 'login' && (
            <div className="mt-4">
              <button
                onClick={handleResendVerification}
                disabled={authLoading}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {authLoading ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          )}

          {authMode === 'signup' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Important:</strong> After signing up, you must verify your email before you can log in. Check your inbox for the verification link.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const stats = getStatistics();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/assets/logo.svg" alt="Logo" className="h-8 w-auto" />
              <h1 className="text-xl font-bold text-gray-800">Exhibition CRM</h1>
            </div>
            <div className="flex items-center gap-4">
              {lastSaved && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Synced {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{currentUser.email}</span>
                {currentUser.role === 'admin' && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">
                    ADMIN
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActivePage('new-contact');
                setEditingContact(null);
                setContactForm({
                  name: '',
                  priority: 5,
                  email: '',
                  phone: '',
                  company: '',
                  businessType: 'apartments',
                  products: [],
                  notes: '',
                  timestamp: '',
                  salesPerson: ''
                });
              }}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition ${
                activePage === 'new-contact'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Plus className="w-4 h-4" />
              New Contact
            </button>
            <button
              onClick={() => setActivePage('contacts')}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition ${
                activePage === 'contacts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <User className="w-4 h-4" />
              Saved Contacts ({contacts.length})
            </button>
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActivePage('statistics')}
                className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition ${
                  activePage === 'statistics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Statistics
              </button>
            )}
          </div>
        </div>
      </div>

      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 max-w-md flex items-start gap-3 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-2 border-green-500' 
              : notification.type === 'warning'
              ? 'bg-yellow-50 border-2 border-yellow-500'
              : 'bg-red-50 border-2 border-red-500'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                notification.type === 'warning' ? 'text-yellow-600' : 'text-red-600'
              }`} />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                notification.type === 'success' 
                  ? 'text-green-800' 
                  : notification.type === 'warning'
                  ? 'text-yellow-800'
                  : 'text-red-800'
              }`}>
                {notification.type === 'success' ? 'Success' : notification.type === 'warning' ? 'Warning' : 'Error'}
              </p>
              <p className={`text-sm mt-1 ${
                notification.type === 'success' 
                  ? 'text-green-700' 
                  : notification.type === 'warning'
                  ? 'text-yellow-700'
                  : 'text-red-700'
              }`}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`flex-shrink-0 ${
                notification.type === 'success' 
                  ? 'text-green-600 hover:text-green-800' 
                  : notification.type === 'warning'
                  ? 'text-yellow-600 hover:text-yellow-800'
                  : 'text-red-600 hover:text-red-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4">
        {activePage === 'statistics' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">Exhibition Statistics</h2>
              <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded font-semibold">
                ADMIN VIEW - All Users
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600 font-medium mb-1">Total Contacts</p>
                <p className="text-3xl font-bold text-blue-700">{stats.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-600 font-medium mb-1">High Priority</p>
                <p className="text-3xl font-bold text-green-700">{stats.highPriority}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-600 font-medium mb-1">Sales People</p>
                <p className="text-3xl font-bold text-purple-700">{Object.keys(stats.bySalesperson).length}</p>
              </div>
            </div>

            {Object.keys(stats.bySalesperson).length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Contacts by Salesperson</h3>
                <div className="space-y-3">
                  {Object.entries(stats.bySalesperson).map(([email, count]) => (
                    <div key={email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">{email}</span>
                      <span className="text-lg font-bold text-blue-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(stats.byBusinessType).length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Contacts by Business Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byBusinessType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                      <span className="text-lg font-bold text-indigo-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 border-t">
              <button
                onClick={() => exportToCSV(contacts)}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Export All Contacts to CSV
              </button>
            </div>
          </div>
        ) : activePage === 'contacts' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {currentUser.role === 'admin' ? 'All Contacts' : 'My Contacts'} ({filteredContacts.length})
              </h3>
              {contacts.length > 0 && (
                <button
                  onClick={() => exportToCSV(filteredContacts)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No contacts yet</p>
                <p className="text-gray-400 text-sm mb-4">Start by creating your first contact</p>
                <button
                  onClick={() => setActivePage('new-contact')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Create New Contact
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by name, company, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className={`grid grid-cols-1 ${currentUser.role === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Business Types</option>
                      <option value="apartments">Apartments</option>
                      <option value="airbnbs">Airbnbs</option>
                      <option value="hotels">Hotels</option>
                      <option value="cafe-restaurant">Cafe/Restaurant</option>
                    </select>

                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Priorities</option>
                      <option value="8-10">High Priority (8-10)</option>
                      <option value="5-7">Medium Priority (5-7)</option>
                      <option value="1-4">Low Priority (1-4)</option>
                    </select>

                    {currentUser.role === 'admin' && (
                      <select
                        value={filterSalesperson}
                        onChange={(e) => setFilterSalesperson(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Salespeople</option>
                        {[...new Set(contacts.map(c => c.salesPerson))].sort().map(person => (
                          <option key={person} value={person}>{person}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {filteredContacts.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">No contacts found</p>
                    <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredContacts.map((contact) => (
                      <div key={contact.id} className="border border-gray-200 rounded-lg">
                        <div 
                          className="p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedContact(expandedContact === contact.id ? null : contact.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-800">{contact.name}</h4>
                                {contact.products && contact.products.length > 0 && (
                                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                                    {contact.products.length} product{contact.products.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{contact.company}</p>
                              <p className="text-sm text-gray-500 mt-1">
                                {contact.businessType} • Priority: {contact.priority}/10
                              </p>
                              {contact.email && (
                                <p className="text-sm text-gray-600 mt-1">{contact.email}</p>
                              )}
                              {contact.phone && (
                                <p className="text-sm text-gray-600">{contact.phone}</p>
                              )}
                              {currentUser.role === 'admin' && (
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  By: {contact.salesPerson}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {expandedContact === contact.id ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {expandedContact === contact.id && (
                          <div className="border-t p-4 bg-gray-50">
                            <div className="flex gap-2 mb-4">
                              {(currentUser.role === 'admin' || contact.salesPerson === currentUser.email) && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditContact(contact);
                                    }}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteContact(contact.id);
                                    }}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  shareWithBackoffice(contact);
                                }}
                                className={`${currentUser.role === 'admin' || contact.salesPerson === currentUser.email ? 'flex-1' : 'w-full'} bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2`}
                              >
                                <Share2 className="w-4 h-4" />
                                Share
                              </button>
                            </div>

                            {contact.notes && (
                              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <h5 className="text-sm font-semibold text-gray-700 mb-1">Notes</h5>
                                <p className="text-sm text-gray-600">{contact.notes}</p>
                              </div>
                            )}

                            {contact.products && contact.products.length > 0 && (
                              <div className="mb-4">
                                <h5 className="text-sm font-semibold text-gray-700 mb-3">Products of Interest</h5>
                                <div className="space-y-2">
                                  {contact.products.map((product, idx) => (
                                    <div key={product.id} className="bg-white border border-gray-200 rounded p-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">
                                          {product.productType}
                                        </span>
                                        {product.pieces && (
                                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                                            Qty: {product.pieces}
                                          </span>
                                        )}
                                        {product.photos && product.photos.length > 0 && (
                                          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                            {product.photos.length} photo{product.photos.length > 1 ? 's' : ''}
                                          </span>
                                        )}
                                      </div>
                                      {product.productName ? (
                                        <p className="font-medium text-gray-800">{product.productName}</p>
                                      ) : (
                                        <p className="font-medium text-gray-500 italic">Photo only - name to be identified</p>
                                      )}
                                      {product.color && (
                                        <p className="text-sm text-gray-600">Color: {product.color}</p>
                                      )}
                                      {product.details && (
                                        <p className="text-sm text-gray-500 mt-1">{product.details}</p>
                                      )}
                                      {product.photos && product.photos.length > 0 && (
                                        <div className="mt-2 flex gap-1 flex-wrap">
                                          {product.photos.map((photo, photoIdx) => (
                                            <img key={photoIdx} src={photo} alt={`Product ${photoIdx + 1}`} className="w-20 h-20 object-cover rounded border border-gray-300" />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* New Contact Form */
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingContact ? 'Edit Contact' : 'New Contact'}
            </h2>
            
            {editingContact && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-yellow-800">Editing: {editingContact.name}</span>
                  <p className="text-xs text-yellow-600 mt-1">Make your changes and click "Update Contact" to save</p>
                </div>
                <button
                  onClick={() => {
                    setEditingContact(null);
                    setContactForm({
                      name: '',
                      priority: 5,
                      email: '',
                      phone: '',
                      company: '',
                      businessType: 'apartments',
                      products: [],
                      notes: '',
                      timestamp: '',
                      salesPerson: ''
                    });
                    showNotification('Edit cancelled', 'success');
                  }}
                  className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Quick Scan
              </h3>
              <button
                onClick={() => startCamera('card')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Scan Business Card
              </button>
              <p className="text-xs text-gray-600 mt-2 text-center">
                Take a photo of the business card, then fill in the details below
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    contactForm.name.trim() === '' && contactForm.name !== '' 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300'
                  }`}
                  placeholder="Required"
                />
                {contactForm.name.trim() === '' && contactForm.name !== '' && (
                  <p className="text-xs text-red-600 mt-1">Contact name cannot be empty</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Priority: {contactForm.priority}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={contactForm.priority}
                  onChange={(e) => setContactForm({...contactForm, priority: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Low (1)</span>
                  <span>High (10)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 ${
                      contactForm.email && !contactForm.email.includes('@')
                        ? 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="name@company.com"
                  />
                  {contactForm.email && !contactForm.email.includes('@') && (
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Please enter a valid email address
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telephone
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 ${
                      contactForm.phone && contactForm.phone.replace(/\D/g, '').length > 0 && contactForm.phone.replace(/\D/g, '').length !== 10
                        ? 'border-red-300 bg-red-50 focus:ring-red-500'
                        : contactForm.phone && contactForm.phone.replace(/\D/g, '').length === 10
                        ? 'border-green-300 bg-green-50 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="10 digits required"
                  />
                  {contactForm.phone && (
                    <div className="flex items-center gap-2 mt-1">
                      {contactForm.phone.replace(/\D/g, '').length === 10 ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : contactForm.phone.replace(/\D/g, '').length > 0 ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : null}
                      <p className={`text-xs ${
                        contactForm.phone.replace(/\D/g, '').length === 10 
                          ? 'text-green-600' 
                          : contactForm.phone.replace(/\D/g, '').length > 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                      }`}>
                        {contactForm.phone.replace(/\D/g, '').length} / 10 digits
                        {contactForm.phone.replace(/\D/g, '').length > 0 && contactForm.phone.replace(/\D/g, '').length !== 10 && 
                          ' - Must be exactly 10 digits'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Title
                </label>
                <input
                  type="text"
                  value={contactForm.company}
                  onChange={(e) => setContactForm({...contactForm, company: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Type
                </label>
                <select
                  value={contactForm.businessType}
                  onChange={(e) => setContactForm({...contactForm, businessType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="apartments">Apartments</option>
                  <option value="airbnbs">Airbnbs</option>
                  <option value="hotels">Hotels</option>
                  <option value="cafe-restaurant">Cafe/Restaurant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({...contactForm, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="General notes about the contact or conversation..."
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Products of Interest</h3>
                
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Type *
                    </label>
                    <select
                      value={productForm.productType}
                      onChange={(e) => setProductForm({...productForm, productType: e.target.value, customProductType: ''})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="chair">Chair</option>
                      <option value="armchair">Armchair</option>
                      <option value="sofa">Sofa</option>
                      <option value="table">Table</option>
                      <option value="side table">Side Table</option>
                      <option value="sunlounger">Sunlounger</option>
                      <option value="umbrella">Umbrella</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {productForm.productType === 'other' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom Product Type *
                      </label>
                      <input
                        type="text"
                        value={productForm.customProductType}
                        onChange={(e) => setProductForm({...productForm, customProductType: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter product type"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={productForm.productName}
                      onChange={(e) => setProductForm({...productForm, productName: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Model XL-200 (or take a photo)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter product name OR take a photo (at least one required)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Photo
                    </label>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
                    >
                      <Camera className="w-4 h-4" />
                      Take Product Photo
                    </button>
                    
                    {productForm.photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {productForm.photos.map((photo, idx) => (
                          <div key={idx} className="relative">
                            <img src={photo} alt={`Product ${idx + 1}`} className="w-full h-24 object-cover rounded border-2 border-indigo-200" />
                            <button
                              type="button"
                              onClick={() => removePhoto(idx)}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color
                    </label>
                    <input
                      type="text"
                      value={productForm.color}
                      onChange={(e) => setProductForm({...productForm, color: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Navy Blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pieces (Quantity)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={productForm.pieces}
                      onChange={(e) => setProductForm({...productForm, pieces: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Details
                    </label>
                    <textarea
                      value={productForm.details}
                      onChange={(e) => setProductForm({...productForm, details: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows="2"
                      placeholder="Additional notes or specifications"
                    />
                  </div>

                  <button
                    onClick={handleAddProductToContact}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                  >
                    {editingProduct !== null ? (
                      <>
                        <Save className="w-4 h-4" />
                        Update Product
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Product
                      </>
                    )}
                  </button>
                  
                  {editingProduct !== null && (
                    <button
                      onClick={() => {
                        setEditingProduct(null);
                        setProductForm({ 
                          productType: 'chair',
                          customProductType: '',
                          productName: '', 
                          color: '',
                          pieces: '',
                          details: '',
                          photos: []
                        });
                      }}
                      className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {contactForm.products.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Products Added ({contactForm.products.length})
                    </h4>
                    <div className="space-y-2">
                      {contactForm.products.map((product, idx) => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded p-3 flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">
                                {product.productType}
                              </span>
                              {product.pieces && (
                                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                                  Qty: {product.pieces}
                                </span>
                              )}
                              {product.photos && product.photos.length > 0 && (
                                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                  {product.photos.length} photo{product.photos.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            {product.productName ? (
                              <p className="font-medium text-gray-800">{product.productName}</p>
                            ) : (
                              <p className="font-medium text-gray-500 italic">Photo only - name to be identified</p>
                            )}
                            {product.color && (
                              <p className="text-sm text-gray-600">Color: {product.color}</p>
                            )}
                            {product.details && (
                              <p className="text-sm text-gray-500 mt-1">{product.details}</p>
                            )}
                            {product.photos && product.photos.length > 0 && (
                              <div className="mt-2 flex gap-1">
                                {product.photos.map((photo, photoIdx) => (
                                  <img key={photoIdx} src={photo} alt={`Product ${photoIdx + 1}`} className="w-16 h-16 object-cover rounded border border-gray-300" />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleEditProduct(idx)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(idx)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleContactSubmit}
                disabled={
                  !contactForm.name.trim() || 
                  (contactForm.phone && contactForm.phone.replace(/\D/g, '').length > 0 && contactForm.phone.replace(/\D/g, '').length !== 10)
                }
                className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  !contactForm.name.trim() || 
                  (contactForm.phone && contactForm.phone.replace(/\D/g, '').length > 0 && contactForm.phone.replace(/\D/g, '').length !== 10)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="w-4 h-4" />
                {editingContact ? 'Update Contact' : 'Save Contact'}
              </button>
              {(!contactForm.name.trim() || 
                (contactForm.phone && contactForm.phone.replace(/\D/g, '').length > 0 && contactForm.phone.replace(/\D/g, '').length !== 10)) && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Please fix validation errors before saving
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Take Product Photo</h3>
              <button
                onClick={stopCamera}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-indigo-800">
                Take a clear photo of the product. You can identify the product name later from the photo.
              </p>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg mb-4"
            />
            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={capturePhoto}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Capture Product Photo
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-red-100 rounded-full p-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Contact</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete <span className="font-semibold">"{deleteConfirm.name}"</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
