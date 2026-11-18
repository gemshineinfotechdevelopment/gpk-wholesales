import { useState, useEffect, type FC, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Snackbar,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Collapse,
  Avatar,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import {
  PerformaApi,
  type PendingCasesResponse,
  type PendingCustomerGroup,
  type PendingCompanyGroup,
} from '../services/api';

interface PendingCasesPageProps {
  onSelectCustomerForBill?: (customerName: string) => void;
}

export const PendingCasesPage: FC<PendingCasesPageProps> = ({ onSelectCustomerForBill }) => {
  const [subTab, setSubTab] = useState<'customer' | 'company'>('customer');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PendingCasesResponse | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');

  // Expanded cards state
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const [companyViewMode, setCompanyViewMode] = useState<Record<string, 'product' | 'order'>>({});

  // Toast notification
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'error' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await PerformaApi.getPendingCases({
        search: search.trim() || undefined,
        companyName: selectedCompany !== 'ALL' ? selectedCompany : undefined,
      });
      setData(res);

      // Auto-expand the first 3 cards by default if not set
      if (res?.customerCases) {
        const initialCustomerExpand: Record<string, boolean> = {};
        res.customerCases.forEach((c: PendingCustomerGroup, idx: number) => {
          initialCustomerExpand[c.customerName] = idx < 3;
        });
        setExpandedCustomers((prev) => (Object.keys(prev).length === 0 ? initialCustomerExpand : prev));
      }

      if (res?.companyCases) {
        const initialCompanyExpand: Record<string, boolean> = {};
        res.companyCases.forEach((c: PendingCompanyGroup, idx: number) => {
          initialCompanyExpand[c.companyName] = idx < 3;
        });
        setExpandedCompanies((prev) => (Object.keys(prev).length === 0 ? initialCompanyExpand : prev));
      }
    } catch (err: any) {
      console.error('Failed to fetch pending cases:', err);
      setError(err.message || 'Failed to load pending cases data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // List of unique company names for filter dropdown
  const companyOptions = useMemo(() => {
    if (!data?.companyCases) return [];
    return data.companyCases.map((c) => c.companyName);
  }, [data]);

  const toggleCustomerExpand = (customerName: string) => {
    setExpandedCustomers((prev) => ({ ...prev, [customerName]: !prev[customerName] }));
  };

  const toggleCompanyExpand = (companyName: string) => {
    setExpandedCompanies((prev) => ({ ...prev, [companyName]: !prev[companyName] }));
  };

  const setCompanyMode = (companyName: string, mode: 'product' | 'order') => {
    setCompanyViewMode((prev) => ({ ...prev, [companyName]: mode }));
  };

  // Copy customer pending cases text for WhatsApp
  const handleCopyCustomerWhatsApp = (customer: PendingCustomerGroup) => {
    let msg = `*PENDING CASES STATUS*\n`;
    msg += `Customer: *${customer.customerName}*\n`;
    if (customer.customerPhone) msg += `Phone: ${customer.customerPhone}\n`;
    msg += `Total Pending Cases: *${customer.totalPendingCases}*\n`;
    msg += `Total Pending Value: *₹${customer.totalPendingAmount.toLocaleString('en-IN')}*\n\n`;
    msg += `*Pending Items Breakdown:*\n`;

    customer.items.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.productName}* (${item.companyName})\n`;
      msg += `   Ordered: ${item.requiredCases} cs | Delivered: ${item.usedCases} cs | *Pending: ${item.remainingCases} cs*\n`;
      msg += `   Rate: ₹${item.rate} | Amount: ₹${item.remainingAmount.toLocaleString('en-IN')}\n`;
      msg += `   Performa Ref: ${item.performaNumber}\n\n`;
    });

    navigator.clipboard.writeText(msg);
    setSnackbar({
      open: true,
      message: `Pending details for ${customer.customerName} copied to clipboard!`,
      severity: 'success',
    });
  };

  // Copy company supplier purchase order for WhatsApp
  const handleCopyCompanySupplierOrder = (company: PendingCompanyGroup) => {
    let msg = `*PURCHASE REQUIREMENT / PENDING CASES*\n`;
    msg += `Company / Manufacturer: *${company.companyName}*\n`;
    msg += `Total Cases Needed: *${company.totalPendingCases}*\n`;
    msg += `Total Estimated Value: *₹${company.totalPendingAmount.toLocaleString('en-IN')}*\n`;
    msg += `Awaiting Customers: ${company.customersCount}\n\n`;
    msg += `*Items Required Immediately:*\n`;

    company.productSummaries.forEach((prod, idx) => {
      msg += `${idx + 1}. *${prod.productName}*${prod.productCode ? ` [${prod.productCode}]` : ''}\n`;
      msg += `   *Required Cases: ${prod.totalRemainingCases}*\n`;
      msg += `   Customer Orders:\n`;
      prod.customers.forEach((c) => {
        msg += `    - ${c.customerName}: ${c.remainingCases} cases (Ref: ${c.performaNumber})\n`;
      });
      msg += `\n`;
    });

    navigator.clipboard.writeText(msg);
    setSnackbar({
      open: true,
      message: `Supplier order list for ${company.companyName} copied to clipboard!`,
      severity: 'success',
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Banner & Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mb: 3,
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Inventory2OutlinedIcon sx={{ color: '#0B4DB7', fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Pending Cases Dashboard
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Real-time tracking of pending cases to deliver to customers and cases awaiting supply from companies
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => fetchData()}
            disabled={loading}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              borderColor: '#CBD5E1',
              color: '#334155',
              '&:hover': { borderColor: '#94A3B8', backgroundColor: '#F1F5F9' },
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* KPI Stat Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3.5,
        }}
      >
        <Card
          sx={{
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Pending Cases
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#DC2626', mt: 0.5 }}>
              {data?.summary?.totalPendingCases?.toLocaleString('en-IN') || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Cases to be dispatched
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Pending Value
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B4DB7', mt: 0.5 }}>
              ₹{data?.summary?.totalPendingAmount?.toLocaleString('en-IN') || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Expected billing volume
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Customers Waiting
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#D97706', mt: 0.5 }}>
              {data?.summary?.totalCustomersWithPending || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Accounts with unfulfilled orders
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Supplier Companies Pending
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#7C3AED', mt: 0.5 }}>
              {data?.summary?.totalCompaniesWithPending || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Companies with supply dues
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Sub Tabs Selector & Search / Filter Controls */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2,
        }}
      >
        {/* Main Sub Tabs: Customer Cases & Company Cases */}
        <Box sx={{ display: 'flex', gap: 1, backgroundColor: '#F1F5F9', p: 0.5, borderRadius: '10px' }}>
          <Button
            onClick={() => setSubTab('customer')}
            variant={subTab === 'customer' ? 'contained' : 'text'}
            startIcon={<PersonOutlineRoundedIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '8px',
              px: 2.5,
              py: 0.8,
              backgroundColor: subTab === 'customer' ? '#0B4DB7' : 'transparent',
              color: subTab === 'customer' ? '#FFFFFF' : '#475569',
              boxShadow: subTab === 'customer' ? '0 2px 4px rgba(11, 77, 183, 0.2)' : 'none',
              '&:hover': {
                backgroundColor: subTab === 'customer' ? '#093C8F' : '#E2E8F0',
              },
            }}
          >
            Customer Cases
            <Chip
              label={data?.customerCases?.length || 0}
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: subTab === 'customer' ? '#FFFFFF' : '#CBD5E1',
                color: subTab === 'customer' ? '#0B4DB7' : '#334155',
              }}
            />
          </Button>

          <Button
            onClick={() => setSubTab('company')}
            variant={subTab === 'company' ? 'contained' : 'text'}
            startIcon={<BusinessRoundedIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '8px',
              px: 2.5,
              py: 0.8,
              backgroundColor: subTab === 'company' ? '#0B4DB7' : 'transparent',
              color: subTab === 'company' ? '#FFFFFF' : '#475569',
              boxShadow: subTab === 'company' ? '0 2px 4px rgba(11, 77, 183, 0.2)' : 'none',
              '&:hover': {
                backgroundColor: subTab === 'company' ? '#093C8F' : '#E2E8F0',
              },
            }}
          >
            Company Cases
            <Chip
              label={data?.companyCases?.length || 0}
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: subTab === 'company' ? '#FFFFFF' : '#CBD5E1',
                color: subTab === 'company' ? '#0B4DB7' : '#334155',
              }}
            />
          </Button>
        </Box>

        {/* Search & Company Filter */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder={subTab === 'customer' ? 'Search customer, phone, product...' : 'Search company, product...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              minWidth: { xs: '100%', sm: 260 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
              },
            }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="company-filter-label">Filter Company</InputLabel>
            <Select
              labelId="company-filter-label"
              value={selectedCompany}
              label="Filter Company"
              onChange={(e) => setSelectedCompany(e.target.value)}
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="ALL">All Companies</MenuItem>
              {companyOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Loading & Error States */}
      {loading && !data && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress size={40} sx={{ color: '#0B4DB7', mb: 2 }} />
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Analyzing pending cases across all orders...
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: CUSTOMER CASES                                                */}
      {/* ========================================================================= */}
      {subTab === 'customer' && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {data?.customerCases?.length === 0 ? (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 48, color: '#10B981', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#0F172A' }}>
                No Customer Pending Cases!
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                All ordered cases for active customers have been completely billed and delivered.
              </Typography>
            </Paper>
          ) : (
            data?.customerCases?.map((customer) => {
              const isExpanded = Boolean(expandedCustomers[customer.customerName]);

              return (
                <Paper
                  key={customer.customerName}
                  sx={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'box-shadow 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    },
                  }}
                >
                  {/* Customer Card Header */}
                  <Box
                    sx={{
                      p: 2.5,
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: { xs: 'column', lg: 'row' },
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', lg: 'center' },
                      gap: 2,
                      cursor: 'pointer',
                      borderBottom: isExpanded ? '1px solid #EEF2F6' : 'none',
                    }}
                    onClick={() => toggleCustomerExpand(customer.customerName)}
                  >
                    {/* Left: Customer Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: '#DBEAFE',
                          color: '#0B4DB7',
                          fontWeight: 700,
                          width: 44,
                          height: 44,
                          fontSize: '18px',
                        }}
                      >
                        {customer.customerName.charAt(0).toUpperCase()}
                      </Avatar>

                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '17px' }}>
                            {customer.customerName}
                          </Typography>
                          {customer.customerCompany && (
                            <Chip
                              label={customer.customerCompany}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '11px',
                                fontWeight: 500,
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                          {customer.customerPhone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneRoundedIcon sx={{ fontSize: 14, color: '#64748B' }} />
                              <Typography variant="body2" sx={{ color: '#64748B', fontSize: '13px' }}>
                                {customer.customerPhone}
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '13px' }}>
                            Performa Orders:{' '}
                            <strong style={{ color: '#334155' }}>{customer.performaNumbers.join(', ')}</strong>
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Right: Metrics & Actions */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        width: { xs: '100%', lg: 'auto' },
                        justifyContent: { xs: 'space-between', lg: 'flex-end' },
                        flexWrap: 'wrap',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Box sx={{ textAlign: { xs: 'left', lg: 'right' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={`${customer.totalPendingCases} Cases Pending`}
                            sx={{
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                              fontWeight: 700,
                              fontSize: '13px',
                              borderRadius: '6px',
                              height: 28,
                            }}
                          />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                            ₹{customer.totalPendingAmount.toLocaleString('en-IN')}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.3 }}>
                          Ordered: {customer.totalRequiredCases} cs | Delivered: {customer.totalUsedCases} cs
                        </Typography>
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {onSelectCustomerForBill && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<ReceiptLongRoundedIcon />}
                            onClick={() => onSelectCustomerForBill(customer.customerName)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '13px',
                              borderRadius: '8px',
                              backgroundColor: '#0B4DB7',
                              '&:hover': { backgroundColor: '#093C8F' },
                            }}
                          >
                            Create Particular Bill
                          </Button>
                        )}

                        <Tooltip title="Copy WhatsApp Summary for Customer">
                          <IconButton
                            size="small"
                            onClick={() => handleCopyCustomerWhatsApp(customer)}
                            sx={{
                              color: '#10B981',
                              border: '1px solid #D1FAE5',
                              backgroundColor: '#ECFDF5',
                              '&:hover': { backgroundColor: '#D1FAE5' },
                            }}
                          >
                            <WhatsAppIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <IconButton
                          size="small"
                          onClick={() => toggleCustomerExpand(customer.customerName)}
                          sx={{ color: '#64748B' }}
                        >
                          {isExpanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>

                  {/* Expandable Breakdown Table */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2.5, backgroundColor: '#FAFAFC' }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, color: '#334155', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        Pending Products to be Dispatched ({customer.items.length} items)
                      </Typography>

                      <TableContainer component={Paper} sx={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <Table size="small">
                          <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', width: '50px' }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Product Name</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Company / Brand</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                                Ordered Cases
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                                Delivered Cases
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#B45309', textAlign: 'center' }}>
                                Remaining (Pending)
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>Rate (₹)</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                                Pending Amount (₹)
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                                Performa Ref
                              </TableCell>
                            </TableRow>
                          </TableHead>

                          <TableBody>
                            {customer.items.map((item, idx) => (
                              <TableRow
                                key={`${item.performaNumber}_${idx}`}
                                sx={{
                                  '&:hover': { backgroundColor: '#F8FAFC' },
                                  '&:last-child td': { borderBottom: 0 },
                                }}
                              >
                                <TableCell sx={{ color: '#64748B', fontWeight: 600 }}>{idx + 1}</TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                                    {item.productName}
                                  </Typography>
                                  {item.productCode && (
                                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                                      Code: {item.productCode}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={item.companyName}
                                    size="small"
                                    sx={{
                                      height: 22,
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center', color: '#64748B' }}>{item.requiredCases}</TableCell>
                                <TableCell sx={{ textAlign: 'center', color: '#10B981', fontWeight: 600 }}>
                                  {item.usedCases}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>
                                  <Chip
                                    label={`${item.remainingCases} Cases`}
                                    size="small"
                                    sx={{
                                      height: 24,
                                      fontWeight: 700,
                                      fontSize: '12px',
                                      backgroundColor: '#FEE2E2',
                                      color: '#B91C1C',
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', color: '#334155' }}>
                                  ₹{item.rate.toLocaleString('en-IN')}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                  ₹{item.remainingAmount.toLocaleString('en-IN')}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0B4DB7', fontSize: '13px' }}>
                                    {item.performaNumber}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                                    {item.performaDate}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Collapse>
                </Paper>
              );
            })
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: COMPANY CASES                                                  */}
      {/* ========================================================================= */}
      {subTab === 'company' && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {data?.companyCases?.length === 0 ? (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 48, color: '#10B981', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#0F172A' }}>
                No Company Pending Cases!
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                All supplier companies have fulfilled the required product cases.
              </Typography>
            </Paper>
          ) : (
            data?.companyCases?.map((company) => {
              const isExpanded = Boolean(expandedCompanies[company.companyName]);
              const currentMode = companyViewMode[company.companyName] || 'product';

              return (
                <Paper
                  key={company.companyName}
                  sx={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'box-shadow 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    },
                  }}
                >
                  {/* Company Card Header */}
                  <Box
                    sx={{
                      p: 2.5,
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: { xs: 'column', lg: 'row' },
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', lg: 'center' },
                      gap: 2,
                      cursor: 'pointer',
                      borderBottom: isExpanded ? '1px solid #EEF2F6' : 'none',
                    }}
                    onClick={() => toggleCompanyExpand(company.companyName)}
                  >
                    {/* Left: Company Details */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: company.avatarBg || '#DBEAFE',
                          color: company.avatarColor || '#0B4DB7',
                          fontWeight: 700,
                          width: 44,
                          height: 44,
                          fontSize: '18px',
                        }}
                      >
                        {company.avatarLetter || company.companyName.charAt(0).toUpperCase()}
                      </Avatar>

                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '17px' }}>
                            {company.companyName}
                          </Typography>
                          {company.gstin && (
                            <Chip
                              label={`GSTIN: ${company.gstin}`}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '11px',
                                fontWeight: 500,
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                          {company.address && (
                            <Typography variant="body2" sx={{ color: '#64748B', fontSize: '13px' }}>
                              {company.address}
                            </Typography>
                          )}
                          <Typography variant="body2" sx={{ color: '#0B4DB7', fontSize: '13px', fontWeight: 600 }}>
                            {company.customersCount} Customers Waiting
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Right: Metrics & Order Generation */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        width: { xs: '100%', lg: 'auto' },
                        justifyContent: { xs: 'space-between', lg: 'flex-end' },
                        flexWrap: 'wrap',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Box sx={{ textAlign: { xs: 'left', lg: 'right' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={`${company.totalPendingCases} Cases to Supply`}
                            sx={{
                              backgroundColor: '#EDE9FE',
                              color: '#6D28D9',
                              fontWeight: 700,
                              fontSize: '13px',
                              borderRadius: '6px',
                              height: 28,
                            }}
                          />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                            ₹{company.totalPendingAmount.toLocaleString('en-IN')}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.3 }}>
                          Unique Products Needed: {company.productSummaries.length}
                        </Typography>
                      </Box>

                      {/* Action: Copy Supplier Order */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ContentCopyRoundedIcon />}
                          onClick={() => handleCopyCompanySupplierOrder(company)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '13px',
                            borderRadius: '8px',
                            borderColor: '#8B5CF6',
                            color: '#7C3AED',
                            '&:hover': {
                              borderColor: '#7C3AED',
                              backgroundColor: '#F5F3FF',
                            },
                          }}
                        >
                          Copy Supplier Order
                        </Button>

                        <IconButton
                          size="small"
                          onClick={() => toggleCompanyExpand(company.companyName)}
                          sx={{ color: '#64748B' }}
                        >
                          {isExpanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>

                  {/* Expandable Breakdown View */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2.5, backgroundColor: '#FAFAFC' }}>
                      {/* Sub-view toggle inside Company card */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 2,
                          flexWrap: 'wrap',
                          gap: 1.5,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          Pending Requirements for {company.companyName}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1, backgroundColor: '#E2E8F0', p: 0.3, borderRadius: '8px' }}>
                          <Button
                            size="small"
                            onClick={() => setCompanyMode(company.companyName, 'product')}
                            sx={{
                              textTransform: 'none',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              px: 1.5,
                              py: 0.3,
                              backgroundColor: currentMode === 'product' ? '#FFFFFF' : 'transparent',
                              color: currentMode === 'product' ? '#0B4DB7' : '#64748B',
                              boxShadow: currentMode === 'product' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            }}
                          >
                            By Product Needed ({company.productSummaries.length})
                          </Button>

                          <Button
                            size="small"
                            onClick={() => setCompanyMode(company.companyName, 'order')}
                            sx={{
                              textTransform: 'none',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              px: 1.5,
                              py: 0.3,
                              backgroundColor: currentMode === 'order' ? '#FFFFFF' : 'transparent',
                              color: currentMode === 'order' ? '#0B4DB7' : '#64748B',
                              boxShadow: currentMode === 'order' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            }}
                          >
                            By Customer Orders ({company.items.length})
                          </Button>
                        </Box>
                      </Box>

                      {/* View Mode A: Grouped by Product Needed */}
                      {currentMode === 'product' && (
                        <TableContainer component={Paper} sx={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <Table size="small">
                            <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', width: '50px' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Product Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#6D28D9', textAlign: 'center' }}>
                                  Total Cases to Supply
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>Est. Rate</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Value (₹)</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Customers Awaiting Order</TableCell>
                              </TableRow>
                            </TableHead>

                            <TableBody>
                              {company.productSummaries.map((prod, idx) => (
                                <TableRow
                                  key={`${prod.productName}_${idx}`}
                                  sx={{
                                    '&:hover': { backgroundColor: '#F8FAFC' },
                                    '&:last-child td': { borderBottom: 0 },
                                  }}
                                >
                                  <TableCell sx={{ color: '#64748B', fontWeight: 600 }}>{idx + 1}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                                      {prod.productName}
                                    </Typography>
                                    {prod.productCode && (
                                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                                        Code: {prod.productCode}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center' }}>
                                    <Chip
                                      label={`${prod.totalRemainingCases} Cases`}
                                      size="small"
                                      sx={{
                                        height: 24,
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        backgroundColor: '#EDE9FE',
                                        color: '#6D28D9',
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', color: '#334155' }}>
                                    ₹{prod.rate.toLocaleString('en-IN')}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                    ₹{prod.estimatedAmount.toLocaleString('en-IN')}
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                      {prod.customers.map((c, cIdx) => (
                                        <Chip
                                          key={cIdx}
                                          label={`${c.customerName}: ${c.remainingCases} cs`}
                                          size="small"
                                          sx={{
                                            height: 22,
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            backgroundColor: '#FEF3C7',
                                            color: '#92400E',
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}

                      {/* View Mode B: Detailed Customer Orders */}
                      {currentMode === 'order' && (
                        <TableContainer component={Paper} sx={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <Table size="small">
                            <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', width: '50px' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Customer Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Product Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#6D28D9', textAlign: 'center' }}>
                                  Cases Needed
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>Rate</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'right' }}>Amount</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                                  Performa Ref
                                </TableCell>
                              </TableRow>
                            </TableHead>

                            <TableBody>
                              {company.items.map((item, idx) => (
                                <TableRow
                                  key={`${item.performaNumber}_${idx}`}
                                  sx={{
                                    '&:hover': { backgroundColor: '#F8FAFC' },
                                    '&:last-child td': { borderBottom: 0 },
                                  }}
                                >
                                  <TableCell sx={{ color: '#64748B', fontWeight: 600 }}>{idx + 1}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                                      {item.customerName}
                                    </Typography>
                                    {item.customerPhone && (
                                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                                        {item.customerPhone}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                      {item.productName}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center' }}>
                                    <Chip
                                      label={`${item.remainingCases} Cases`}
                                      size="small"
                                      sx={{
                                        height: 24,
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        backgroundColor: '#EDE9FE',
                                        color: '#6D28D9',
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', color: '#334155' }}>
                                    ₹{item.rate.toLocaleString('en-IN')}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                    ₹{item.remainingAmount.toLocaleString('en-IN')}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0B4DB7', fontSize: '13px' }}>
                                      {item.performaNumber}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                                      {item.performaDate}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              );
            })
          )}
        </Box>
      )}

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
