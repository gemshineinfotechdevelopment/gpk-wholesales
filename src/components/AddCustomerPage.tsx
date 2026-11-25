import { useState, type FC, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  CircularProgress,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { CustomersApi } from '../services/api';
import { INDIAN_STATES, TAX_ID_TYPES } from '../utils/indianStates';

interface AddCustomerPageProps {
  onCancel?: () => void;
  onSubmitSuccess?: () => void;
}

export const AddCustomerPage: FC<AddCustomerPageProps> = ({
  onCancel,
  onSubmitSuccess,
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    taxIdType: 'GSTIN' as 'GSTIN' | 'PAN' | 'Aadhaar',
    taxIdNumber: '',
    state: '',
    billingAddress: '',
  });
  const [loading, setLoading] = useState(false);

  const currentTaxType = TAX_ID_TYPES.find((t) => t.value === formData.taxIdType) || TAX_ID_TYPES[0];

  const handleChange = (field: string) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      alert('Customer / Business Name is mandatory.');
      return;
    }

    const rawMobile = formData.mobileNumber.replace(/\D/g, '');
    const cleanMobile = rawMobile.length > 10 ? rawMobile.slice(-10) : rawMobile;
    if (!cleanMobile || cleanMobile.length < 10) {
      alert('Please enter a valid 10-digit mobile number for customer registration.');
      return;
    }

    try {
      setLoading(true);

      const cleanTaxNumber = formData.taxIdNumber.trim();
      const taxType = formData.taxIdType || 'GSTIN';

      await CustomersApi.create({
        name: formData.fullName.trim(),
        mobile: cleanMobile,
        gst: cleanTaxNumber || 'N/A',
        taxIdType: taxType,
        taxIdNumber: cleanTaxNumber,
        state: formData.state.trim(),
        address: formData.billingAddress.trim(),
        avatarLetter: formData.fullName.trim().charAt(0).toUpperCase(),
        avatarBg: '#BAE6FD',
        avatarColor: '#1D4ED8',
        isLoginEnabled: true,
        password: cleanMobile, // Initial password is their registered phone number
      });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      const errorMsg =
        err?.message ||
        'Error creating customer. Please check your backend connection or mobile number.';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      {/* Page Title & Subtitle */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            mb: 0.8,
          }}
        >
          Add New Customer
        </Typography>
        <Typography
          sx={{
            fontSize: '14px',
            color: '#64748B',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          Enter the details below to register a new client profile into the GPK Crackers platform.
        </Typography>
      </Box>

      {/* Main Form Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EEF2F6',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
          p: { xs: 2.5, sm: 3.5, md: 4 },
          boxSizing: 'border-box',
        }}
      >
        <Box component="form" noValidate autoComplete="off">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {/* Full Name Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Full Name / Business Name *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#1D4ED8',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. Acme Corporation"
                  value={formData.fullName}
                  onChange={handleChange('fullName')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Mobile Number Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Mobile Number *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#1D4ED8',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="Enter 10-digit mobile number"
                  value={formData.mobileNumber}
                  onChange={handleChange('mobileNumber')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Tax ID / Document Type Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Tax / ID Proof Type
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#1D4ED8',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                  },
                }}
              >
                <Select
                  fullWidth
                  variant="standard"
                  disableUnderline
                  value={formData.taxIdType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      taxIdType: e.target.value as 'GSTIN' | 'PAN' | 'Aadhaar',
                    }))
                  }
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#0F172A',
                  }}
                >
                  <MenuItem value="GSTIN" sx={{ fontSize: '13.5px', fontWeight: 600 }}>
                    GSTIN (Tax ID)
                  </MenuItem>
                  <MenuItem value="PAN" sx={{ fontSize: '13.5px', fontWeight: 600 }}>
                    PAN Number
                  </MenuItem>
                  <MenuItem value="Aadhaar" sx={{ fontSize: '13.5px', fontWeight: 600 }}>
                    Aadhaar Card
                  </MenuItem>
                </Select>
              </Box>
            </Box>

            {/* Tax ID / Document Number Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                {currentTaxType.label} Number
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#1D4ED8',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder={currentTaxType.placeholder}
                  value={formData.taxIdNumber}
                  onChange={handleChange('taxIdNumber')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* State Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                State
              </Typography>
              <Autocomplete
                fullWidth
                size="small"
                autoHighlight
                options={INDIAN_STATES}
                value={formData.state || null}
                onChange={(_e, val) => setFormData((prev) => ({ ...prev, state: val || '' }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select or search state..."
                    sx={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-root': {
                        height: '42px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        color: '#0F172A',
                        '& fieldset': { borderColor: '#E2E8F0' },
                        '&:hover fieldset': { borderColor: '#CBD5E1' },
                        '&.Mui-focused fieldset': { borderColor: '#1D4ED8', borderWidth: '1.5px' },
                      },
                    }}
                  />
                )}
              />
            </Box>

            {/* Billing Address Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Billing / Delivery Address
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#1D4ED8',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 123 Industrial Area, Phase 2"
                  value={formData.billingAddress}
                  onChange={handleChange('billingAddress')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1.5,
              mt: 4,
              pt: 3,
              borderTop: '1px solid #EEF2F6',
            }}
          >
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
              sx={{
                height: '40px',
                px: 2.5,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#64748B',
                borderColor: '#E2E8F0',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#CBD5E1',
                  backgroundColor: '#F8FAFC',
                },
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              disableElevation
              onClick={handleSubmit}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
              }
              sx={{
                height: '40px',
                px: 3,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                backgroundColor: '#1D4ED8',
                color: '#FFFFFF',
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(135deg, #172554 0%, #1D4ED8 55%, #0284C7 100%)',
                },
              }}
            >
              {loading ? 'Creating...' : 'Register Customer'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
