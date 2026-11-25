import { useState, useEffect, type FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { AuthApi } from '../services/api';

interface AdminAccountModalProps {
  open: boolean;
  onClose: () => void;
}

export const AdminAccountModal: FC<AdminAccountModalProps> = ({ open, onClose }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (open) {
      setErrorMsg('');
      setSuccessMsg('');
      setPassword('');
      setConfirmPassword('');
      setFetching(true);
      AuthApi.getAdminAccount()
        .then((res) => {
          if (res?.data?.username) {
            setUsername(res.data.username);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch admin account:', err);
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [open]);

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim()) {
      setErrorMsg('Store Admin username cannot be empty.');
      return;
    }

    if (password && password !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await AuthApi.updateAdminAccount({
        newUsername: username.trim(),
        newPassword: password.trim() ? password.trim() : undefined,
      });

      if (res.success) {
        setSuccessMsg('Store Admin username and password updated successfully!');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update store admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px',
            p: 1,
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1D4ED8',
            }}
          >
            <AdminPanelSettingsRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              Store Admin Credentials
            </Typography>
            <Typography sx={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
              Super Admin Privilege
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#94A3B8' }}>
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '10px !important' }}>
        {fetching ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography sx={{ fontSize: '12.5px', color: '#475569', mb: 0.5 }}>
              Change the login username and password used by store administrators.
            </Typography>

            {errorMsg && (
              <Alert severity="error" sx={{ fontSize: '12.5px', py: 0.5, borderRadius: '8px' }}>
                {errorMsg}
              </Alert>
            )}

            {successMsg && (
              <Alert severity="success" sx={{ fontSize: '12.5px', py: 0.5, borderRadius: '8px' }}>
                {successMsg}
              </Alert>
            )}

            <TextField
              label="Admin Username"
              size="small"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              helperText="Username used by Admin to sign in"
            />

            <TextField
              label="New Admin Password"
              size="small"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep existing password"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
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
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSave}
          disabled={loading || fetching}
          sx={{
            backgroundColor: '#1D4ED8',
            color: '#FFFFFF',
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '8px',
            px: 2.5,
            '&:hover': { backgroundColor: '#1E40AF' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Update Credentials'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
