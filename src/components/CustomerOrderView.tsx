import { useState, useEffect, useMemo, type FC, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  CircularProgress,
  InputBase,
  Autocomplete,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import {
  ProductsApi,
  CompaniesApi,
  OrdersApi,
  type AuthUser,
  type CustomerOrder,
} from '../services/api';
import type { ProductItem, CompanyItem } from './ProductsPage';

interface CustomerOrderViewProps {
  user?: AuthUser | null;
}

export const CustomerOrderView: FC<CustomerOrderViewProps> = ({ user }) => {
  const customerName = user?.customerName || user?.username || 'Customer';

  // Sub-tabs: 'order' (Place Order) | 'my-orders' (Order History)
  const [activeSubTab, setActiveSubTab] = useState<'order' | 'my-orders'>('order');

  // Products & Companies data
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters: Customer MUST select a specific company
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Combined sorted list of distinct available companies from CompaniesApi and Products
  const availableCompanies = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    products.forEach((p) => {
      if (p.company && p.company.trim()) set.add(p.company.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [companies, products]);

  // Quantities entered by customer: key is product._id or product.id or index
  // Map of productId -> quantity number
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Handler for switching company safely
  const handleCompanyChange = (newCompany: string) => {
    if (newCompany === selectedCompany) return;
    const hasEnteredQty = Object.values(quantities).some((q) => q > 0);
    if (hasEnteredQty) {
      if (window.confirm(`Switching company will reset entered quantities for ${selectedCompany || 'the current company'}. Do you want to continue?`)) {
        setQuantities({});
        setSelectedCompany(newCompany);
      }
    } else {
      setSelectedCompany(newCompany);
    }
  };

  // Confirmation / Checkout Dialog
  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);

  // My Orders list
  const [myOrders, setMyOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<CustomerOrder | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodsData, compsData] = await Promise.all([
        ProductsApi.getAll(),
        CompaniesApi.getAll(),
      ]);
      setProducts(prodsData || []);
      setCompanies(compsData || []);
    } catch (err) {
      console.error('Failed to load products/companies for customer:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyOrders = async () => {
    try {
      setLoadingOrders(true);
      const orders = await OrdersApi.getAll({ customerName });
      setMyOrders(orders || []);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMyOrders();
  }, [customerName]);

  // Filtered products: Strictly requires specific company to be selected
  const filteredProducts = useMemo(() => {
    if (!selectedCompany) return [];
    let list = products.filter(
      (p) => (p.company || '').trim().toLowerCase() === selectedCompany.trim().toLowerCase()
    );
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          String(p.slNo).includes(term) ||
          (p.code && p.code.toLowerCase().includes(term))
      );
    }
    return list;
  }, [products, selectedCompany, searchTerm]);

  // Handle quantity change
  const handleQuantityChange = (productId: string, val: string | number) => {
    const num = Math.max(0, parseInt(String(val), 10) || 0);
    setQuantities((prev) => ({
      ...prev,
      [productId]: num,
    }));
  };

  const incrementQty = (productId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const decrementQty = (productId: string) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: current - 1,
      };
    });
  };

  // Calculate live summary
  const orderSummary = useMemo(() => {
    let totalItems = 0;
    let totalCases = 0;
    let totalAmount = 0;
    const selectedList: Array<{
      product: ProductItem;
      quantity: number;
      total: number;
    }> = [];

    products.forEach((p) => {
      // Strictly only count products belonging to the selected company
      if (!selectedCompany || (p.company || '').trim().toLowerCase() !== selectedCompany.trim().toLowerCase()) {
        return;
      }
      const pKey = p._id || p.id || String(p.slNo);
      const qty = quantities[pKey] || 0;
      if (qty > 0) {
        totalItems += 1;
        totalCases += qty;
        const rate = p.rate || 0;
        const pktNum = parseFloat(p.pktUnit || '1') || 1;
        const lineTotal = qty * rate * pktNum;
        totalAmount += lineTotal;
        selectedList.push({
          product: p,
          quantity: qty,
          total: lineTotal,
        });
      }
    });

    return {
      totalItems,
      totalCases,
      totalAmount,
      selectedList,
    };
  }, [products, quantities, selectedCompany]);

  const handleClearAll = () => {
    if (orderSummary.totalItems === 0) return;
    if (window.confirm('Clear all entered quantities?')) {
      setQuantities({});
    }
  };

  // Submit Order
  const handleConfirmOrder = async () => {
    if (orderSummary.selectedList.length === 0) {
      alert('Please enter a quantity for at least one product');
      return;
    }

    try {
      setSubmittingOrder(true);
      const itemsPayload = orderSummary.selectedList.map((item, idx) => ({
        productId: item.product._id || item.product.id,
        slNo: idx + 1,
        productName: item.product.name,
        code: item.product.code || '',
        company: item.product.company || '',
        category: item.product.category || '',
        caseCount: item.product.caseCount || 0,
        rate: item.product.rate || 0,
        pktUnit: item.product.pktUnit || '1',
        quantity: item.quantity,
        total: item.total,
      }));

      const primaryCompany = selectedCompany || (itemsPayload[0]?.company || '');

      const response = await OrdersApi.create({
        customerName: customerName,
        companyName: primaryCompany,
        products: itemsPayload,
        notes: orderNotes.trim(),
        date: new Date().toISOString().split('T')[0],
      });

      setCheckoutOpen(false);
      setQuantities({});
      setOrderNotes('');
      setToast({
        open: true,
        message: response?.message || 'Order placed successfully!',
        severity: 'success',
      });

      // Refresh orders and switch to My Orders tab
      await fetchMyOrders();
      setActiveSubTab('my-orders');
    } catch (err: any) {
      console.error('Order submission error:', err);
      setToast({
        open: true,
        message: err?.message || 'Failed to place order. Please try again.',
        severity: 'error',
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const getStatusChip = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'PENDING':
        return <Chip label="Order Placed" size="small" sx={{ backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 800, fontSize: '11px', border: '1.5px solid #16A34A' }} />;
      case 'SEEN':
        return <Chip label="Seen by Admin" size="small" sx={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontWeight: 800, fontSize: '11px', border: '1px solid #BAE6FD' }} />;
      case 'VERIFIED':
        return <Chip label="Verified" size="small" sx={{ backgroundColor: '#F3E8FF', color: '#6B21A8', fontWeight: 800, fontSize: '11px', border: '1px solid #E9D5FF' }} />;
      case 'SENT':
        return <Chip label="Sent / Dispatched" size="small" sx={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: '11px', border: '1px solid #BFDBFE' }} />;
      case 'COMPLETED':
        return <Chip label="Completed" size="small" sx={{ backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 800, fontSize: '11px', border: '1px solid #BBF7D0' }} />;
      case 'REJECTED':
        return <Chip label="Rejected" size="small" sx={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: 800, fontSize: '11px', border: '1px solid #FECACA' }} />;
      default:
        return <Chip label={s} size="small" sx={{ fontWeight: 800, fontSize: '11px' }} />;
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 2, sm: 2.5, md: 3 }, boxSizing: 'border-box' }}>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          mb: 3,
        }}
      >
        {/* Top Header Banner - Clean Solid Blue (No Gradient) */}
        <Box
          sx={{
            backgroundColor: '#1D4ED8',
            px: { xs: 2, sm: 3 },
            py: 1.8,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 900, letterSpacing: '-0.01em' }}>
              PRODUCT CATALOG & ONLINE ORDERING
            </Typography>
            <Typography sx={{ color: '#BFDBFE', fontSize: '12.5px', fontWeight: 500, mt: 0.3 }}>
              Select items, enter quantities, and place your product requirement directly with GPK Crackers.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                px: 1.5,
                py: 0.5,
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 700,
              }}
            >
              Customer: <span style={{ color: '#FEF08A' }}>{customerName}</span>
            </Box>
          </Box>
        </Box>

        {/* Sub-Tab Navigation Bar */}
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.2,
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant={activeSubTab === 'order' ? 'contained' : 'outlined'}
              disableElevation
              onClick={() => setActiveSubTab('order')}
              startIcon={<ShoppingCartRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                backgroundColor: activeSubTab === 'order' ? '#1D4ED8' : 'transparent',
                borderColor: '#1D4ED8',
                color: activeSubTab === 'order' ? '#FFFFFF' : '#1D4ED8',
                fontSize: '12.5px',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '7px',
                px: 2,
                height: '36px',
                '&:hover': {
                  backgroundColor: activeSubTab === 'order' ? '#1E40AF' : '#EFF6FF',
                },
              }}
            >
              Order Products ({filteredProducts.length})
            </Button>

            <Button
              variant={activeSubTab === 'my-orders' ? 'contained' : 'outlined'}
              disableElevation
              onClick={() => {
                setActiveSubTab('my-orders');
                fetchMyOrders();
              }}
              startIcon={<ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                backgroundColor: activeSubTab === 'my-orders' ? '#1D4ED8' : 'transparent',
                borderColor: '#1D4ED8',
                color: activeSubTab === 'my-orders' ? '#FFFFFF' : '#1D4ED8',
                fontSize: '12.5px',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '7px',
                px: 2,
                height: '36px',
                '&:hover': {
                  backgroundColor: activeSubTab === 'my-orders' ? '#1E40AF' : '#EFF6FF',
                },
              }}
            >
              My Orders {myOrders.length > 0 && `(${myOrders.length})`}
            </Button>
          </Box>

          {/* Quick Active Selection Badge when on 'order' tab */}
          {activeSubTab === 'order' && orderSummary.totalItems > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                px: 1.5,
                py: 0.5,
              }}
            >
              <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#1D4ED8' }}>
                Cart: <strong>{orderSummary.totalItems}</strong> items | <strong>{orderSummary.totalCases}</strong> cases
              </Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 900, color: '#166534' }}>
                ₹ {orderSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ============================================================== */}
        {/* SUBTAB 1: ORDER PRODUCTS                                       */}
        {/* ============================================================== */}
        {activeSubTab === 'order' && (
          <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
            {/* Filter Bar */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 2.5,
              }}
            >
              {/* Company Filter & Search */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                {/* Searchable Company Dropdown with 7 visible items & clean alignment */}
                <Autocomplete
                  size="small"
                  options={availableCompanies}
                  value={selectedCompany || null}
                  onChange={(_, val) => handleCompanyChange(val || '')}
                  isOptionEqualToValue={(option, val) => option === val}
                  slotProps={{
                    listbox: {
                      sx: {
                        maxHeight: '252px', // 7 items * 36px
                        '& .MuiAutocomplete-option': {
                          minHeight: '36px',
                          fontSize: '13px',
                          fontWeight: 600,
                        },
                      },
                    },
                  }}
                  sx={{
                    minWidth: { xs: '100%', sm: 250 },
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Company *"
                      placeholder="Type to search company..."
                      slotProps={{
                        inputLabel: {
                          shrink: true,
                          sx: {
                            fontSize: '13px',
                            fontWeight: 700,
                            color: !selectedCompany ? '#D97706 !important' : '#64748B',
                          },
                        },
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: '40px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          '& fieldset': {
                            borderColor: !selectedCompany ? '#F59E0B !important' : '#CBD5E1',
                            borderWidth: !selectedCompany ? '1.5px !important' : '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: !selectedCompany ? '#D97706 !important' : '#1D4ED8 !important',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#1D4ED8 !important',
                          },
                        },
                      }}
                    />
                  )}
                />

                {/* Product Search Box */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    px: 1.2,
                    height: '40px',
                    width: { xs: '100%', sm: '260px' },
                    boxSizing: 'border-box',
                  }}
                >
                  <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 19, mr: 0.8 }} />
                  <InputBase
                    placeholder="Search by product name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#0F172A',
                      width: '100%',
                      '& input::placeholder': { color: '#94A3B8', opacity: 1 },
                    }}
                  />
                  {searchTerm && (
                    <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ p: 0.4 }}>
                      <ClearRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Reset Quantities Button */}
              {orderSummary.totalItems > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleClearAll}
                  startIcon={<ClearRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    borderColor: '#CBD5E1',
                    color: '#64748B',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    '&:hover': { borderColor: '#EF4444', color: '#DC2626', backgroundColor: '#FEF2F2' },
                  }}
                >
                  Clear Selection
                </Button>
              )}
            </Box>

            {/* Active Company Banner */}
            {selectedCompany ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#EFF6FF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: '8px',
                  p: 1.2,
                  px: 2,
                  mb: 2,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessRoundedIcon sx={{ fontSize: 20, color: '#1D4ED8' }} />
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E3A8A' }}>
                    Active Company:
                  </Typography>
                  <Chip
                    label={selectedCompany}
                    size="small"
                    sx={{
                      backgroundColor: '#1D4ED8',
                      color: '#FFFFFF',
                      fontWeight: 900,
                      fontSize: '12px',
                    }}
                  />
                  <Typography sx={{ fontSize: '12px', color: '#64748B', ml: 0.5 }}>
                    ({filteredProducts.length} products available)
                  </Typography>
                </Box>
                {orderSummary.totalItems > 0 && (
                  <Chip
                    label={`${orderSummary.totalCases} cases selected • ₹ ${orderSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    size="small"
                    sx={{
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      fontWeight: 800,
                      fontSize: '11.5px',
                      border: '1px solid #86EFAC',
                    }}
                  />
                )}
              </Box>
            ) : null}

            {/* Products Order Table */}
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                border: '1.5px solid #0F172A',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#0F172A' }}>
                    <TableCell
                      align="center"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '11.5px',
                        py: 1.2,
                        width: '7%',
                        letterSpacing: '0.03em',
                        borderRight: '1px solid #1E293B',
                      }}
                    >
                      SL.NO
                    </TableCell>
                    <TableCell
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '11.5px',
                        py: 1.2,
                        width: '43%',
                        letterSpacing: '0.03em',
                        borderRight: '1px solid #1E293B',
                      }}
                    >
                      PRODUCT NAME
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '11.5px',
                        py: 1.2,
                        width: '10%',
                        letterSpacing: '0.03em',
                        borderRight: '1px solid #1E293B',
                      }}
                    >
                      CASE
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '11.5px',
                        py: 1.2,
                        width: '12%',
                        letterSpacing: '0.03em',
                        borderRight: '1px solid #1E293B',
                        paddingRight: 2,
                      }}
                    >
                      RATE (₹)
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '11.5px',
                        py: 1.2,
                        width: '14%',
                        letterSpacing: '0.03em',
                        borderRight: '1px solid #1E293B',
                      }}
                    >
                      QUANTITY
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '11.5px',
                        py: 1.2,
                        width: '14%',
                        letterSpacing: '0.03em',
                        paddingRight: 2,
                      }}
                    >
                      TOTAL (₹)
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#1D4ED8' }} />
                        <Typography sx={{ mt: 1, fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
                          Loading product catalog...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : !selectedCompany ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, px: 2, backgroundColor: '#F8FAFC' }}>
                        <Box sx={{ maxWidth: '640px', mx: 'auto', textAlign: 'center' }}>
                          <Box
                            sx={{
                              width: 58,
                              height: 58,
                              borderRadius: '50%',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mb: 1.5,
                            }}
                          >
                            <BusinessRoundedIcon sx={{ fontSize: 32 }} />
                          </Box>
                          <Typography sx={{ fontSize: '17px', fontWeight: 900, color: '#0F172A', mb: 0.5 }}>
                            Please Select a Company to Add Products
                          </Typography>
                          <Typography sx={{ fontSize: '13px', color: '#64748B', mb: 2.5 }}>
                            Select a specific company from the dropdown above or click on one below to view products:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {availableCompanies.map((cName) => (
                              <Button
                                key={cName}
                                variant="outlined"
                                size="small"
                                onClick={() => handleCompanyChange(cName)}
                                sx={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  textTransform: 'none',
                                  borderColor: '#CBD5E1',
                                  color: '#0F172A',
                                  backgroundColor: '#FFFFFF',
                                  borderRadius: '6px',
                                  py: 0.6,
                                  px: 1.6,
                                  '&:hover': {
                                    borderColor: '#1D4ED8',
                                    backgroundColor: '#EFF6FF',
                                    color: '#1D4ED8',
                                  },
                                }}
                              >
                                🏢 {cName}
                              </Button>
                            ))}
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748B' }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                          No products found for "{selectedCompany}".
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((p, index) => {
                      const pKey = p._id || p.id || String(p.slNo);
                      const qty = quantities[pKey] || 0;
                      const rate = p.rate || 0;
                      const pktNum = parseFloat(p.pktUnit || '1') || 1;
                      const lineTotal = qty * rate * pktNum;
                      const isSelected = qty > 0;

                      return (
                        <TableRow
                          key={pKey}
                          sx={{
                            backgroundColor: isSelected ? '#EFF6FF' : index % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                            transition: 'background-color 0.15s ease',
                            '&:hover': {
                              backgroundColor: isSelected ? '#DBEAFE' : '#F1F5F9',
                            },
                          }}
                        >
                          {/* SL.NO */}
                          <TableCell
                            align="center"
                            sx={{
                              py: 1.2,
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#334155',
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                            }}
                          >
                            {p.slNo || index + 1}
                          </TableCell>

                          {/* PRODUCT NAME */}
                          <TableCell
                            sx={{
                              py: 1.2,
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: '#0F172A',
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <span>{p.name}</span>
                              {p.company && (
                                <Chip
                                  label={p.company}
                                  size="small"
                                  sx={{
                                    height: '20px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    backgroundColor: '#E0F2FE',
                                    color: '#0369A1',
                                    border: '1px solid #BAE6FD',
                                  }}
                                />
                              )}
                              {pktNum > 1 && (
                                <Typography sx={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                                  ({pktNum} pkts/box)
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          {/* CASE */}
                          <TableCell
                            align="center"
                            sx={{
                              py: 1.2,
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#334155',
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                            }}
                          >
                            {p.caseCount !== undefined && p.caseCount !== null && p.caseCount > 0
                              ? p.caseCount
                              : '-'}
                          </TableCell>

                          {/* RATE */}
                          <TableCell
                            align="right"
                            sx={{
                              py: 1.2,
                              fontSize: '13.5px',
                              fontWeight: 800,
                              color: '#0F172A',
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              paddingRight: 2,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ₹ {rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          {/* QUANTITY - Manual Numeric Input */}
                          <TableCell
                            align="center"
                            sx={{
                              py: 0.8,
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={() => decrementQty(pKey)}
                                disabled={qty === 0}
                                sx={{
                                  p: 0.4,
                                  backgroundColor: qty > 0 ? '#E2E8F0' : '#F1F5F9',
                                  color: qty > 0 ? '#0F172A' : '#94A3B8',
                                  borderRadius: '4px',
                                }}
                              >
                                <RemoveRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>

                              <TextField
                                size="small"
                                type="number"
                                value={qty === 0 ? '' : qty}
                                placeholder="0"
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  handleQuantityChange(pKey, e.target.value)
                                }
                                slotProps={{
                                  htmlInput: {
                                    min: 0,
                                    style: {
                                      textAlign: 'center',
                                      padding: '5px 4px',
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      width: '56px',
                                    },
                                  },
                                }}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: isSelected ? '#FFFFFF' : '#F8FAFC',
                                    borderRadius: '6px',
                                    borderColor: isSelected ? '#1D4ED8' : '#CBD5E1',
                                    '&.Mui-focused fieldset': {
                                      borderColor: '#1D4ED8',
                                    },
                                  },
                                }}
                              />

                              <IconButton
                                size="small"
                                onClick={() => incrementQty(pKey)}
                                sx={{
                                  p: 0.4,
                                  backgroundColor: '#DBEAFE',
                                  color: '#1D4ED8',
                                  borderRadius: '4px',
                                  '&:hover': { backgroundColor: '#BFDBFE' },
                                }}
                              >
                                <AddRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          </TableCell>

                          {/* TOTAL - Automatically Calculated */}
                          <TableCell
                            align="right"
                            sx={{
                              py: 1.2,
                              fontSize: '13.5px',
                              fontWeight: 900,
                              color: isSelected ? '#1D4ED8' : '#64748B',
                              borderBottom: '1px solid #E2E8F0',
                              paddingRight: 2,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ₹ {lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Sticky / Pinned Order Summary Bottom Bar */}
            <Box
              sx={{
                position: 'sticky',
                bottom: 12,
                mt: 3,
                zIndex: 10,
                backgroundColor: '#0F172A',
                borderRadius: '10px',
                p: { xs: 1.8, sm: 2 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 4 }, flexWrap: 'wrap' }}>
                <Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Products Selected
                  </Typography>
                  <Typography sx={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 900 }}>
                    {orderSummary.totalItems} items
                  </Typography>
                </Box>

                <Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Quantity / Cases
                  </Typography>
                  <Typography sx={{ color: '#60A5FA', fontSize: '16px', fontWeight: 900 }}>
                    {orderSummary.totalCases}
                  </Typography>
                </Box>

                <Box>
                  <Typography sx={{ color: '#94A3B8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Order Total Value
                  </Typography>
                  <Typography sx={{ color: '#4ADE80', fontSize: '19px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                    ₹ {orderSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {orderSummary.totalItems > 0 && (
                  <Button
                    variant="outlined"
                    onClick={handleClearAll}
                    sx={{
                      borderColor: '#475569',
                      color: '#E2E8F0',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: '6px',
                      '&:hover': { borderColor: '#EF4444', color: '#F87171' },
                    }}
                  >
                    Clear All
                  </Button>
                )}

                <Button
                  variant="contained"
                  disableElevation
                  disabled={orderSummary.totalItems === 0}
                  onClick={() => setCheckoutOpen(true)}
                  startIcon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    backgroundColor: '#1D4ED8 !important',
                    color: '#FFFFFF !important',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    textTransform: 'none',
                    px: 3,
                    py: 1,
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    opacity: orderSummary.totalItems === 0 ? 0.5 : 1,
                    '&:hover': {
                      backgroundColor: '#1E40AF !important',
                    },
                  }}
                >
                  Place Order ({orderSummary.totalItems})
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* ============================================================== */}
        {/* SUBTAB 2: MY ORDERS (HISTORY)                                  */}
        {/* ============================================================== */}
        {activeSubTab === 'my-orders' && (
          <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                Your Placed Orders ({myOrders.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={fetchMyOrders}
                disabled={loadingOrders}
                sx={{
                  borderColor: '#CBD5E1',
                  color: '#1D4ED8',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '6px',
                }}
              >
                Refresh Orders
              </Button>
            </Box>

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      ORDER #
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      DATE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      COMPANY
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      ITEMS
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      TOTAL CASES
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      TOTAL AMOUNT (₹)
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      STATUS
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: '12px', color: '#475569', py: 1.2 }}>
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {loadingOrders ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                        <CircularProgress size={28} sx={{ color: '#1D4ED8' }} />
                        <Typography sx={{ mt: 1, fontSize: '12.5px', color: '#64748B' }}>
                          Loading order history...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : myOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748B' }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                          You have not placed any orders yet.
                        </Typography>
                        <Button
                          variant="contained"
                          disableElevation
                          onClick={() => setActiveSubTab('order')}
                          sx={{
                            mt: 1.5,
                            backgroundColor: '#1D4ED8',
                            color: '#FFFFFF',
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: '6px',
                          }}
                        >
                          Browse Products & Order Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    myOrders.map((order, idx) => (
                      <TableRow key={order._id || order.id || idx} sx={{ '&:hover': { backgroundColor: '#F8FAFC' } }}>
                        <TableCell sx={{ fontWeight: 800, color: '#1D4ED8', fontSize: '13px' }}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell sx={{ fontSize: '12.5px', color: '#334155' }}>
                          {order.date}
                        </TableCell>
                        <TableCell sx={{ fontSize: '12.5px', color: '#475569' }}>
                          {order.companyName || '-'}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '12.5px', fontWeight: 700 }}>
                          {order.products?.length || 0}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                          {order.totalCases}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '13.5px', fontWeight: 900, color: '#166534', whiteSpace: 'nowrap' }}>
                          ₹ {order.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center">
                          {getStatusChip(order.status)}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setSelectedOrderForView(order)}
                            startIcon={<VisibilityRoundedIcon sx={{ fontSize: 15 }} />}
                            sx={{
                              borderColor: '#1D4ED8',
                              color: '#1D4ED8',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              textTransform: 'none',
                              borderRadius: '5px',
                              py: 0.3,
                              px: 1,
                              '&:hover': { backgroundColor: '#EFF6FF' },
                            }}
                          >
                            View Items
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* ============================================================== */}
      {/* CHECKOUT / ORDER CONFIRMATION DIALOG                          */}
      {/* ============================================================== */}
      <Dialog
        open={checkoutOpen}
        onClose={() => !submittingOrder && setCheckoutOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: '12px', overflow: 'hidden' } },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: '#1D4ED8',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '16px',
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Confirm & Place Product Order</span>
          <IconButton
            size="small"
            onClick={() => setCheckoutOpen(false)}
            disabled={submittingOrder}
            sx={{ color: '#FFFFFF' }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '13px', color: '#475569' }}>
              Customer: <strong style={{ color: '#0F172A' }}>{customerName}</strong> | Date:{' '}
              <strong style={{ color: '#0F172A' }}>{new Date().toLocaleDateString('en-GB')}</strong>
            </Typography>
          </Box>

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ border: '1px solid #CBD5E1', borderRadius: '6px', maxHeight: '340px' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#0F172A' }}>
                  <TableCell sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '8%' }}>
                    SL.NO
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '46%' }}>
                    PRODUCT NAME
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '12%' }}>
                    CASE
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '14%' }}>
                    RATE (₹)
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '10%' }}>
                    QTY
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '18%' }}>
                    TOTAL (₹)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderSummary.selectedList.map((item, idx) => (
                  <TableRow key={item.product._id || idx}>
                    <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                      {item.product.name}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '12px' }}>
                      {item.product.caseCount || '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      ₹ {item.product.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 800, color: '#1D4ED8' }}>
                      {item.quantity}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '13px', fontWeight: 900, whiteSpace: 'nowrap', color: '#0F172A' }}>
                      ₹ {item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals Summary */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              p: 1.5,
              mt: 2,
            }}
          >
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
              Total Ordered Cases: <strong style={{ color: '#0F172A' }}>{orderSummary.totalCases}</strong>
            </Typography>
            <Typography sx={{ fontSize: '16px', fontWeight: 900, color: '#1D4ED8' }}>
              Grand Total: ₹ {orderSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>

          {/* Optional Notes */}
          <TextField
            fullWidth
            size="small"
            label="Order Notes / Delivery Instructions (Optional)"
            placeholder="e.g. Please deliver by lorry / urgent requirement..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
          <Button
            onClick={() => setCheckoutOpen(false)}
            disabled={submittingOrder}
            sx={{ color: '#64748B', fontWeight: 700, textTransform: 'none' }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            disableElevation
            onClick={handleConfirmOrder}
            disabled={submittingOrder}
            sx={{
              backgroundColor: '#1D4ED8 !important',
              color: '#FFFFFF !important',
              fontWeight: 800,
              textTransform: 'none',
              px: 3,
              borderRadius: '6px',
            }}
          >
            {submittingOrder ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Confirm & Submit Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* VIEW ORDER ITEMS DIALOG                                        */}
      {/* ============================================================== */}
      <Dialog
        open={Boolean(selectedOrderForView)}
        onClose={() => setSelectedOrderForView(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: '12px', overflow: 'hidden' } },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '16px',
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Order Details: {selectedOrderForView?.orderNumber}</span>
          <IconButton
            size="small"
            onClick={() => setSelectedOrderForView(null)}
            sx={{ color: '#FFFFFF' }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          {selectedOrderForView && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: '13px', color: '#475569' }}>
                    Customer: <strong style={{ color: '#0F172A' }}>{selectedOrderForView.customerName}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                    Date: {selectedOrderForView.date} | Company: {selectedOrderForView.companyName || '-'}
                  </Typography>
                  {selectedOrderForView.performaNumber && (
                    <Typography sx={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 700 }}>
                      Linked Performa: #{selectedOrderForView.performaNumber}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '12px', color: '#475569', mb: 0.5 }}>Status:</Typography>
                  {getStatusChip(selectedOrderForView.status)}
                </Box>
              </Box>

              {/* 5-Stage Live Order Status Progression */}
              <Box
                sx={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  p: 2,
                  mb: 2.5,
                }}
              >
                <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', mb: 1.5, letterSpacing: '0.05em' }}>
                  Live Order Status & Progress Tracker
                </Typography>

                {(() => {
                  const s = (selectedOrderForView.status || 'PENDING').toUpperCase();
                  const stages = [
                    { key: 'PENDING', label: '1. Order Placed', desc: 'Received from you', color: '#16A34A' },
                    { key: 'SEEN', label: '2. Seen by Admin', desc: 'Order opened & viewed', color: '#0284C7' },
                    { key: 'VERIFIED', label: '3. Verified', desc: 'Stock & cases checked', color: '#7C3AED' },
                    { key: 'SENT', label: '4. Dispatched / Sent', desc: 'Goods on the way', color: '#1D4ED8' },
                    { key: 'COMPLETED', label: '5. Completed', desc: 'Delivered & finalized', color: '#16A34A' },
                  ];

                  const getStageIndex = (st: string) => {
                    if (st === 'PENDING') return 0;
                    if (st === 'SEEN') return 1;
                    if (st === 'VERIFIED') return 2;
                    if (st === 'SENT') return 3;
                    if (st === 'COMPLETED') return 4;
                    return -1;
                  };

                  const currentIndex = getStageIndex(s);
                  const isRejected = s === 'REJECTED';

                  if (isRejected) {
                    return (
                      <Box sx={{ p: 1.5, backgroundColor: '#FEE2E2', borderRadius: '6px', border: '1px solid #FCA5A5', color: '#991B1B', fontWeight: 700, fontSize: '13px' }}>
                        ⚠️ This order was cancelled or rejected by Admin. Please contact wholesale support.
                      </Box>
                    );
                  }

                  return (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(5, 1fr)' },
                        gap: 1,
                      }}
                    >
                      {stages.map((stg, idx) => {
                        const isDone = currentIndex >= idx;
                        const isCurrent = currentIndex === idx;

                        return (
                          <Box
                            key={stg.key}
                            sx={{
                              p: 1.2,
                              borderRadius: '6px',
                              textAlign: 'center',
                              border: isCurrent
                                ? `2px solid ${stg.color}`
                                : isDone
                                  ? '1px solid #86EFAC'
                                  : '1px dashed #CBD5E1',
                              backgroundColor: isCurrent
                                ? '#F0F9FF'
                                : isDone
                                  ? '#F0FDF4'
                                  : '#F8FAFC',
                              boxShadow: isCurrent ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: '11.5px',
                                fontWeight: isCurrent ? 900 : isDone ? 700 : 500,
                                color: isCurrent ? stg.color : isDone ? '#166534' : '#94A3B8',
                              }}
                            >
                              {isDone && !isCurrent ? '✓ ' : ''}{stg.label}
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#64748B', mt: 0.3 }}>
                              {stg.desc}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })()}
              </Box>

              <TableContainer
                component={Paper}
                elevation={0}
                sx={{ border: '1px solid #CBD5E1', borderRadius: '6px', maxHeight: '350px' }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#0F172A' }}>
                      <TableCell sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '8%' }}>
                        SL.NO
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '46%' }}>
                        PRODUCT NAME
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '12%' }}>
                        CASE
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '14%' }}>
                        RATE (₹)
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '10%' }}>
                        QUANTITY
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', width: '18%' }}>
                        TOTAL (₹)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedOrderForView.products || []).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>{item.slNo || idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                          {item.productName}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '12px' }}>
                          {item.caseCount || '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          ₹ {item.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 800, color: '#1D4ED8' }}>
                          {item.quantity}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '13px', fontWeight: 900, whiteSpace: 'nowrap', color: '#0F172A' }}>
                          ₹ {item.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  p: 1.5,
                  mt: 2,
                }}
              >
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                  Total Cases: <strong style={{ color: '#0F172A' }}>{selectedOrderForView.totalCases}</strong>
                </Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 900, color: '#166534' }}>
                  Total Value: ₹ {selectedOrderForView.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              {selectedOrderForView.notes && (
                <Box sx={{ mt: 1.5, p: 1.2, backgroundColor: '#FEF9C3', borderRadius: '6px', border: '1px solid #FEF08A' }}>
                  <Typography sx={{ fontSize: '12px', color: '#854D0E' }}>
                    <strong>Notes:</strong> {selectedOrderForView.notes}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
          <Button
            onClick={() => setSelectedOrderForView(null)}
            sx={{ color: '#1D4ED8', fontWeight: 700, textTransform: 'none' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Alert */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: '100%', fontWeight: 700 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
