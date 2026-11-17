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
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import { AuthApi } from '../services/api';

interface CustomerLoginModalProps {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
}

export const CustomerLoginModal: FC<CustomerLoginModalProps> = ({
  open,
  onClose,
  customerId,
  customerName,
  customerMobile,
}) => {
  const [isLoginEnabled, setIsLoginEnabled] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const cleanPhone = (customerMobile || '').replace(/[^0-9]/g, '');
  const defaultPass = cleanPhone.slice(-6) || '123456';

  useEffect(() => {
    if (open && customerId) {
      setErrorMsg('');
      setSuccessMsg('');
      setPassword('');
      setFetching(true);

      AuthApi.getCustomerLogin(customerId)
        .then((res) => {
          if (res?.data) {
            setIsLoginEnabled(Boolean(res.data.isLoginEnabled));
            if (!res.data.hasPassword) {
              setPassword(defaultPass);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to fetch customer login:', err);
          setPassword(defaultPass);
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [open, customerId, defaultPass]);

  const handleSave = async () => {
    if (!customerId) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (isLoginEnabled && !password.trim()) {
      setErrorMsg('Please provide a password for the customer login.');
      return;
    }

    try {
      setLoading(true);
      const res = await AuthApi.setCustomerLogin({
        customerId,
        password: password.trim() || undefined,
        isLoginEnabled,
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Customer login updated successfully!');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save customer login.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const rawMobile = (customerMobile || '').replace(/[^0-9]/g, '');
    const targetPhone = rawMobile.length === 10 ? `91${rawMobile}` : rawMobile;
    const currentDomain = window.location.origin;

    const message = `*GPK CRACKERS - CUSTOMER PORTAL ACCESS* 🔐
----------------------------------------
Hello *${customerName || 'Customer'}*,
Your account portal login has been created.

📱 *Login Mobile:* ${cleanPhone}
🔑 *Password:* ${password.trim() || defaultPass}
🌐 *Portal URL:* ${currentDomain}

_You can view your bills, ledger statement, and balance status._
*GPK Crackers Wholesale*`;

    const encoded = encodeURIComponent(message);
    const url = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
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
              backgroundColor: '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16A34A',
            }}
          >
            <VpnKeyRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              Customer Portal Login
            </Typography>
            <Typography sx={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
              Phone Number Login Access
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
            {/* Customer Details Box */}
            <Box
              sx={{
                p: 1.6,
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <Typography sx={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A' }}>
                {customerName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.5 }}>
                <PhoneIphoneRoundedIcon sx={{ fontSize: 16, color: '#0B4DB7' }} />
                <Typography sx={{ fontSize: '12.5px', color: '#0B4DB7', fontWeight: 700 }}>
                  Login Phone: {cleanPhone || 'No Phone Number'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.5 }}>
                Customer will use this phone number as their login username.
              </Typography>
            </Box>

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

            {/* Toggle Enable Login */}
            <FormControlLabel
              control={
                <Switch
                  checked={isLoginEnabled}
                  onChange={(e) => setIsLoginEnabled(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                    Allow Customer Login Access
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                    {isLoginEnabled ? 'Customer can log in to view their ledger' : 'Login access is disabled'}
                  </Typography>
                </Box>
              }
            />

            {isLoginEnabled && (
              <>
                <TextField
                  label="Login Password"
                  size="small"
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter login password"
                  helperText="Password for customer to access their account"
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

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label="Use Default (Last 6 digits)"
                    size="small"
                    onClick={() => setPassword(defaultPass)}
                    sx={{ cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  />
                  <Chip
                    label="Use '123456'"
                    size="small"
                    onClick={() => setPassword('123456')}
                    sx={{ cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  />
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="success"
          startIcon={<WhatsAppIcon sx={{ fontSize: 18 }} />}
          onClick={handleShareWhatsApp}
          disabled={!cleanPhone || !isLoginEnabled}
          sx={{
            borderColor: '#25D366',
            color: '#16A34A',
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '12px',
            borderRadius: '8px',
            '&:hover': { backgroundColor: '#F0FDF4', borderColor: '#16A34A' },
          }}
        >
          Share on WhatsApp
        </Button>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={loading} sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={loading || fetching}
            sx={{
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2.2,
              '&:hover': { backgroundColor: '#083B8D' },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Save Login'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
