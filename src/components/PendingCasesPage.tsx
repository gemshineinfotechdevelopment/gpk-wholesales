import { useState, useEffect, type FC, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
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
  Avatar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import {
  PerformaApi,
  type PendingCasesResponse,
  type PendingCustomerGroup,
  type PendingCompanyGroup,
} from '../services/api';

interface PendingCasesPageProps {
  onSelectCustomerForBill?: (customerName: string, subTab?: any) => void;
  onNavigateToCustomerPerforma?: (customerName: string) => void;
}

export const PendingCasesPage: FC<PendingCasesPageProps> = ({
  onSelectCustomerForBill,
  onNavigateToCustomerPerforma,
}) => {
  const [subTab, setSubTab] = useState<'customer' | 'company'>('customer');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PendingCasesResponse | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');

  // Company Cases Tab specific selection
  const [activeCompanySelection, setActiveCompanySelection] = useState<string>('ALL');
  const [companyViewMode, setCompanyViewMode] = useState<Record<string, 'product' | 'order'>>({});

  // Expanded cards state (for card view mode)
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Detail Modals
  const [customerModal, setCustomerModal] = useState<{
    open: boolean;
    customer: PendingCustomerGroup | null;
  }>({ open: false, customer: null });

  const [companyModal, setCompanyModal] = useState<{
    open: boolean;
    company: PendingCompanyGroup | null;
    tab: 'product' | 'order';
  }>({ open: false, company: null, tab: 'product' });

  // Edit Performa Modal
  const [editModal, setEditModal] = useState<{
    open: boolean;
    loading: boolean;
    saving: boolean;
    performaId: string;
    performaNumber: string;
    customerName: string;
    companyName: string;
    date: string;
    status: string;
    notes: string;
    products: Array<{
      id: string;
      productId?: string;
      productName: string;
      productCode: string;
      companyName: string;
      requiredCases: number;
      usedCases: number;
      remainingCases: number;
      rate: number;
      pktPerUnit: number;
      allocatedAmount: number;
    }>;
  }>({
    open: false,
    loading: false,
    saving: false,
    performaId: '',
    performaNumber: '',
    customerName: '',
    companyName: '',
    date: '',
    status: 'ACTIVE',
    notes: '',
    products: [],
  });

  // Delete Performa Confirm Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    loading: boolean;
    customerName: string;
    performaId: string;
    performaNumber: string;
  }>({
    open: false,
    loading: false,
    customerName: '',
    performaId: '',
    performaNumber: '',
  });

  // Choice Dialog when customer has multiple performas to select from
  const [chooseDialog, setChooseDialog] = useState<{
    open: boolean;
    customerName: string;
    action: 'edit' | 'delete';
    performas: Array<{ id: string; number: string }>;
  }>({
    open: false,
    customerName: '',
    action: 'edit',
    performas: [],
  });

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
        companyName: selectedCompanyFilter !== 'ALL' ? selectedCompanyFilter : undefined,
      });
      setData(res);

      if (res?.companyCases && res.companyCases.length > 0) {
        // If activeCompanySelection is set to a company that no longer exists, reset to ALL
        if (
          activeCompanySelection !== 'ALL' &&
          !res.companyCases.some(
            (c: PendingCompanyGroup) => c.companyName.toLowerCase() === activeCompanySelection.toLowerCase()
          )
        ) {
          setActiveCompanySelection('ALL');
        }
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
  }, [selectedCompanyFilter]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // List of unique companies from companyCases
  const companyOptions = useMemo(() => {
    if (!data?.companyCases) return [];
    return data.companyCases.map((c) => c.companyName);
  }, [data]);

  // Filtered company list for the Company Cases tab based on activeCompanySelection
  const displayedCompanyCases = useMemo(() => {
    if (!data?.companyCases) return [];
    if (activeCompanySelection === 'ALL') {
      return data.companyCases;
    }
    return data.companyCases.filter(
      (c) => c.companyName.toLowerCase() === activeCompanySelection.toLowerCase()
    );
  }, [data, activeCompanySelection]);

  const toggleCustomerExpand = (customerName: string) => {
    setExpandedCustomers((prev) => ({ ...prev, [customerName]: !prev[customerName] }));
  };

  const toggleCompanyExpand = (companyName: string) => {
    setExpandedCompanies((prev) => ({ ...prev, [companyName]: !prev[companyName] }));
  };

  // Copy customer pending cases text for WhatsApp
  const handleCopyCustomerWhatsApp = (customer: PendingCustomerGroup) => {
    let msg = `*PENDING CASES STATUS*\n`;
    msg += `Customer: *${customer.customerName}*\n`;
    if (customer.customerPhone) msg += `Phone: ${customer.customerPhone}\n`;
    msg += `Total Pending Cases: *${customer.totalPendingCases} Cases*\n`;
    msg += `Total Pending Value: *₹${customer.totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n\n`;
    msg += `*Pending Items Breakdown:*\n`;

    customer.items.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.productName}* (${item.companyName})\n`;
      msg += `   Ordered: ${item.requiredCases} cs | Delivered: ${item.usedCases} cs | *Pending: ${item.remainingCases} cs*\n`;
      msg += `   Rate: ₹${item.rate} | Amount: ₹${item.remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
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
    const totalBalance = company.totalBalanceCases ?? company.totalPendingCases;
    const totalGiven = company.totalGivenCases ?? 0;
    const totalStock = company.totalStockCases ?? (totalGiven + totalBalance);

    let msg = `*PURCHASE REQUIREMENT / BALANCE CASES*\n`;
    msg += `Company / Manufacturer: *${company.companyName}*\n`;
    msg += `Total Stock Ordered: *${totalStock} cases*\n`;
    msg += `Delivered to Customers: *${totalGiven} cases*\n`;
    msg += `*Balance Stock Required: ${totalBalance} cases*\n`;
    msg += `Estimated Balance Value: *₹${(company.totalBalanceAmount ?? company.totalPendingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n`;
    msg += `Customers Waiting: ${company.customersCount}\n\n`;
    msg += `*Items Required Breakdown:*\n`;

    company.productSummaries.forEach((prod, idx) => {
      const pBalance = prod.totalBalanceCases ?? prod.totalRemainingCases;
      const pGiven = prod.totalGivenCases ?? prod.totalUsedCases;
      const pTotal = prod.totalStockCases ?? prod.totalRequiredCases;
      msg += `${idx + 1}. *${prod.productName}*${prod.productCode ? ` [${prod.productCode}]` : ''}\n`;
      msg += `   Total: ${pTotal} cs | Given: ${pGiven} cs | *Balance: ${pBalance} cs*\n`;
      msg += `   Customer Orders:\n`;
      prod.customers.forEach((c) => {
        const cBal = c.balanceCases ?? c.remainingCases;
        const cGiven = c.givenCases ?? 0;
        msg += `    - ${c.customerName}: Given ${cGiven} cs | Balance ${cBal} cs (Ref: ${c.performaNumber})\n`;
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

  // Extract unique performa orders for a customer
  const getCustomerPerformas = (customer: PendingCustomerGroup) => {
    const map = new Map<string, { id: string; number: string }>();
    customer.items.forEach((i) => {
      if (i.performaId && i.performaNumber) {
        map.set(i.performaNumber, { id: i.performaId, number: i.performaNumber });
      }
    });
    return Array.from(map.values());
  };

  // Open Edit Modal for a given Performa
  const handleOpenEditModal = async (performaId: string, performaNumber: string, customerName: string) => {
    try {
      setEditModal({
        open: true,
        loading: true,
        saving: false,
        performaId,
        performaNumber,
        customerName,
        companyName: '',
        date: '',
        status: 'ACTIVE',
        notes: '',
        products: [],
      });

      const perf = await PerformaApi.getById(performaId);
      const loadedProducts = (perf.products || []).map((p: any, idx: number) => ({
        id: p._id || String(idx) + '-' + Date.now(),
        productId: p.productId,
        productName: p.productSnapshot?.productName || p.productName || 'Product',
        productCode: p.productSnapshot?.productCode || p.productCode || '',
        companyName: p.productSnapshot?.companyName || p.companyName || perf.companyName || '',
        requiredCases: p.requiredCases || 0,
        usedCases: p.usedCases || 0,
        remainingCases: p.remainingCases || p.requiredCases || 0,
        rate: p.rate || 0,
        pktPerUnit: p.pktPerUnit || 1,
        allocatedAmount: p.allocatedAmount || (p.requiredCases || 0) * (p.rate || 0) * (p.pktPerUnit || 1),
      }));

      setEditModal({
        open: true,
        loading: false,
        saving: false,
        performaId: perf._id,
        performaNumber: perf.performaNumber,
        customerName: perf.customerSnapshot?.name || customerName,
        companyName: perf.companyName || '',
        date: perf.date || '',
        status: perf.status || 'ACTIVE',
        notes: perf.notes || '',
        products: loadedProducts,
      });
    } catch (err: any) {
      console.error('Failed to load performa:', err);
      setSnackbar({ open: true, message: err?.message || 'Failed to load Performa', severity: 'error' });
      setEditModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  // Handler when user clicks Edit on a customer row
  const handleStartEditCustomer = (customer: PendingCustomerGroup) => {
    const list = getCustomerPerformas(customer);
    if (list.length === 0) {
      // If direct bill or no performa, offer navigation to Performa page
      if (onNavigateToCustomerPerforma) {
        onNavigateToCustomerPerforma(customer.customerName);
      } else {
        setSnackbar({ open: true, message: `No active Performa found for ${customer.customerName}`, severity: 'info' });
      }
      return;
    }

    if (list.length === 1) {
      handleOpenEditModal(list[0].id, list[0].number, customer.customerName);
    } else {
      setChooseDialog({
        open: true,
        customerName: customer.customerName,
        action: 'edit',
        performas: list,
      });
    }
  };

  // Handler when user clicks Delete on a customer row
  const handleStartDeleteCustomer = (customer: PendingCustomerGroup) => {
    const list = getCustomerPerformas(customer);
    if (list.length === 0) {
      setSnackbar({ open: true, message: `No active Performa to delete for ${customer.customerName}`, severity: 'info' });
      return;
    }

    if (list.length === 1) {
      setDeleteDialog({
        open: true,
        loading: false,
        customerName: customer.customerName,
        performaId: list[0].id,
        performaNumber: list[0].number,
      });
    } else {
      setChooseDialog({
        open: true,
        customerName: customer.customerName,
        action: 'delete',
        performas: list,
      });
    }
  };

  // Save Performa Changes from Edit Modal
  const handleSaveEditModal = async () => {
    if (!editModal.performaId) return;

    try {
      setEditModal((prev) => ({ ...prev, saving: true }));

      const payload = {
        date: editModal.date,
        status: editModal.status,
        notes: editModal.notes.trim(),
        products: editModal.products.map((p) => ({
          productId: p.productId,
          productSnapshot: {
            productName: p.productName,
            productCode: p.productCode,
            companyName: p.companyName,
          },
          requiredCases: parseFloat(String(p.requiredCases)) || 0,
          usedCases: p.usedCases || 0,
          rate: parseFloat(String(p.rate)) || 0,
          pktPerUnit: parseFloat(String(p.pktPerUnit)) || 1,
          allocatedAmount: (parseFloat(String(p.requiredCases)) || 0) * (parseFloat(String(p.rate)) || 0) * (parseFloat(String(p.pktPerUnit)) || 1),
        })),
      };

      await PerformaApi.update(editModal.performaId, payload);
      setSnackbar({
        open: true,
        message: `Performa ${editModal.performaNumber} updated successfully!`,
        severity: 'success',
      });
      setEditModal((prev) => ({ ...prev, open: false, saving: false }));
      fetchData();
    } catch (err: any) {
      console.error('Failed to update performa:', err);
      setSnackbar({ open: true, message: err?.message || 'Failed to save changes', severity: 'error' });
      setEditModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Confirm Delete / Cancel Performa
  const handleConfirmDelete = async (action: 'cancel' | 'delete') => {
    if (!deleteDialog.performaId) return;

    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      if (action === 'cancel') {
        await PerformaApi.update(deleteDialog.performaId, { status: 'CANCELLED' });
        setSnackbar({
          open: true,
          message: `Performa ${deleteDialog.performaNumber} cancelled successfully`,
          severity: 'success',
        });
      } else {
        await PerformaApi.delete(deleteDialog.performaId);
        setSnackbar({
          open: true,
          message: `Performa ${deleteDialog.performaNumber} deleted permanently`,
          severity: 'success',
        });
      }
      setDeleteDialog((prev) => ({ ...prev, open: false, loading: false }));
      fetchData();
    } catch (err: any) {
      console.error('Failed to delete performa:', err);
      setSnackbar({ open: true, message: err?.message || 'Failed to delete performa', severity: 'error' });
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Banner Header & Stat Cards */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mb: 2.5,
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Inventory2OutlinedIcon sx={{ color: '#0B4DB7', fontSize: 30 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', fontSize: '22px' }}>
              Pending Cases & Company Stock Dashboard
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.3, fontSize: '13px' }}>
            Compact line-by-line pending balance overview for customers and supplier companies
          </Typography>
        </Box>

        {/* View Mode Switcher & Refresh Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <ButtonGroup size="small" sx={{ backgroundColor: '#FFFFFF', borderRadius: '8px' }}>
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
              startIcon={<TableRowsRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '12px',
                borderColor: '#CBD5E1',
                backgroundColor: viewMode === 'table' ? '#0B4DB7' : 'transparent',
                color: viewMode === 'table' ? '#FFFFFF' : '#475569',
              }}
            >
              Row View (Compact)
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('cards')}
              startIcon={<GridViewRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '12px',
                borderColor: '#CBD5E1',
                backgroundColor: viewMode === 'cards' ? '#0B4DB7' : 'transparent',
                color: viewMode === 'cards' ? '#FFFFFF' : '#475569',
              }}
            >
              Card View
            </Button>
          </ButtonGroup>

          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => fetchData()}
            disabled={loading}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12.5px',
              borderColor: '#CBD5E1',
              color: '#334155',
              backgroundColor: '#FFFFFF',
              '&:hover': { borderColor: '#94A3B8', backgroundColor: '#F8FAFC' },
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* KPI Stat Cards (Compact Strip) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <Card sx={{ borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#FFFFFF' }}>
          <CardContent sx={{ p: '14px !important' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Pending Cases
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#DC2626', mt: 0.2 }}>
              {data?.summary?.totalPendingCases?.toLocaleString('en-IN') || 0}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>Balance cases to dispatch</Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#FFFFFF' }}>
          <CardContent sx={{ p: '14px !important' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Pending Value
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#0B4DB7', mt: 0.2 }}>
              ₹{data?.summary?.totalPendingAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>Expected billing volume</Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#FFFFFF' }}>
          <CardContent sx={{ p: '14px !important' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Customers Waiting
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#D97706', mt: 0.2 }}>
              {data?.summary?.totalCustomersWithPending || 0}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>Accounts awaiting balance</Typography>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: 'none', backgroundColor: '#FFFFFF' }}>
          <CardContent sx={{ p: '14px !important' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Supplier Brands
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#7C3AED', mt: 0.2 }}>
              {data?.summary?.totalCompaniesWithPending || 0}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>Companies with stock balance</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Main Sub Tabs Selector & Global Controls Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2.5,
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 1.5,
        }}
      >
        {/* Main Sub Tabs: Customer Cases & Company Cases */}
        <Box sx={{ display: 'flex', gap: 1, backgroundColor: '#F1F5F9', p: 0.5, borderRadius: '8px' }}>
          <Button
            onClick={() => setSubTab('customer')}
            variant={subTab === 'customer' ? 'contained' : 'text'}
            startIcon={<PersonOutlineRoundedIcon sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '6px',
              px: 2,
              py: 0.6,
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
                height: 18,
                fontSize: '10.5px',
                fontWeight: 800,
                backgroundColor: subTab === 'customer' ? '#FFFFFF' : '#CBD5E1',
                color: subTab === 'customer' ? '#0B4DB7' : '#334155',
              }}
            />
          </Button>

          <Button
            onClick={() => setSubTab('company')}
            variant={subTab === 'company' ? 'contained' : 'text'}
            startIcon={<BusinessRoundedIcon sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '6px',
              px: 2,
              py: 0.6,
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
                height: 18,
                fontSize: '10.5px',
                fontWeight: 800,
                backgroundColor: subTab === 'company' ? '#FFFFFF' : '#CBD5E1',
                color: subTab === 'company' ? '#0B4DB7' : '#334155',
              }}
            />
          </Button>
        </Box>

        {/* Global Search & Filter Controls */}
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
                    <SearchRoundedIcon sx={{ color: '#94A3B8', fontSize: 18 }} />
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
              value={selectedCompanyFilter}
              label="Filter Company"
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
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
          <CircularProgress size={36} sx={{ color: '#0B4DB7', mb: 2 }} />
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Analyzing pending cases and stock status...
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
        <Box>
          {data?.customerCases?.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 48, color: '#10B981', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                No Customer Pending Cases!
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                All ordered cases for active customers have been completely delivered.
              </Typography>
            </Paper>
          ) : viewMode === 'table' ? (
            /* COMPACT LINE-BY-LINE TABLE VIEW FOR 100+ CUSTOMERS */
            <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', width: '50px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        #
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                        Customer Name & Info
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                        Performa Refs
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        Ordered
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#16A34A', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        Delivered
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#B45309', textAlign: 'center', width: '130px', fontSize: '11px', textTransform: 'uppercase' }}>
                        Pending Cases
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase' }}>
                        Pending Amount
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', width: '190px', fontSize: '11px', textTransform: 'uppercase' }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {data?.customerCases?.map((customer, idx) => (
                      <TableRow
                        key={customer.customerName}
                        hover
                        sx={{
                          '&:hover': { backgroundColor: '#F8FAFC' },
                          '&:last-child td': { borderBottom: 0 },
                        }}
                      >
                        {/* 1. S.No */}
                        <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: '#64748B', fontSize: '12.5px' }}>
                          {idx + 1}
                        </TableCell>

                        {/* 2. Customer Name & Shop */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Avatar
                              sx={{
                                bgcolor: '#DBEAFE',
                                color: '#0B4DB7',
                                fontWeight: 800,
                                width: 32,
                                height: 32,
                                fontSize: '13px',
                              }}
                            >
                              {customer.customerName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontWeight: 800, color: '#0F172A', fontSize: '13.5px', lineHeight: 1.2 }}>
                                {customer.customerName}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.3, flexWrap: 'wrap' }}>
                                {customer.customerCompany && (
                                  <Chip
                                    label={customer.customerCompany}
                                    size="small"
                                    sx={{ height: 18, fontSize: '10px', fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569' }}
                                  />
                                )}
                                {customer.customerPhone && (
                                  <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                                    {customer.customerPhone}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* 3. Performa Orders */}
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {customer.performaNumbers.map((num) => (
                              <Chip
                                key={num}
                                label={num}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  backgroundColor: '#EFF6FF',
                                  color: '#1D4ED8',
                                  border: '1px solid #BFDBFE',
                                }}
                              />
                            ))}
                          </Box>
                        </TableCell>

                        {/* 4. Ordered Cases */}
                        <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                          {customer.totalRequiredCases} cs
                        </TableCell>

                        {/* 5. Delivered Cases */}
                        <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: '#16A34A', fontSize: '13px' }}>
                          {customer.totalUsedCases} cs
                        </TableCell>

                        {/* 6. Pending Cases Badge */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={`${customer.totalPendingCases} Cases`}
                            sx={{
                              backgroundColor: customer.totalPendingCases > 0 ? '#FEF3C7' : '#F1F5F9',
                              color: customer.totalPendingCases > 0 ? '#B45309' : '#64748B',
                              fontWeight: 800,
                              fontSize: '12.5px',
                              borderRadius: '6px',
                              height: 26,
                              border: customer.totalPendingCases > 0 ? '1px solid #FDE68A' : 'none',
                            }}
                          />
                        </TableCell>

                        {/* 7. Pending Amount */}
                        <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#0F172A', fontSize: '13.5px' }}>
                          ₹{customer.totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>

                        {/* 8. Status */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={
                              customer.totalPendingCases === 0
                                ? 'Completed'
                                : customer.totalUsedCases > 0
                                ? 'Partial'
                                : 'Pending'
                            }
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '10.5px',
                              fontWeight: 700,
                              backgroundColor:
                                customer.totalPendingCases === 0
                                  ? '#DCFCE7'
                                  : customer.totalUsedCases > 0
                                  ? '#E0E7FF'
                                  : '#FEE2E2',
                              color:
                                customer.totalPendingCases === 0
                                  ? '#15803D'
                                  : customer.totalUsedCases > 0
                                  ? '#3730A3'
                                  : '#B91C1C',
                            }}
                          />
                        </TableCell>

                        {/* 9. Action Icons (Beside it in row) */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                            {/* View Full Details */}
                            <Tooltip title="View Full Itemized Breakdown">
                              <IconButton
                                size="small"
                                onClick={() => setCustomerModal({ open: true, customer })}
                                sx={{
                                  color: '#0B4DB7',
                                  backgroundColor: '#EFF6FF',
                                  '&:hover': { backgroundColor: '#DBEAFE' },
                                  width: 30,
                                  height: 30,
                                }}
                              >
                                <VisibilityRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>

                            {/* Edit Performa */}
                            <Tooltip title="Edit Customer Performa">
                              <IconButton
                                size="small"
                                onClick={() => handleStartEditCustomer(customer)}
                                sx={{
                                  color: '#D97706',
                                  backgroundColor: '#FFFBEB',
                                  '&:hover': { backgroundColor: '#FEF3C7' },
                                  width: 30,
                                  height: 30,
                                }}
                              >
                                <EditRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>

                            {/* Create Particular Bill */}
                            {onSelectCustomerForBill && (
                              <Tooltip title="Create Particular Bill">
                                <IconButton
                                  size="small"
                                  onClick={() => onSelectCustomerForBill(customer.customerName)}
                                  sx={{
                                    color: '#059669',
                                    backgroundColor: '#ECFDF5',
                                    '&:hover': { backgroundColor: '#D1FAE5' },
                                    width: 30,
                                    height: 30,
                                  }}
                                >
                                  <ReceiptLongRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* WhatsApp Share */}
                            <Tooltip title="Share on WhatsApp">
                              <IconButton
                                size="small"
                                onClick={() => handleCopyCustomerWhatsApp(customer)}
                                sx={{
                                  color: '#10B981',
                                  backgroundColor: '#F0FDF4',
                                  '&:hover': { backgroundColor: '#DCFCE7' },
                                  width: 30,
                                  height: 30,
                                }}
                              >
                                <WhatsAppIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>

                            {/* Delete / Cancel */}
                            <Tooltip title="Delete / Cancel Performa">
                              <IconButton
                                size="small"
                                onClick={() => handleStartDeleteCustomer(customer)}
                                sx={{
                                  color: '#DC2626',
                                  backgroundColor: '#FEF2F2',
                                  '&:hover': { backgroundColor: '#FEE2E2' },
                                  width: 30,
                                  height: 30,
                                }}
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            /* DETAILED CARD VIEW (ALTERNATIVE) */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data?.customerCases?.map((customer) => {
                const isExpanded = Boolean(expandedCustomers[customer.customerName]);

                return (
                  <Paper
                    key={customer.customerName}
                    sx={{
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleCustomerExpand(customer.customerName)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: '#DBEAFE', color: '#0B4DB7', fontWeight: 800, width: 38, height: 38 }}>
                          {customer.customerName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                            {customer.customerName}
                          </Typography>
                          <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                            {customer.customerPhone || customer.customerCompany || 'Customer'}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip
                          label={`${customer.totalPendingCases} Cases Pending`}
                          sx={{ backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 800 }}
                        />
                        <Typography sx={{ fontWeight: 800, color: '#0F172A' }}>
                          ₹{customer.totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setCustomerModal({ open: true, customer }); }}>
                          <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: COMPANY CASES (Stock Given to Customer & Balance in Company)   */}
      {/* ========================================================================= */}
      {subTab === 'company' && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Company Quick Filter Bar */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '10px',
              border: '1.5px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', mr: 0.5 }}>
                Filter Brand:
              </Typography>
              <Chip
                label="ALL COMPANIES"
                clickable
                onClick={() => setActiveCompanySelection('ALL')}
                sx={{
                  fontWeight: 700,
                  fontSize: '11px',
                  backgroundColor: activeCompanySelection === 'ALL' ? '#0B4DB7' : '#F1F5F9',
                  color: activeCompanySelection === 'ALL' ? '#FFFFFF' : '#475569',
                  borderRadius: '6px',
                  height: 26,
                }}
              />
              {data?.companyCases?.map((comp) => {
                const isSelected = activeCompanySelection.toLowerCase() === comp.companyName.toLowerCase();
                const bal = comp.totalBalanceCases ?? comp.totalPendingCases;
                return (
                  <Chip
                    key={comp.companyName}
                    label={`${comp.companyName} (${bal} cs bal)`}
                    clickable
                    onClick={() => setActiveCompanySelection(comp.companyName)}
                    sx={{
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '11px',
                      backgroundColor: isSelected ? '#7C3AED' : '#F8FAFC',
                      color: isSelected ? '#FFFFFF' : '#334155',
                      border: `1px solid ${isSelected ? '#7C3AED' : '#E2E8F0'}`,
                      borderRadius: '6px',
                      height: 26,
                    }}
                  />
                );
              })}
            </Box>
          </Paper>

          {displayedCompanyCases.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
                backgroundColor: '#FFFFFF',
              }}
            >
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 48, color: '#10B981', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A' }}>
                No Company Cases Found!
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
                {activeCompanySelection === 'ALL'
                  ? 'No pending cases with a supplier company were found.'
                  : `No pending records found for company "${activeCompanySelection}".`}
              </Typography>
            </Paper>
          ) : viewMode === 'table' ? (
            /* COMPACT LINE-BY-LINE TABLE VIEW FOR COMPANIES */
            <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', width: '50px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        #
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                        Company / Brand
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        Stock Ordered
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#16A34A', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        Given To Customers
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#7C3AED', textAlign: 'center', width: '140px', fontSize: '11px', textTransform: 'uppercase' }}>
                        Balance in Company
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase' }}>
                        Balance Value
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                        Waiting
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', width: '130px', fontSize: '11px', textTransform: 'uppercase' }}>
                        Fulfillment
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#64748B', textAlign: 'center', width: '120px', fontSize: '11px', textTransform: 'uppercase' }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {displayedCompanyCases.map((company, idx) => {
                      const totalStock = company.totalStockCases ?? (company.totalPendingCases + (company.totalGivenCases || 0));
                      const totalGiven = company.totalGivenCases ?? 0;
                      const totalBalance = company.totalBalanceCases ?? company.totalPendingCases;
                      const balanceAmt = company.totalBalanceAmount ?? company.totalPendingAmount;
                      const pct = company.deliveryPercentage ?? (totalStock > 0 ? Math.round((totalGiven / totalStock) * 100) : 0);

                      return (
                        <TableRow
                          key={company.companyName}
                          hover
                          sx={{
                            '&:hover': { backgroundColor: '#F8FAFC' },
                            '&:last-child td': { borderBottom: 0 },
                          }}
                        >
                          {/* 1. S.No */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: '#64748B', fontSize: '12.5px' }}>
                            {idx + 1}
                          </TableCell>

                          {/* 2. Company Name & Info */}
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                              <Avatar
                                sx={{
                                  bgcolor: company.avatarBg || '#EDE9FE',
                                  color: company.avatarColor || '#7C3AED',
                                  fontWeight: 800,
                                  width: 32,
                                  height: 32,
                                  fontSize: '13px',
                                }}
                              >
                                {company.avatarLetter || company.companyName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 800, color: '#0F172A', fontSize: '13.5px', lineHeight: 1.2 }}>
                                  {company.companyName}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.3, flexWrap: 'wrap' }}>
                                  {company.gstin && (
                                    <Chip
                                      label={`GSTIN: ${company.gstin}`}
                                      size="small"
                                      sx={{ height: 18, fontSize: '10px', fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569' }}
                                    />
                                  )}
                                  {company.address && (
                                    <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                                      {company.address}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* 3. Total Stock Ordered */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                            {totalStock} cs
                          </TableCell>

                          {/* 4. Stock Given to Customers */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: '#16A34A', fontSize: '13px' }}>
                            {totalGiven} cs
                          </TableCell>

                          {/* 5. Balance Stock in Company Badge */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip
                              label={`${totalBalance} Cases`}
                              sx={{
                                backgroundColor: totalBalance > 0 ? '#F5F3FF' : '#F1F5F9',
                                color: totalBalance > 0 ? '#7C3AED' : '#64748B',
                                fontWeight: 800,
                                fontSize: '12.5px',
                                borderRadius: '6px',
                                height: 26,
                                border: totalBalance > 0 ? '1px solid #DDD6FE' : 'none',
                              }}
                            />
                          </TableCell>

                          {/* 6. Balance Stock Value */}
                          <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#0F172A', fontSize: '13.5px' }}>
                            ₹{balanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          {/* 7. Customers Waiting */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip
                              label={`${company.customersCount} Waiting`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: '#EFF6FF',
                                color: '#1D4ED8',
                              }}
                            />
                          </TableCell>

                          {/* 8. Fulfillment / Delivery Progress */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#E2E8F0',
                                  '& .MuiLinearProgress-bar': { backgroundColor: pct === 100 ? '#10B981' : '#7C3AED' },
                                }}
                              />
                              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#475569', minWidth: '28px' }}>
                                {pct}%
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* 9. Actions */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                              {/* View Stock Breakdown */}
                              <Tooltip title="View Detailed Stock Breakdown">
                                <IconButton
                                  size="small"
                                  onClick={() => setCompanyModal({ open: true, company, tab: 'product' })}
                                  sx={{
                                    color: '#7C3AED',
                                    backgroundColor: '#F5F3FF',
                                    '&:hover': { backgroundColor: '#EDE9FE' },
                                    width: 30,
                                    height: 30,
                                  }}
                                >
                                  <VisibilityRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>

                              {/* Copy Supplier Purchase Order */}
                              <Tooltip title="Copy Supplier Purchase Order">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopyCompanySupplierOrder(company)}
                                  sx={{
                                    color: '#0B4DB7',
                                    backgroundColor: '#EFF6FF',
                                    '&:hover': { backgroundColor: '#DBEAFE' },
                                    width: 30,
                                    height: 30,
                                  }}
                                >
                                  <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            /* DETAILED CARD VIEW FOR COMPANIES */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {displayedCompanyCases.map((company) => {
                const totalStock = company.totalStockCases ?? (company.totalPendingCases + (company.totalGivenCases || 0));
                const totalGiven = company.totalGivenCases ?? 0;
                const totalBalance = company.totalBalanceCases ?? company.totalPendingCases;
                const balanceAmt = company.totalBalanceAmount ?? company.totalPendingAmount;

                return (
                  <Paper key={company.companyName} sx={{ p: 2, borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '15px' }}>{company.companyName}</Typography>
                      <Chip label={`${totalBalance} Cases Balance`} sx={{ backgroundColor: '#F5F3FF', color: '#7C3AED', fontWeight: 800 }} />
                      <Typography sx={{ fontWeight: 800 }}>₹{balanceAmt.toLocaleString('en-IN')}</Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* 1. CUSTOMER PENDING DETAILS MODAL (Full itemized breakdown dialog)        */}
      {/* ========================================================================= */}
      <Dialog
        open={customerModal.open}
        onClose={() => setCustomerModal({ open: false, customer: null })}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            py: 1.8,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '16px' }}>
              Pending Items - {customerModal.customer?.customerName}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
              {customerModal.customer?.customerCompany ? `${customerModal.customer.customerCompany} • ` : ''}
              {customerModal.customer?.customerPhone || ''}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setCustomerModal({ open: false, customer: null })}
            sx={{ color: '#94A3B8', '&:hover': { color: '#FFFFFF' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, backgroundColor: '#F8FAFC' }}>
          {customerModal.customer && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Summary Strip */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  label={`Total Ordered: ${customerModal.customer.totalRequiredCases} cs`}
                  sx={{ fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }}
                />
                <Chip
                  label={`Delivered: ${customerModal.customer.totalUsedCases} cs`}
                  sx={{ fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
                />
                <Chip
                  label={`Balance Pending: ${customerModal.customer.totalPendingCases} Cases`}
                  sx={{ fontWeight: 800, backgroundColor: '#FEF3C7', color: '#B45309' }}
                />
                <Chip
                  label={`Pending Amount: ₹${customerModal.customer.totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  sx={{ fontWeight: 800, backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                />
              </Box>

              {/* Items Table */}
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: '#475569', width: '40px' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Brand / Company</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'center' }}>Ordered</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#16A34A', textAlign: 'center' }}>Delivered</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#B45309', textAlign: 'center' }}>Pending</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Rate</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Pending Amt</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'center' }}>Performa</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerModal.customer.items.map((item, idx) => (
                      <TableRow key={idx} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell sx={{ color: '#64748B', fontWeight: 600 }}>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                            {item.productName}
                          </Typography>
                          {item.productCode && (
                            <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>{item.productCode}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={item.companyName} size="small" sx={{ height: 20, fontSize: '10.5px', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', color: '#64748B' }}>{item.requiredCases}</TableCell>
                        <TableCell sx={{ textAlign: 'center', color: '#16A34A', fontWeight: 700 }}>{item.usedCases}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label={`${item.remainingCases} cs`}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 800,
                              backgroundColor: item.remainingCases > 0 ? '#FEE2E2' : '#F1F5F9',
                              color: item.remainingCases > 0 ? '#B91C1C' : '#64748B',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', color: '#334155' }}>
                          ₹{item.rate.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                          ₹{item.remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#0B4DB7' }}>
                            {item.performaNumber}
                          </Typography>
                          <Typography sx={{ fontSize: '10.5px', color: '#94A3B8' }}>{item.performaDate}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', justifyContent: 'space-between' }}>
          <Button onClick={() => setCustomerModal({ open: false, customer: null })} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Close
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {customerModal.customer && (
              <Button
                variant="outlined"
                startIcon={<WhatsAppIcon />}
                onClick={() => handleCopyCustomerWhatsApp(customerModal.customer!)}
                sx={{ textTransform: 'none', fontWeight: 700, color: '#10B981', borderColor: '#A7F3D0' }}
              >
                Copy for WhatsApp
              </Button>
            )}

            {onSelectCustomerForBill && customerModal.customer && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<ReceiptLongRoundedIcon />}
                onClick={() => {
                  const cust = customerModal.customer!.customerName;
                  setCustomerModal({ open: false, customer: null });
                  onSelectCustomerForBill(cust);
                }}
                sx={{ backgroundColor: '#0B4DB7', textTransform: 'none', fontWeight: 700 }}
              >
                Create Particular Bill
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. COMPANY STOCK BREAKDOWN MODAL                                         */}
      {/* ========================================================================= */}
      <Dialog
        open={companyModal.open}
        onClose={() => setCompanyModal({ open: false, company: null, tab: 'product' })}
        maxWidth="lg"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            py: 1.8,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '16px' }}>
              Company Stock Breakdown - {companyModal.company?.companyName}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
              {companyModal.company?.gstin ? `GSTIN: ${companyModal.company.gstin} • ` : ''}
              {companyModal.company?.customersCount} Customers Waiting
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setCompanyModal({ open: false, company: null, tab: 'product' })}
            sx={{ color: '#94A3B8', '&:hover': { color: '#FFFFFF' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, backgroundColor: '#F8FAFC' }}>
          {companyModal.company && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Tab Selector inside Modal */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant={companyModal.tab === 'product' ? 'contained' : 'outlined'}
                  onClick={() => setCompanyModal((prev) => ({ ...prev, tab: 'product' }))}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor: companyModal.tab === 'product' ? '#7C3AED' : 'transparent',
                    borderColor: '#CBD5E1',
                    color: companyModal.tab === 'product' ? '#FFFFFF' : '#475569',
                  }}
                >
                  Stock by Product Summary ({companyModal.company.productSummaries.length})
                </Button>
                <Button
                  size="small"
                  variant={companyModal.tab === 'order' ? 'contained' : 'outlined'}
                  onClick={() => setCompanyModal((prev) => ({ ...prev, tab: 'order' }))}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    backgroundColor: companyModal.tab === 'order' ? '#7C3AED' : 'transparent',
                    borderColor: '#CBD5E1',
                    color: companyModal.tab === 'order' ? '#FFFFFF' : '#475569',
                  }}
                >
                  Customer Orders Sheet ({companyModal.company.items.length})
                </Button>
              </Box>

              {/* View 1: Product Summary Table */}
              {companyModal.tab === 'product' && (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', width: '40px' }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'center' }}>Total Stock</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#16A34A', textAlign: 'center' }}>Delivered</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#7C3AED', textAlign: 'center' }}>Balance Stock</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Rate</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Balance Amt</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Customer Orders</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {companyModal.company.productSummaries.map((prod, idx) => {
                        const pTotal = prod.totalStockCases ?? prod.totalRequiredCases;
                        const pGiven = prod.totalGivenCases ?? prod.totalUsedCases;
                        const pBal = prod.totalBalanceCases ?? prod.totalRemainingCases;
                        const pBalAmt = prod.balanceAmount ?? (pBal * prod.rate);

                        return (
                          <TableRow key={idx} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                            <TableCell sx={{ color: '#64748B', fontWeight: 600 }}>{idx + 1}</TableCell>
                            <TableCell>
                              <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                {prod.productName}
                              </Typography>
                              {prod.productCode && (
                                <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>{prod.productCode}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center', color: '#64748B' }}>{pTotal} cs</TableCell>
                            <TableCell sx={{ textAlign: 'center', color: '#16A34A', fontWeight: 700 }}>{pGiven} cs</TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Chip
                                label={`${pBal} cs`}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontWeight: 800,
                                  backgroundColor: pBal > 0 ? '#F5F3FF' : '#F1F5F9',
                                  color: pBal > 0 ? '#7C3AED' : '#64748B',
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right', color: '#334155' }}>
                              ₹{prod.rate.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                              ₹{pBalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {prod.customers.map((c, cIdx) => (
                                  <Chip
                                    key={cIdx}
                                    label={`${c.customerName}: ${c.balanceCases ?? c.remainingCases} cs`}
                                    size="small"
                                    sx={{ height: 20, fontSize: '10px', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 600 }}
                                  />
                                ))}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* View 2: Customer Orders Sheet */}
              {companyModal.tab === 'order' && (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', width: '40px' }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'center' }}>Ordered</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#16A34A', textAlign: 'center' }}>Delivered</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#7C3AED', textAlign: 'center' }}>Balance</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Rate</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Amount</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'center' }}>Performa</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {companyModal.company.items.map((item, idx) => (
                        <TableRow key={idx} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                          <TableCell sx={{ color: '#64748B', fontWeight: 600 }}>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#0F172A' }}>{item.customerName}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{item.productName}</TableCell>
                          <TableCell sx={{ textAlign: 'center', color: '#64748B' }}>{item.orderedCases ?? item.requiredCases} cs</TableCell>
                          <TableCell sx={{ textAlign: 'center', color: '#16A34A', fontWeight: 700 }}>{item.givenCases ?? item.usedCases} cs</TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip
                              label={`${item.balanceCases ?? item.remainingCases} cs`}
                              size="small"
                              sx={{ height: 22, fontWeight: 800, backgroundColor: '#F5F3FF', color: '#7C3AED' }}
                            />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', color: '#334155' }}>₹{item.rate.toLocaleString('en-IN')}</TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                            ₹{(item.balanceAmount ?? item.remainingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center', fontSize: '11px', color: '#0B4DB7', fontWeight: 700 }}>
                            {item.performaNumber}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', justifyContent: 'space-between' }}>
          <Button onClick={() => setCompanyModal({ open: false, company: null, tab: 'product' })} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Close
          </Button>

          {companyModal.company && (
            <Button
              variant="contained"
              disableElevation
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => handleCopyCompanySupplierOrder(companyModal.company!)}
              sx={{ backgroundColor: '#7C3AED', textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#6D28D9' } }}
            >
              Copy Supplier Purchase Order
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. EDIT PERFORMA MODAL (Edit cases, rate, status directly)                 */}
      {/* ========================================================================= */}
      <Dialog
        open={editModal.open}
        onClose={() => !editModal.saving && setEditModal((prev) => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            py: 1.8,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '16px' }}>
              Edit Performa - {editModal.performaNumber}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
              Customer: {editModal.customerName} {editModal.companyName ? `• Brand: ${editModal.companyName}` : ''}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => !editModal.saving && setEditModal((prev) => ({ ...prev, open: false }))}
            sx={{ color: '#94A3B8', '&:hover': { color: '#FFFFFF' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, backgroundColor: '#F8FAFC' }}>
          {editModal.loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Form Controls */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField
                  label="Performa Date"
                  type="date"
                  size="small"
                  value={editModal.date}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, date: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />

                <FormControl size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={editModal.status}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                    <MenuItem value="PARTIALLY_USED">PARTIALLY USED</MenuItem>
                    <MenuItem value="COMPLETED">COMPLETED</MenuItem>
                    <MenuItem value="CANCELLED">CANCELLED</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Products Table to Edit Cases and Rates */}
              <Typography sx={{ fontWeight: 800, fontSize: '13px', color: '#334155', textTransform: 'uppercase' }}>
                Product Requirement Quantities
              </Typography>

              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: '120px' }}>Req Cases</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '80px' }}>Delivered</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: '110px' }}>Rate (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editModal.products.map((p, pIdx) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: '13px' }}>{p.productName}</Typography>
                          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>{p.companyName}</Typography>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={p.requiredCases}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditModal((prev) => {
                                const prods = [...prev.products];
                                prods[pIdx] = {
                                  ...prods[pIdx],
                                  requiredCases: val,
                                  remainingCases: Math.max(0, val - prods[pIdx].usedCases),
                                  allocatedAmount: val * prods[pIdx].rate * prods[pIdx].pktPerUnit,
                                };
                                return { ...prev, products: prods };
                              });
                            }}
                            sx={{ width: '90px' }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', color: '#16A34A', fontWeight: 700 }}>
                          {p.usedCases} cs
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={p.rate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditModal((prev) => {
                                const prods = [...prev.products];
                                prods[pIdx] = {
                                  ...prods[pIdx],
                                  rate: val,
                                  allocatedAmount: prods[pIdx].requiredCases * val * prods[pIdx].pktPerUnit,
                                };
                                return { ...prev, products: prods };
                              });
                            }}
                            sx={{ width: '90px' }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{p.allocatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={() => setEditModal((prev) => ({ ...prev, open: false }))} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={editModal.saving || editModal.loading}
            onClick={handleSaveEditModal}
            sx={{ backgroundColor: '#0B4DB7', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            {editModal.saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. CHOOSE PERFORMA DIALOG (When customer has multiple orders)             */}
      {/* ========================================================================= */}
      <Dialog
        open={chooseDialog.open}
        onClose={() => setChooseDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '16px', py: 1.8 }}>
          Select Order to {chooseDialog.action === 'edit' ? 'Edit' : 'Delete'}
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Typography sx={{ fontSize: '13px', color: '#64748B', mb: 1.5 }}>
            {chooseDialog.customerName} has multiple performa orders. Choose which one to {chooseDialog.action}:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {chooseDialog.performas.map((p) => (
              <Button
                key={p.id}
                variant="outlined"
                fullWidth
                onClick={() => {
                  setChooseDialog((prev) => ({ ...prev, open: false }));
                  if (chooseDialog.action === 'edit') {
                    handleOpenEditModal(p.id, p.number, chooseDialog.customerName);
                  } else {
                    setDeleteDialog({
                      open: true,
                      loading: false,
                      customerName: chooseDialog.customerName,
                      performaId: p.id,
                      performaNumber: p.number,
                    });
                  }
                }}
                sx={{
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1,
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                }}
              >
                <span>Performa: {p.number}</span>
                <span style={{ color: '#0B4DB7', fontSize: '12px' }}>Select ➔</span>
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          <Button onClick={() => setChooseDialog((prev) => ({ ...prev, open: false }))} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. DELETE / CANCEL PERFORMA CONFIRM DIALOG                                */}
      {/* ========================================================================= */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleteDialog.loading && setDeleteDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '16px', py: 1.8, color: '#DC2626' }}>
          Delete / Cancel Performa?
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Typography sx={{ fontSize: '13.5px', color: '#0F172A', mb: 1 }}>
            Are you sure you want to remove <strong>{deleteDialog.performaNumber}</strong> for <strong>{deleteDialog.customerName}</strong>?
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
            You can either mark it as <strong>CANCELLED</strong> (safe, keeps history) or <strong>Permanently Delete</strong> from the database.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={deleteDialog.loading}
            onClick={() => handleConfirmDelete('cancel')}
            sx={{ backgroundColor: '#D97706', textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#B45309' } }}
          >
            Cancel Performa (Set Status = CANCELLED)
          </Button>
          <Button
            variant="outlined"
            fullWidth
            disabled={deleteDialog.loading}
            onClick={() => handleConfirmDelete('delete')}
            sx={{ color: '#DC2626', borderColor: '#FECACA', textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#FEF2F2', borderColor: '#DC2626' } }}
          >
            Permanently Delete
          </Button>
          <Button
            fullWidth
            onClick={() => setDeleteDialog((prev) => ({ ...prev, open: false }))}
            sx={{ textTransform: 'none', color: '#64748B', mt: 0.5 }}
          >
            Back / Keep Order
          </Button>
        </DialogActions>
      </Dialog>

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
