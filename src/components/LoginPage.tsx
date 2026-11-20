import { useState, type FC, type FormEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { AuthApi, type AuthUser } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await AuthApi.login({
        username: username.trim(),
        password: password.trim(),
      });

      if (res && res.token) {
        localStorage.setItem('gpk_auth_token', res.token);
        localStorage.setItem('gpk_auth_user', JSON.stringify(res.user));
        // Keep fallback keys for migration
        localStorage.setItem('dheeksha_auth_token', res.token);
        localStorage.setItem('dheeksha_auth_user', JSON.stringify(res.user));

        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const u = username.trim().toLowerCase();
      const p = password.trim();

      // Only allow emergency offline bypass for superadmin if backend server is completely unreachable
      const isNetworkError = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (
        isNetworkError &&
        ((u === 'superadmin' && (p === 'superadmin123' || p === 'gpk123')) ||
         (u === 'gpk' && p === 'gpk123'))
      ) {
        const user: AuthUser = { username: 'superadmin', role: 'superadmin' };
        localStorage.setItem('gpk_auth_token', 'local-superadmin-token');
        localStorage.setItem('gpk_auth_user', JSON.stringify(user));
        onLoginSuccess(user);
      } else {
        setErrorMsg(
          err.message || 'Invalid username or password. Please verify your credentials.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 50%, #1E293B 0%, #0F172A 60%, #020617 100%)',
        p: 2.5,
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          p: { xs: 3, sm: '40px 36px 30px 36px' },
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.05)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Top Logo Badge */}
        <Box
          sx={{
            width: 58,
            height: 58,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #CA8A04 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.2,
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: '18px',
            letterSpacing: '0.04em',
          }}
        >
          GPK
        </Box>

        {/* Brand Heading */}
        <Typography
          variant="h1"
          sx={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            mb: 0.5,
          }}
        >
          GPK Crackers
        </Typography>

        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: '13.5px',
            fontWeight: 500,
            color: '#64748B',
            textAlign: 'center',
            letterSpacing: '-0.01em',
            mb: 3.5,
          }}
        >
          Wholesale & Retail Billing Portal
        </Typography>

        {/* Error Alert if any */}
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', fontSize: '13px', py: 0.5 }}>
            {errorMsg}
          </Alert>
        )}

        {/* Username / Mobile Field */}
        <Box sx={{ mb: 2.4 }}>
          <Typography
            component="label"
            htmlFor="username-input"
            sx={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              mb: 0.8,
              letterSpacing: '-0.01em',
            }}
          >
            Username or Mobile Number
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
              px: 1.6,
              height: '46px',
              gap: 1.2,
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#CBD5E1',
              },
              '&:focus-within': {
                borderColor: '#047857',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 0 2px rgba(4, 120, 87, 0.12)',
              },
            }}
          >
            <PersonOutlineRoundedIcon
              sx={{
                color: '#94A3B8',
                fontSize: 19,
                flexShrink: 0,
              }}
            />
            <InputBase
              id="username-input"
              fullWidth
              placeholder="Enter username or mobile number"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#0F172A',
                '& input': {
                  p: 0,
                  '&::placeholder': {
                    color: '#94A3B8',
                    opacity: 1,
                  },
                },
              }}
            />
          </Box>
        </Box>

        {/* Password Field */}
        <Box sx={{ mb: 3.2 }}>
          <Typography
            component="label"
            htmlFor="password-input"
            sx={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              mb: 0.8,
              letterSpacing: '-0.01em',
            }}
          >
            Password
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
              px: 1.6,
              height: '46px',
              gap: 1.2,
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#CBD5E1',
              },
              '&:focus-within': {
                borderColor: '#047857',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 0 2px rgba(4, 120, 87, 0.12)',
              },
            }}
          >
            <LockOutlinedIcon
              sx={{
                color: '#94A3B8',
                fontSize: 19,
                flexShrink: 0,
              }}
            />

            <InputBase
              id="password-input"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#0F172A',
                '& input': {
                  p: 0,
                  letterSpacing: showPassword ? 'normal' : '0.15em',
                  '&::placeholder': {
                    color: '#94A3B8',
                    opacity: 1,
                    letterSpacing: 'normal',
                  },
                },
              }}
            />

            <IconButton
              size="small"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              sx={{
                color: '#94A3B8',
                p: 0.5,
                '&:hover': {
                  color: '#475569',
                },
              }}
            >
              {showPassword ? (
                <VisibilityOffOutlinedIcon sx={{ fontSize: 19 }} />
              ) : (
                <VisibilityOutlinedIcon sx={{ fontSize: 19 }} />
              )}
            </IconButton>
          </Box>
        </Box>

        {/* Login Button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disableElevation
          disabled={loading}
          endIcon={!loading && <ArrowForwardRoundedIcon sx={{ fontSize: '18px !important' }} />}
          sx={{
            backgroundColor: '#047857',
            color: '#FFFFFF',
            height: '46px',
            borderRadius: '9px',
            fontSize: '14.5px',
            fontWeight: 700,
            textTransform: 'none',
            letterSpacing: '-0.01em',
            boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor: '#064E3B',
            },
            '&.Mui-disabled': {
              backgroundColor: '#CBD5E1',
              color: '#FFFFFF',
            },
          }}
        >
          {loading ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Login'}
        </Button>

        {/* Bottom subtle divider line */}
        <Box
          sx={{
            mt: 3.5,
            borderTop: '1px solid #F1F5F9',
            pt: 1.5,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
            GPK Crackers Billing & Management System
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
