import { useState, useEffect, type FC, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  Paper,
} from '@mui/material';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { AuthApi, SettingsApi, type AuthUser } from '../services/api';

interface SettingsPageProps {
  currentUser?: AuthUser | null;
  onSettingsUpdated?: () => void;
}

export const SettingsPage: FC<SettingsPageProps> = ({ currentUser, onSettingsUpdated }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [pageLoading, setPageLoading] = useState<boolean>(true);

  // Super Admin Credentials State
  const [currentSuperAdminUser, setCurrentSuperAdminUser] = useState<string>('superadmin');
  const [newSuperAdminUser, setNewSuperAdminUser] = useState<string>('');
  const [newSuperAdminPass, setNewSuperAdminPass] = useState<string>('');
  const [confirmSuperAdminPass, setConfirmSuperAdminPass] = useState<string>('');
  const [showSuperAdminPass, setShowSuperAdminPass] = useState<boolean>(false);
  const [superAdminLoading, setSuperAdminLoading] = useState<boolean>(false);
  const [superAdminSuccess, setSuperAdminSuccess] = useState<string>('');
  const [superAdminError, setSuperAdminError] = useState<string>('');

  // Store Admin Credentials State
  const [currentAdminUser, setCurrentAdminUser] = useState<string>('admin');
  const [newAdminUser, setNewAdminUser] = useState<string>('');
  const [newAdminPass, setNewAdminPass] = useState<string>('');
  const [confirmAdminPass, setConfirmAdminPass] = useState<string>('');
  const [showAdminPass, setShowAdminPass] = useState<boolean>(false);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminSuccess, setAdminSuccess] = useState<string>('');
  const [adminError, setAdminError] = useState<string>('');

  // Branding & Business Settings State
  const [brandingLoading, setBrandingLoading] = useState<boolean>(false);
  const [brandingSuccess, setBrandingSuccess] = useState<string>('');
  const [brandingError, setBrandingError] = useState<string>('');

  const [companyName, setCompanyName] = useState<string>('GPK Crackers');
  const [tagline, setTagline] = useState<string>('Wholesales • Sivakasi');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('info@gpkcrackers.com');
  const [address, setAddress] = useState<string>('Sivakasi, Tamil Nadu');
  const [city, setCity] = useState<string>('Sivakasi');
  const [pincode, setPincode] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');

  // Invoicing & Banking State
  const [invoicingLoading, setInvoicingLoading] = useState<boolean>(false);
  const [invoicingSuccess, setInvoicingSuccess] = useState<string>('');
  const [invoicingError, setInvoicingError] = useState<string>('');

  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [billTerms, setBillTerms] = useState<string>(
    '1. Goods once sold cannot be taken back.\n2. Subject to Sivakasi Jurisdiction.'
  );

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState<boolean>(false);

  // Fetch initial settings & credentials
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        setPageLoading(true);
        // 1. Fetch Super Admin Account
        try {
          const resSuper = await AuthApi.getSuperAdminAccount();
          if (isMounted && resSuper?.data?.username) {
            setCurrentSuperAdminUser(resSuper.data.username);
          }
        } catch (e) {
          console.warn('Could not fetch superadmin account:', e);
        }

        // 2. Fetch Admin Account
        try {
          const resAdmin = await AuthApi.getAdminAccount();
          if (isMounted && resAdmin?.data?.username) {
            setCurrentAdminUser(resAdmin.data.username);
          }
        } catch (e) {
          console.warn('Could not fetch admin account:', e);
        }

        // 3. Fetch Settings
        try {
          const resSettings = await SettingsApi.get();
          if (isMounted && resSettings?.data) {
            const s = resSettings.data;
            if (s.companyName) setCompanyName(s.companyName);
            if (s.tagline) setTagline(s.tagline);
            if (s.logoUrl) setLogoUrl(s.logoUrl);
            if (s.phone) setPhone(s.phone);
            if (s.email) setEmail(s.email);
            if (s.address) setAddress(s.address);
            if (s.city) setCity(s.city);
            if (s.pincode) setPincode(s.pincode);
            if (s.gstin) setGstin(s.gstin);
            if (s.bankName) setBankName(s.bankName);
            if (s.accountNumber) setAccountNumber(s.accountNumber);
            if (s.ifscCode) setIfscCode(s.ifscCode);
            if (s.branchName) setBranchName(s.branchName);
            if (s.upiId) setUpiId(s.upiId);
            if (s.billTerms) setBillTerms(s.billTerms);
          }
        } catch (e) {
          console.warn('Could not fetch general settings:', e);
        }
      } finally {
        if (isMounted) setPageLoading(false);
      }
    };

    fetchAll();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update Super Admin Credentials
  const handleUpdateSuperAdmin = async () => {
    setSuperAdminError('');
    setSuperAdminSuccess('');

    if (!newSuperAdminUser.trim() && !newSuperAdminPass.trim()) {
      setSuperAdminError('Please enter a new username or new password to update.');
      return;
    }

    if (newSuperAdminPass.trim() && newSuperAdminPass.trim().length < 4) {
      setSuperAdminError('Password must be at least 4 characters long.');
      return;
    }

    if (newSuperAdminPass.trim() && newSuperAdminPass.trim() !== confirmSuperAdminPass.trim()) {
      setSuperAdminError('New password and confirm password do not match.');
      return;
    }

    try {
      setSuperAdminLoading(true);
      const res = await AuthApi.updateSuperAdminAccount({
        newUsername: newSuperAdminUser.trim() || undefined,
        newPassword: newSuperAdminPass.trim() || undefined,
      });

      if (res && res.success) {
        setSuperAdminSuccess('Super Admin credentials updated successfully!');
        if (res.data?.username) {
          setCurrentSuperAdminUser(res.data.username);
        }
        setNewSuperAdminUser('');
        setNewSuperAdminPass('');
        setConfirmSuperAdminPass('');
        setTimeout(() => setSuperAdminSuccess(''), 4000);
      }
    } catch (err: any) {
      setSuperAdminError(err.message || 'Failed to update Super Admin credentials.');
    } finally {
      setSuperAdminLoading(false);
    }
  };

  // Update Store Admin Credentials
  const handleUpdateAdmin = async () => {
    setAdminError('');
    setAdminSuccess('');

    if (!newAdminUser.trim() && !newAdminPass.trim()) {
      setAdminError('Please enter a new username or new password to update.');
      return;
    }

    if (newAdminPass.trim() && newAdminPass.trim().length < 4) {
      setAdminError('Password must be at least 4 characters long.');
      return;
    }

    if (newAdminPass.trim() && newAdminPass.trim() !== confirmAdminPass.trim()) {
      setAdminError('New password and confirm password do not match.');
      return;
    }

    try {
      setAdminLoading(true);
      const res = await AuthApi.updateAdminAccount({
        newUsername: newAdminUser.trim() || undefined,
        newPassword: newAdminPass.trim() || undefined,
      });

      if (res && res.success) {
        setAdminSuccess('Store Admin credentials updated successfully!');
        if (res.data?.username) {
          setCurrentAdminUser(res.data.username);
        }
        setNewAdminUser('');
        setNewAdminPass('');
        setConfirmAdminPass('');
        setTimeout(() => setAdminSuccess(''), 4000);
      }
    } catch (err: any) {
      setAdminError(err.message || 'Failed to update Store Admin credentials.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Handle Logo Upload File Selection
  const handleLogoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBrandingError('Image file size must be less than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        setLogoUploading(true);
        setBrandingError('');
        const res = await SettingsApi.uploadLogo(base64Data);
        if (res && res.success && res.data?.logoUrl) {
          setLogoUrl(res.data.logoUrl);
          setBrandingSuccess('Logo uploaded and saved successfully!');
          localStorage.setItem('gpk_custom_logo', res.data.logoUrl);
          if (onSettingsUpdated) onSettingsUpdated();
          setTimeout(() => setBrandingSuccess(''), 3000);
        }
      } catch (err: any) {
        setBrandingError(err.message || 'Failed to upload logo.');
      } finally {
        setLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Remove Custom Logo
  const handleRemoveLogo = async () => {
    try {
      setLogoUploading(true);
      await SettingsApi.update({ logoUrl: '' });
      setLogoUrl('');
      localStorage.removeItem('gpk_custom_logo');
      setBrandingSuccess('Logo removed. System will use default GPK branding badge.');
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setBrandingSuccess(''), 3000);
    } catch (err: any) {
      setBrandingError(err.message || 'Failed to remove logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Save Branding & Business Info
  const handleSaveBranding = async () => {
    setBrandingError('');
    setBrandingSuccess('');

    try {
      setBrandingLoading(true);
      const res = await SettingsApi.update({
        companyName: companyName.trim(),
        tagline: tagline.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        gstin: gstin.trim(),
      });

      if (res && res.success) {
        setBrandingSuccess('Business & Branding details saved successfully!');
        localStorage.setItem('gpk_company_name', companyName.trim());
        if (onSettingsUpdated) onSettingsUpdated();
        setTimeout(() => setBrandingSuccess(''), 4000);
      }
    } catch (err: any) {
      setBrandingError(err.message || 'Failed to save business settings.');
    } finally {
      setBrandingLoading(false);
    }
  };

  // Save Invoicing & Banking Details
  const handleSaveInvoicing = async () => {
    setInvoicingError('');
    setInvoicingSuccess('');

    try {
      setInvoicingLoading(true);
      const res = await SettingsApi.update({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim(),
        branchName: branchName.trim(),
        upiId: upiId.trim(),
        billTerms: billTerms.trim(),
      });

      if (res && res.success) {
        setInvoicingSuccess('Invoicing & Banking details saved successfully!');
        if (onSettingsUpdated) onSettingsUpdated();
        setTimeout(() => setInvoicingSuccess(''), 4000);
      }
    } catch (err: any) {
      setInvoicingError(err.message || 'Failed to save banking settings.');
    } finally {
      setInvoicingLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} sx={{ color: '#0B4DB7' }} />
      </Box>
    );
  }

  // Security gate: only Super Admin can access
  if (currentUser && currentUser.role !== 'superadmin') {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', textAlign: 'center', mt: 8 }}>
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
          Access Restricted: Only Super Administrator can view and configure portal settings.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header Banner */}
      <Box
        sx={{
          mb: 3,
          p: 3,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.12)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              backgroundColor: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
            }}
          >
            <TuneRoundedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.3 }}>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                System & Portal Settings
              </Typography>
              <Chip
                icon={<ShieldRoundedIcon sx={{ fontSize: '14px !important', color: '#FFFFFF !important' }} />}
                label="Super Admin Only"
                size="small"
                sx={{
                  backgroundColor: 'rgba(220, 38, 38, 0.85)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '11px',
                  height: '22px',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>
              Configure Super Admin & Store Admin credentials, company branding, logo upload, and invoice details
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Settings Navigation Tabs */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          mb: 3,
          backgroundColor: '#FFFFFF',
          px: 1,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13.5px',
              minHeight: 48,
              color: '#64748B',
              '&.Mui-selected': {
                color: '#0B4DB7',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#0B4DB7',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<LockResetRoundedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Security & Credentials"
          />
          <Tab
            icon={<StoreRoundedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Branding & Logo Upload"
          />
          <Tab
            icon={<AccountBalanceRoundedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Invoicing & Payments"
          />
        </Tabs>
      </Paper>

      {/* TAB 0: SECURITY & CREDENTIALS */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Card 1: Super Admin Credentials */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                height: '100%',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldRoundedIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Super Administrator Credentials
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                      Full owner access to all financial totals and system configuration
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2.5, p: 1.5, backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <Typography sx={{ fontSize: '12px', color: '#64748B' }}>Current Username:</Typography>
                  <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#DC2626' }}>
                    {currentSuperAdminUser}
                  </Typography>
                </Box>

                {superAdminError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {superAdminError}
                  </Alert>
                )}

                {superAdminSuccess && (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {superAdminSuccess}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Change Super Admin Username"
                    size="small"
                    fullWidth
                    value={newSuperAdminUser}
                    onChange={(e) => setNewSuperAdminUser(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />

                  <TextField
                    label="New Password"
                    size="small"
                    fullWidth
                    type={showSuperAdminPass ? 'text' : 'password'}
                    value={newSuperAdminPass}
                    onChange={(e) => setNewSuperAdminPass(e.target.value)}
                    placeholder="Enter at least 4 characters"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setShowSuperAdminPass(!showSuperAdminPass)}
                              edge="end"
                              sx={{ color: '#94A3B8' }}
                            >
                              {showSuperAdminPass ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <TextField
                    label="Confirm New Password"
                    size="small"
                    fullWidth
                    type={showSuperAdminPass ? 'text' : 'password'}
                    value={confirmSuperAdminPass}
                    onChange={(e) => setConfirmSuperAdminPass(e.target.value)}
                    placeholder="Re-enter new password"
                  />

                  <Button
                    variant="contained"
                    onClick={handleUpdateSuperAdmin}
                    disabled={superAdminLoading}
                    startIcon={superAdminLoading ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                    sx={{
                      mt: 1,
                      backgroundColor: '#DC2626',
                      '&:hover': { backgroundColor: '#B91C1C' },
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'none',
                      py: 1,
                    }}
                  >
                    {superAdminLoading ? 'Saving...' : 'Update Super Admin Credentials'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Store Admin Credentials */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                height: '100%',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      backgroundColor: '#EFF6FF',
                      color: '#0B4DB7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AdminPanelSettingsRoundedIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Store Administrator Credentials
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                      Manage daily billing, customers, performas (revenue totals hidden)
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2.5, p: 1.5, backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <Typography sx={{ fontSize: '12px', color: '#64748B' }}>Current Username:</Typography>
                  <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0B4DB7' }}>
                    {currentAdminUser}
                  </Typography>
                </Box>

                {adminError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {adminError}
                  </Alert>
                )}

                {adminSuccess && (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {adminSuccess}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Change Admin Username"
                    size="small"
                    fullWidth
                    value={newAdminUser}
                    onChange={(e) => setNewAdminUser(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />

                  <TextField
                    label="New Password"
                    size="small"
                    fullWidth
                    type={showAdminPass ? 'text' : 'password'}
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    placeholder="Enter at least 4 characters"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setShowAdminPass(!showAdminPass)}
                              edge="end"
                              sx={{ color: '#94A3B8' }}
                            >
                              {showAdminPass ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <TextField
                    label="Confirm New Password"
                    size="small"
                    fullWidth
                    type={showAdminPass ? 'text' : 'password'}
                    value={confirmAdminPass}
                    onChange={(e) => setConfirmAdminPass(e.target.value)}
                    placeholder="Re-enter new password"
                  />

                  <Button
                    variant="contained"
                    onClick={handleUpdateAdmin}
                    disabled={adminLoading}
                    startIcon={adminLoading ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                    sx={{
                      mt: 1,
                      backgroundColor: '#0B4DB7',
                      '&:hover': { backgroundColor: '#093E94' },
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'none',
                      py: 1,
                    }}
                  >
                    {adminLoading ? 'Saving...' : 'Update Store Admin Credentials'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* TAB 1: BRANDING & LOGO UPLOAD */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Logo Upload Card */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                height: '100%',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
                  Portal Logo
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#64748B', mb: 3 }}>
                  Displayed on top navbar, login page, and PDF invoices
                </Typography>

                {/* Preview Box */}
                <Box
                  sx={{
                    width: '100%',
                    height: 140,
                    borderRadius: '12px',
                    border: '2px dashed #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    mb: 2.5,
                    overflow: 'hidden',
                  }}
                >
                  {logoUrl ? (
                    <Box
                      component="img"
                      src={logoUrl}
                      alt="Portal Logo"
                      sx={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                          color: '#FFFFFF',
                          fontWeight: 900,
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 1,
                        }}
                      >
                        GPK
                      </Box>
                      <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>
                        Default GPK Badge in use
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Upload Button */}
                <Button
                  component="label"
                  variant="outlined"
                  fullWidth
                  disabled={logoUploading}
                  startIcon={logoUploading ? <CircularProgress size={16} /> : <CloudUploadRoundedIcon />}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: '#0B4DB7',
                    color: '#0B4DB7',
                    py: 1,
                    mb: 1,
                  }}
                >
                  {logoUploading ? 'Uploading...' : 'Upload New Logo'}
                  <input
                    type="file"
                    hidden
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                    onChange={handleLogoFileChange}
                  />
                </Button>

                {logoUrl && (
                  <Button
                    variant="text"
                    color="error"
                    size="small"
                    onClick={handleRemoveLogo}
                    disabled={logoUploading}
                    startIcon={<DeleteOutlineRoundedIcon />}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                  >
                    Reset to Default Logo
                  </Button>
                )}

                <Typography sx={{ fontSize: '11px', color: '#94A3B8', mt: 2 }}>
                  Recommended: Transparent PNG or SVG. Max file size: 5MB.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Business Profile Details */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
                  Business & Store Details
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#64748B', mb: 3 }}>
                  Store details printed on bill header and WhatsApp receipts
                </Typography>

                {brandingError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {brandingError}
                  </Alert>
                )}

                {brandingSuccess && (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {brandingSuccess}
                  </Alert>
                )}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Company / Store Name"
                      size="small"
                      fullWidth
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. GPK Crackers"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Tagline / Subtitle"
                      size="small"
                      fullWidth
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="e.g. Wholesales • Sivakasi"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Contact Mobile / Phone"
                      size="small"
                      fullWidth
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Official Email"
                      size="small"
                      fullWidth
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. info@gpkcrackers.com"
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Store / Business Address"
                      size="small"
                      fullWidth
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 123 Main Road, Sivakasi, Tamil Nadu"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="City"
                      size="small"
                      fullWidth
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Sivakasi"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Pincode"
                      size="small"
                      fullWidth
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 626123"
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="GSTIN / Tax ID"
                      size="small"
                      fullWidth
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="e.g. 33AAAAA0000A1Z5"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveBranding}
                    disabled={brandingLoading}
                    startIcon={brandingLoading ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      '&:hover': { backgroundColor: '#093E94' },
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'none',
                      px: 3,
                      py: 1,
                    }}
                  >
                    {brandingLoading ? 'Saving...' : 'Save Business Details'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* TAB 2: INVOICING & BANKING */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {/* Bank Account Details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                height: '100%',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AccountBalanceRoundedIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Bank Account Details
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                      Printed on customer performa and bills for wire transfers
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Bank Name"
                    size="small"
                    fullWidth
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India / HDFC"
                  />

                  <TextField
                    label="Account Number"
                    size="small"
                    fullWidth
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 123456789012"
                  />

                  <TextField
                    label="IFSC Code"
                    size="small"
                    fullWidth
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="e.g. SBIN0001234"
                  />

                  <TextField
                    label="Branch Name"
                    size="small"
                    fullWidth
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Sivakasi Main Branch"
                  />

                  <TextField
                    label="UPI ID / VPA"
                    size="small"
                    fullWidth
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. gpkcrackers@okaxis"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Terms & Conditions */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      backgroundColor: '#EFF6FF',
                      color: '#0B4DB7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircleRoundedIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Invoice Terms & Notes
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                      Default declaration printed at bottom of every bill
                    </Typography>
                  </Box>
                </Box>

                {invoicingError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {invoicingError}
                  </Alert>
                )}

                {invoicingSuccess && (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
                    {invoicingSuccess}
                  </Alert>
                )}

                <TextField
                  label="Terms & Conditions"
                  multiline
                  rows={6}
                  fullWidth
                  value={billTerms}
                  onChange={(e) => setBillTerms(e.target.value)}
                  placeholder="1. Goods once sold cannot be taken back..."
                  sx={{ mb: 2 }}
                />

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveInvoicing}
                    disabled={invoicingLoading}
                    startIcon={invoicingLoading ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      '&:hover': { backgroundColor: '#093E94' },
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'none',
                      px: 3,
                      py: 1,
                    }}
                  >
                    {invoicingLoading ? 'Saving...' : 'Save Invoicing & Banking Details'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
