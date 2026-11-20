import { useState, useEffect, type FC } from 'react';
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
  Chip,
} from '@mui/material';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { AuthApi, type AuthUser } from '../services/api';

interface SettingsPageProps {
  currentUser?: AuthUser | null;
  onSettingsUpdated?: () => void;
}

export const SettingsPage: FC<SettingsPageProps> = ({ currentUser, onSettingsUpdated }) => {
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

  // Fetch initial accounts
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

    if (newSuperAdminPass && newSuperAdminPass.length < 4) {
      setSuperAdminError('New password must be at least 4 characters long.');
      return;
    }

    if (newSuperAdminPass && newSuperAdminPass !== confirmSuperAdminPass) {
      setSuperAdminError('New password and confirmation password do not match.');
      return;
    }

    if (!newSuperAdminUser.trim() && !newSuperAdminPass) {
      setSuperAdminError('Please provide a new username or new password to update.');
      return;
    }

    try {
      setSuperAdminLoading(true);
      const res = await AuthApi.updateSuperAdminAccount({
        newUsername: newSuperAdminUser.trim() || undefined,
        newPassword: newSuperAdminPass || undefined,
      });

      if (res.success) {
        setSuperAdminSuccess('Super Admin credentials updated successfully!');
        if (newSuperAdminUser.trim()) {
          setCurrentSuperAdminUser(newSuperAdminUser.trim());
          setNewSuperAdminUser('');
        }
        setNewSuperAdminPass('');
        setConfirmSuperAdminPass('');
        onSettingsUpdated?.();
      } else {
        setSuperAdminError(res.message || 'Failed to update Super Admin credentials.');
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

    if (newAdminPass && newAdminPass.length < 4) {
      setAdminError('New password must be at least 4 characters long.');
      return;
    }

    if (newAdminPass && newAdminPass !== confirmAdminPass) {
      setAdminError('New password and confirmation password do not match.');
      return;
    }

    if (!newAdminUser.trim() && !newAdminPass) {
      setAdminError('Please provide a new username or new password to update.');
      return;
    }

    try {
      setAdminLoading(true);
      const res = await AuthApi.updateAdminAccount({
        newUsername: newAdminUser.trim() || undefined,
        newPassword: newAdminPass || undefined,
      });

      if (res.success) {
        setAdminSuccess('Store Admin credentials updated successfully!');
        if (newAdminUser.trim()) {
          setCurrentAdminUser(newAdminUser.trim());
          setNewAdminUser('');
        }
        setNewAdminPass('');
        setConfirmAdminPass('');
        onSettingsUpdated?.();
      } else {
        setAdminError(res.message || 'Failed to update Store Admin credentials.');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Failed to update Store Admin credentials.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Security gate: only Super Admin can access
  if (currentUser && currentUser.role !== 'superadmin') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          Access Restricted: Only the Super Administrator has permission to access Portal Settings.
        </Alert>
      </Box>
    );
  }

  if (pageLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} sx={{ color: '#1D4ED8' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <Box
        sx={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          borderRadius: '16px',
          p: { xs: 2.5, sm: 3.5 },
          mb: 3.5,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box
            sx={{
              background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
              color: '#FFFFFF',
              width: 50,
              height: 50,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            }}
          >
            <LockResetRoundedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Security & Credentials
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
            <Typography sx={{ fontSize: '13.5px', color: '#94A3B8' }}>
              Configure and manage Super Admin & Store Admin login usernames and passwords
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Credentials Cards Grid */}
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                  <ShieldRoundedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '16px', color: '#0F172A' }}>
                    Super Administrator Credentials
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#64748B' }}>
                    Root account with full system authority & settings control
                  </Typography>
                </Box>
              </Box>

              {superAdminSuccess && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
                  {superAdminSuccess}
                </Alert>
              )}
              {superAdminError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                  {superAdminError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Current Username"
                  size="small"
                  fullWidth
                  value={currentSuperAdminUser}
                  disabled
                  helperText="Active Super Admin login identifier"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: '#64748B' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  label="New Username (Optional)"
                  size="small"
                  fullWidth
                  value={newSuperAdminUser}
                  onChange={(e) => setNewSuperAdminUser(e.target.value)}
                  placeholder="Enter new username if changing"
                />

                <TextField
                  label="New Password"
                  size="small"
                  fullWidth
                  type={showSuperAdminPass ? 'text' : 'password'}
                  value={newSuperAdminPass}
                  onChange={(e) => setNewSuperAdminPass(e.target.value)}
                  placeholder="Enter new password"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowSuperAdminPass(!showSuperAdminPass)}
                            edge="end"
                          >
                            {showSuperAdminPass ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    backgroundColor: '#F0F9FF',
                    color: '#1D4ED8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TuneRoundedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '16px', color: '#0F172A' }}>
                    Store Administrator Credentials
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#64748B' }}>
                    Operational account for daily billing, performas & inventory
                  </Typography>
                </Box>
              </Box>

              {adminSuccess && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
                  {adminSuccess}
                </Alert>
              )}
              {adminError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                  {adminError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Current Store Admin Username"
                  size="small"
                  fullWidth
                  value={currentAdminUser}
                  disabled
                  helperText="Active Store Admin login identifier"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#16A34A' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  label="New Admin Username (Optional)"
                  size="small"
                  fullWidth
                  value={newAdminUser}
                  onChange={(e) => setNewAdminUser(e.target.value)}
                  placeholder="Enter new username if changing"
                />

                <TextField
                  label="New Admin Password"
                  size="small"
                  fullWidth
                  type={showAdminPass ? 'text' : 'password'}
                  value={newAdminPass}
                  onChange={(e) => setNewAdminPass(e.target.value)}
                  placeholder="Enter new password for Store Admin"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowAdminPass(!showAdminPass)}
                            edge="end"
                          >
                            {showAdminPass ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
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
                    background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
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
    </Box>
  );
};
