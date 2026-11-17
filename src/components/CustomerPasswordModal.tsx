import { useState, type FC } from 'react';
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
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import { AuthApi } from '../services/api';

interface CustomerPasswordModalProps {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  mobile?: string;
}

export const CustomerPasswordModal: FC<CustomerPasswordModalProps> = ({
  open,
  onClose,
  customerId,
  customerName,
  mobile,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleClose = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword.trim()) {
      setErrorMsg('Please enter a new password.');
      return;
    }

    if (newPassword.trim().length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    if (!customerId) {
      setErrorMsg('Customer ID is missing. Please re-login and try again.');
      return;
    }

    try {
      setLoading(true);
      const res = await AuthApi.customerChangePassword({
        customerId,
        newPassword: newPassword.trim(),
      });

      if (res && res.success) {
        setSuccessMsg(res.message || 'Password saved successfully! You can use this password to log in next time.');
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '16px',
            p: 1,
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.15)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          pt: 1.5,
          px: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              color: '#0B4DB7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockResetRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              Set Login Password
            </Typography>
            <Typography sx={{ fontSize: '11.5px', color: '#64748B' }}>
              Choose a secure password for your portal
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ color: '#94A3B8' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 1.5 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
            {errorMsg}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px' }}>
            {successMsg}
          </Alert>
        )}

        <Box sx={{ p: 1.5, mb: 2, backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
            Account: <strong style={{ color: '#0F172A' }}>{customerName || 'Customer'}</strong>
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 500, mt: 0.3 }}>
            Login Mobile: <strong style={{ color: '#0B4DB7' }}>{mobile || 'Registered Phone'}</strong>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="New Password"
            size="small"
            fullWidth
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter at least 4 characters"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: '#94A3B8' }}
                    >
                      {showPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
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
            placeholder="Re-enter password to confirm"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleClose}
          disabled={loading}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            borderColor: '#CBD5E1',
            color: '#475569',
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          disableElevation
          onClick={handleSave}
          disabled={loading}
          startIcon={loading && <CircularProgress size={16} color="inherit" />}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 700,
            backgroundColor: '#0B4DB7',
            '&:hover': { backgroundColor: '#083B8D' },
          }}
        >
          {loading ? 'Saving...' : 'Save Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
