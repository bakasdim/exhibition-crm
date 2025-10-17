import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// ⚠️ REPLACE THESE WITH YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://xgpzjkjcqohebsiyofol.supabase.co';  // e.g., https://abcdefghijk.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncHpqa2pjcW9oZWJzaXlvZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzQ1MDYsImV4cCI6MjA3NjExMDUwNn0.Dlm26WcwP8vu01XlrQ15owcpt3fkhfS0U5R43cUFsgA';  // The long "anon public" key

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    businessType: '',
    priority: 5,
    notes: '',
    products: ''
  });
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Load contacts from Supabase - wrapped in useCallback to avoid dependency issues
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('sales_person', currentUser)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      alert('Failed to load contacts: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Load contacts when user logs in
  useEffect(() => {
    if (currentView === 'dashboard') {
      loadContacts();
    }
  }, [currentView, loadContacts]);

  // Handle login
  const handleLogin = (e) => {
    e.preventDefault();
    const name = e.target.username.value.trim();
    if (name) {
      setCurrentUser(name);
      setCurrentView('dashboard');
    }
  };

  // Handle logout
  const handleLogout = () => {
    setCurrentUser('');
    setCurrentView('login');
    setContacts([]);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setShowCamera(true);
    } catch (error) {
      console.error('Camera error:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  // Capture photo
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
        setCapturedPhoto(url);
        setPhotoFile(blob);
        stopCamera();
      }, 'image/jpeg', 0.95);
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoFile(null);
    startCamera();
  };

  // Upload photo to Supabase Storage
  const uploadPhoto = async (contactId) => {
    if (!photoFile) return null;

    try {
      const fileName = `${contactId}_${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('product-photos')
        .upload(fileName, photoFile, {
          contentType: 'image/jpeg'
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-photos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Photo upload error:', error);
      return null;
    }
  };

  // Save contact
  const saveContact = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a contact name');
      return;
    }

    setLoading(true);
    try {
      // Create contact record
      const contactData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        business_type: formData.businessType,
        priority: parseInt(formData.priority),
        notes: formData.notes,
        products: formData.products,
        sales_person: currentUser
      };

      const { data, error } = await supabase
        .from('contacts')
        .insert([contactData])
        .select()
        .single();

      if (error) throw error;

      // Upload photo if exists
      if (photoFile && data) {
        const photoUrl = await uploadPhoto(data.id);
        if (photoUrl) {
          // Update contact with photo URL
          await supabase
            .from('contacts')
            .update({ photo_url: photoUrl })
            .eq('id', data.id);
        }
      }

      alert('Contact saved successfully!');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        businessType: '',
        priority: 5,
        notes: '',
        products: ''
      });
      setCapturedPhoto(null);
      setPhotoFile(null);
      
      setCurrentView('dashboard');
      await loadContacts();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save contact: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete contact
  const deleteContact = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Contact deleted successfully!');
      await loadContacts();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete contact: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Render login screen
  if (currentView === 'login') {
    return (
      <div className="app">
        <div className="login-container">
          <h1>🎪 Exhibition CRM</h1>
          <p>Sales Contact Tracker</p>
          <form onSubmit={handleLogin} className="login-form">
            <input
              type="text"
              name="username"
              placeholder="Enter your name"
              className="login-input"
              required
            />
            <button type="submit" className="login-button">
              Start Tracking
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render add contact form
  if (currentView === 'addContact') {
    return (
      <div className="app">
        <header className="header">
          <button onClick={() => setCurrentView('dashboard')} className="back-button">
            ← Back
          </button>
          <h1>Add New Contact</h1>
          <span className="user-badge">{currentUser}</span>
        </header>

        <form onSubmit={saveContact} className="contact-form">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Company</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Business Type</label>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleInputChange}
            >
              <option value="">Select type...</option>
              <option value="Retailer">Retailer</option>
              <option value="Distributor">Distributor</option>
              <option value="Manufacturer">Manufacturer</option>
              <option value="Designer">Designer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Priority: {formData.priority}</label>
            <input
              type="range"
              name="priority"
              min="1"
              max="10"
              value={formData.priority}
              onChange={handleInputChange}
              className="priority-slider"
            />
            <div className="priority-labels">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div className="form-group">
            <label>Products Interested In</label>
            <input
              type="text"
              name="products"
              value={formData.products}
              onChange={handleInputChange}
              placeholder="e.g., Chairs, Tables"
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
              placeholder="Any additional information..."
            />
          </div>

          <div className="form-group">
            <label>Product Photo</label>
            {!showCamera && !capturedPhoto && (
              <button
                type="button"
                onClick={startCamera}
                className="camera-button"
              >
                📷 Take Photo
              </button>
            )}

            {showCamera && (
              <div className="camera-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="camera-preview"
                />
                <div className="camera-controls">
                  <button type="button" onClick={capturePhoto} className="capture-button">
                    📸 Capture
                  </button>
                  <button type="button" onClick={stopCamera} className="cancel-button">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {capturedPhoto && (
              <div className="photo-preview">
                <img src={capturedPhoto} alt="Captured" />
                <button type="button" onClick={retakePhoto} className="retake-button">
                  🔄 Retake
                </button>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <button type="submit" className="save-button" disabled={loading}>
            {loading ? 'Saving...' : '💾 Save Contact'}
          </button>
        </form>
      </div>
    );
  }

  // Render dashboard
  return (
    <div className="app">
      <header className="header">
        <h1>📋 My Contacts</h1>
        <div className="header-actions">
          <span className="user-badge">{currentUser}</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard">
        <button
          onClick={() => setCurrentView('addContact')}
          className="add-contact-button"
        >
          + Add New Contact
        </button>

        {loading && <p>Loading...</p>}

        {!loading && contacts.length === 0 && (
          <div className="empty-state">
            <p>No contacts yet. Start adding contacts from the exhibition!</p>
          </div>
        )}

        <div className="contacts-grid">
          {contacts.map(contact => (
            <div key={contact.id} className="contact-card">
              <div className="contact-header">
                <h3>{contact.name}</h3>
                <span className={`priority-badge priority-${contact.priority}`}>
                  Priority: {contact.priority}
                </span>
              </div>

              {contact.photo_url && (
                <img src={contact.photo_url} alt={contact.name} className="contact-photo" />
              )}

              <div className="contact-details">
                {contact.company && <p><strong>Company:</strong> {contact.company}</p>}
                {contact.email && <p><strong>Email:</strong> {contact.email}</p>}
                {contact.phone && <p><strong>Phone:</strong> {contact.phone}</p>}
                {contact.business_type && <p><strong>Type:</strong> {contact.business_type}</p>}
                {contact.products && <p><strong>Interested in:</strong> {contact.products}</p>}
                {contact.notes && <p><strong>Notes:</strong> {contact.notes}</p>}
              </div>

              <div className="contact-footer">
                <small>{new Date(contact.created_at).toLocaleDateString()}</small>
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="delete-button"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
