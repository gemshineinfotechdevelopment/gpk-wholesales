import { useState, useEffect, useMemo, type FC } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import { OrdersApi, type CustomerOrder } from '../services/api';

interface SuperadminOrdersModalProps {
  open: boolean;
  onClose: () => void;
  userRole?: string;
}

export const SuperadminOrdersModal: FC<SuperadminOrdersModalProps> = ({ open, onClose, userRole }) => {
  const isSuperAdmin = userRole ? userRole === 'superadmin' : true;
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await OrdersApi.getAll();
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch customer orders for admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchOrders();
    }
  }, [open]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term) ||
          (o.customerMobile && o.customerMobile.includes(term)) ||
          (o.companyName && o.companyName.toLowerCase().includes(term))
      );
    }
    return list;
  }, [orders, statusFilter, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    let totalCases = 0;
    let totalValue = 0;
    let pendingCount = 0;

    orders.forEach((o) => {
      totalCases += o.totalCases || 0;
      totalValue += o.totalAmount || 0;
      if (o.status === 'PENDING') pendingCount += 1;
    });

    return {
      totalOrders: orders.length,
      pendingCount,
      totalCases,
      totalValue,
    };
  }, [orders]);

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: 'PENDING' | 'SEEN' | 'VERIFIED' | 'SENT' | 'COMPLETED' | 'REJECTED'
  ) => {
    try {
      setUpdatingId(orderId);
      await OrdersApi.updateStatus(orderId, newStatus as any);
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId || o.id === orderId
            ? { ...o, status: newStatus }
            : o
        )
      );
      if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: newStatus } : null
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleAdminApproval = async (orderId: string, approved: boolean) => {
    try {
      setUpdatingId(orderId);
      await OrdersApi.updateApproval(orderId, approved);
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId || o.id === orderId
            ? { ...o, approvedForAdmin: approved, isApproved: approved }
            : o
        )
      );
      if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, approvedForAdmin: approved, isApproved: approved } : null
        );
      }
    } catch (err) {
      console.error('Failed to update admin approval:', err);
      alert('Failed to update admin view approval');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string, orderNum: string) => {
    if (!window.confirm(`Are you sure you want to delete Order #${orderNum}?`)) return;
    try {
      await OrdersApi.delete(orderId);
      setOrders((prev) => prev.filter((o) => o._id !== orderId && o.id !== orderId));
      if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Failed to delete order:', err);
      alert('Failed to delete order');
    }
  };

  const getStatusChip = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'PENDING':
        return <Chip label="ORDER PLACED" size="small" sx={{ backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 800, fontSize: '11px', border: '1.5px solid #16A34A' }} />;
      case 'SEEN':
        return <Chip label="SEEN" size="small" sx={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontWeight: 800, fontSize: '11px', border: '1px solid #BAE6FD' }} />;
      case 'VERIFIED':
        return <Chip label="VERIFIED" size="small" sx={{ backgroundColor: '#F3E8FF', color: '#6B21A8', fontWeight: 800, fontSize: '11px', border: '1px solid #E9D5FF' }} />;
      case 'SENT':
        return <Chip label="SENT / DISPATCHED" size="small" sx={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: '11px', border: '1px solid #BFDBFE' }} />;
      case 'COMPLETED':
        return <Chip label="COMPLETED" size="small" sx={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 800, fontSize: '11px', border: '1px solid #BBF7D0' }} />;
      case 'REJECTED':
        return <Chip label="REJECTED" size="small" sx={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: 800, fontSize: '11px', border: '1px solid #FECACA' }} />;
      default:
        return <Chip label={s} size="small" sx={{ fontWeight: 800, fontSize: '11px' }} />;
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: '12px', overflow: 'hidden', minHeight: '80vh' } },
        }}
      >
        {/* Header - Solid Blue (No Gradient) */}
        <DialogTitle
          sx={{
            backgroundColor: '#1D4ED8',
            color: '#FFFFFF',
            py: 1.8,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <ShoppingBagRoundedIcon sx={{ fontSize: 24, color: '#FEF08A' }} />
            <Box>
              <Typography sx={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 900 }}>
                CUSTOMER ONLINE ORDERS
              </Typography>
              <Typography sx={{ color: '#BFDBFE', fontSize: '12px', fontWeight: 500 }}>
                Review and manage all product orders placed by customers
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              onClick={fetchOrders}
              startIcon={<RefreshRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                color: '#FFFFFF',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '12px',
                borderRadius: '6px',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
              }}
            >
              Refresh
            </Button>
            <IconButton onClick={onClose} sx={{ color: '#FFFFFF' }}>
              <CloseRoundedIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#F8FAFC' }}>
          {/* Top KPI Summary Metrics */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Total Orders
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', mt: 0.3 }}>
                {metrics.totalOrders}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #FEF08A', borderRadius: '8px', backgroundColor: '#FEFCE8' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#A16207', textTransform: 'uppercase' }}>
                Pending Orders
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#CA8A04', mt: 0.3 }}>
                {metrics.pendingCount}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Total Cases Ordered
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#1D4ED8', mt: 0.3 }}>
                {metrics.totalCases}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #DCFCE7', borderRadius: '8px', backgroundColor: '#F0FDF4' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#15803D', textTransform: 'uppercase' }}>
                Total Orders Value
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#16A34A', mt: 0.3, whiteSpace: 'nowrap' }}>
                ₹ {metrics.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </Paper>
          </Box>

          {/* Filter Bar */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 2.5,
            }}
          >
            {/* Search Input */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                px: 1.5,
                height: '40px',
                width: { xs: '100%', sm: '320px' },
                boxSizing: 'border-box',
              }}
            >
              <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 19, mr: 0.8 }} />
              <InputBase
                placeholder="Search order #, customer name, mobile..."
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

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="order-status-filter-label" sx={{ fontSize: '13px', fontWeight: 600 }}>
                Filter Status
              </InputLabel>
              <Select
                labelId="order-status-filter-label"
                value={statusFilter}
                label="Filter Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                }}
              >
                <MenuItem value="ALL">All Statuses ({orders.length})</MenuItem>
                <MenuItem value="PENDING">Order Placed ({orders.filter(o => o.status === 'PENDING').length})</MenuItem>
                <MenuItem value="SEEN">Seen ({orders.filter(o => o.status === 'SEEN').length})</MenuItem>
                <MenuItem value="VERIFIED">Verified ({orders.filter(o => o.status === 'VERIFIED').length})</MenuItem>
                <MenuItem value="SENT">Sent / Dispatched ({orders.filter(o => o.status === 'SENT').length})</MenuItem>
                <MenuItem value="COMPLETED">Completed ({orders.filter(o => o.status === 'COMPLETED').length})</MenuItem>
                <MenuItem value="REJECTED">Rejected ({orders.filter(o => o.status === 'REJECTED').length})</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Orders Master Table */}
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#0F172A' }}>
                  <TableCell sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '11%' }}>
                    ORDER #
                  </TableCell>
                  <TableCell sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '9%' }}>
                    DATE
                  </TableCell>
                  <TableCell sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '18%' }}>
                    CUSTOMER NAME
                  </TableCell>
                  <TableCell sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '12%' }}>
                    COMPANY
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '7%' }}>
                    CASES
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '11%' }}>
                    TOTAL VALUE (₹)
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '13%' }}>
                    STATUS
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '11%' }}>
                    ADMIN ACCESS
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: '11px', py: 1.2, width: '8%' }}>
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={30} sx={{ color: '#1D4ED8' }} />
                      <Typography sx={{ mt: 1, fontSize: '13px', color: '#64748B' }}>
                        Loading customer orders...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6, color: '#64748B' }}>
                      <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                        No customer orders found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((o, idx) => (
                    <TableRow key={o._id || o.id || idx} sx={{ '&:hover': { backgroundColor: '#F8FAFC' } }}>
                      <TableCell sx={{ fontWeight: 800, color: '#1D4ED8', fontSize: '13px' }}>
                        {o.orderNumber}
                        {o.performaNumber && (
                          <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>
                            PF: #{o.performaNumber}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '12.5px', color: '#334155' }}>
                        {o.date}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                        {o.customerName}
                        {o.customerMobile && (
                          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                            {o.customerMobile}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '12.5px', color: '#475569' }}>
                        {o.companyName || '-'}
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: '13px', color: '#0F172A' }}>
                        {o.totalCases}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, fontSize: '13.5px', color: '#166534', whiteSpace: 'nowrap' }}>
                        ₹ {o.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <Select
                          size="small"
                          value={o.status || 'PENDING'}
                          disabled={updatingId === (o._id || o.id)}
                          onChange={(e) =>
                            handleUpdateStatus(o._id || o.id || '', e.target.value as any)
                          }
                          sx={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            height: '30px',
                            minWidth: '140px',
                            borderRadius: '6px',
                            backgroundColor:
                              o.status === 'SEEN'
                                ? '#E0F2FE'
                                : o.status === 'VERIFIED'
                                ? '#F3E8FF'
                                : o.status === 'SENT'
                                ? '#DBEAFE'
                                : o.status === 'COMPLETED'
                                ? '#DCFCE7'
                                : o.status === 'REJECTED'
                                ? '#FEE2E2'
                                : '#DCFCE7',
                            color:
                              o.status === 'SEEN'
                                ? '#0369A1'
                                : o.status === 'VERIFIED'
                                ? '#6B21A8'
                                : o.status === 'SENT'
                                ? '#1D4ED8'
                                : o.status === 'COMPLETED'
                                ? '#166534'
                                : o.status === 'REJECTED'
                                ? '#991B1B'
                                : '#15803D',
                            border:
                              o.status === 'PENDING'
                                ? '1.5px solid #16A34A'
                                : '1px solid #CBD5E1',
                            '& .MuiSelect-select': { py: 0.4, px: 1 },
                          }}
                        >
                          <MenuItem value="PENDING">ORDER PLACED</MenuItem>
                          <MenuItem value="SEEN">SEEN</MenuItem>
                          <MenuItem value="VERIFIED">VERIFIED</MenuItem>
                          <MenuItem value="SENT">SENT / DISPATCHED</MenuItem>
                          <MenuItem value="COMPLETED">COMPLETED</MenuItem>
                          <MenuItem value="REJECTED">REJECTED</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell align="center">
                        {isSuperAdmin ? (
                          o.approvedForAdmin ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
                              <Chip
                                label="✓ Admin Can View"
                                size="small"
                                sx={{
                                  backgroundColor: '#DCFCE7',
                                  color: '#166534',
                                  fontWeight: 800,
                                  fontSize: '10px',
                                  border: '1px solid #86EFAC',
                                }}
                              />
                              <Button
                                size="small"
                                variant="text"
                                disabled={updatingId === (o._id || o.id)}
                                onClick={() => handleToggleAdminApproval(o._id || o.id || '', false)}
                                sx={{
                                  fontSize: '9.5px',
                                  color: '#EF4444',
                                  p: 0,
                                  textTransform: 'none',
                                  minWidth: 'auto',
                                  '&:hover': { background: 'transparent', textDecoration: 'underline' },
                                }}
                              >
                                Revoke
                              </Button>
                            </Box>
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              disableElevation
                              disabled={updatingId === (o._id || o.id)}
                              onClick={() => handleToggleAdminApproval(o._id || o.id || '', true)}
                              sx={{
                                backgroundColor: '#16A34A !important',
                                color: '#FFFFFF',
                                fontWeight: 800,
                                fontSize: '10.5px',
                                textTransform: 'none',
                                py: 0.3,
                                px: 1,
                                borderRadius: '5px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Approve for Admin
                            </Button>
                          )
                        ) : (
                          <Chip
                            label="✓ Approved"
                            size="small"
                            sx={{
                              backgroundColor: '#F0FDF4',
                              color: '#166534',
                              fontWeight: 800,
                              fontSize: '10px',
                              border: '1px solid #BBF7D0',
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setSelectedOrder(o)}
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
                            View
                          </Button>

                          {isSuperAdmin && (
                            <Tooltip title="Delete Order">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteOrder(o._id || o.id || '', o.orderNumber)}
                                sx={{ color: '#EF4444', p: 0.4 }}
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
          <Button
            onClick={onClose}
            sx={{ color: '#1D4ED8', fontWeight: 700, textTransform: 'none' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Ordered Products Modal */}
      <Dialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
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
          <span>Order Products: #{selectedOrder?.orderNumber}</span>
          <IconButton size="small" onClick={() => setSelectedOrder(null)} sx={{ color: '#FFFFFF' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          {selectedOrder && (
            <>
              {/* Customer Info Card */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  p: 1.8,
                  mb: 2,
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    {selectedOrder.customerName}
                  </Typography>
                  {selectedOrder.customerMobile && (
                    <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                      Phone: <strong>{selectedOrder.customerMobile}</strong>
                    </Typography>
                  )}
                  {selectedOrder.customerAddress && (
                    <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                      Address: {selectedOrder.customerAddress}
                    </Typography>
                  )}
                  {selectedOrder.notes && (
                    <Typography sx={{ fontSize: '12px', color: '#854D0E', mt: 0.5, fontWeight: 600 }}>
                      Notes: {selectedOrder.notes}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '12px', color: '#475569' }}>
                    Date: <strong>{selectedOrder.date}</strong>
                  </Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    {getStatusChip(selectedOrder.status)}
                    {selectedOrder.approvedForAdmin ? (
                      <Chip
                        label="✓ Approved for Admin View"
                        size="small"
                        sx={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 800, fontSize: '10.5px', border: '1px solid #86EFAC' }}
                      />
                    ) : (
                      <Chip
                        label="Super Admin Only"
                        size="small"
                        sx={{ backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 800, fontSize: '10.5px', border: '1px solid #FDE68A' }}
                      />
                    )}
                  </Box>
                  {selectedOrder.performaNumber && (
                    <Typography sx={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 800, mt: 0.5 }}>
                      Linked Performa: #{selectedOrder.performaNumber}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* 5-Stage Visual Workflow Tracker for Superadmin & Admin */}
              <Box
                sx={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  p: 2,
                  mb: 2.5,
                }}
              >
                <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', mb: 1.5, letterSpacing: '0.05em' }}>
                  Order Fulfillment Status Progression
                </Typography>

                {(() => {
                  const s = (selectedOrder.status || 'PENDING').toUpperCase();
                  const stages = [
                    { key: 'PENDING', label: '1. Order Placed', color: '#16A34A' },
                    { key: 'SEEN', label: '2. Seen', color: '#0284C7' },
                    { key: 'VERIFIED', label: '3. Verified', color: '#7C3AED' },
                    { key: 'SENT', label: '4. Sent / Dispatched', color: '#1D4ED8' },
                    { key: 'COMPLETED', label: '5. Completed', color: '#16A34A' },
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
                        ⚠️ This order was REJECTED.
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
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })()}
              </Box>

              {/* Exact Products Table: SL.NO, PRODUCT NAME, CASE, RATE, QUANTITY, TOTAL */}
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{ border: '1.5px solid #0F172A', borderRadius: '6px', maxHeight: '380px' }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#0F172A' }}>
                      <TableCell sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900, fontSize: '11px', width: '8%' }}>
                        SL.NO
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900, fontSize: '11px', width: '46%' }}>
                        PRODUCT NAME
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900, fontSize: '11px', width: '10%' }}>
                        CASE
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900, fontSize: '11px', width: '12%' }}>
                        RATE (₹)
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900, fontSize: '11px', width: '10%' }}>
                        QUANTITY
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900, fontSize: '11px', width: '14%' }}>
                        TOTAL (₹)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedOrder.products || []).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>{item.slNo || idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {item.productName}
                          {item.company && (
                            <Typography component="span" sx={{ fontSize: '10.5px', color: '#64748B', ml: 1 }}>
                              ({item.company})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '12px' }}>
                          {item.caseCount || '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          ₹ {item.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '13.5px', fontWeight: 900, color: '#1D4ED8' }}>
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

              {/* Totals Summary */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  p: 1.5,
                  px: 2,
                  mt: 2,
                }}
              >
                <Typography sx={{ fontSize: '13px', fontWeight: 800 }}>
                  TOTAL CASES: {selectedOrder.totalCases}
                </Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 900, color: '#4ADE80' }}>
                  TOTAL ORDER VALUE: ₹ {selectedOrder.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Super Admin Approval Toggle */}
            {isSuperAdmin && selectedOrder && (
              selectedOrder.approvedForAdmin ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label="✓ Approved for Admin View"
                    size="small"
                    sx={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 800, fontSize: '11px', border: '1.5px solid #16A34A' }}
                  />
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={updatingId === (selectedOrder._id || selectedOrder.id)}
                    onClick={() => handleToggleAdminApproval(selectedOrder._id || selectedOrder.id || '', false)}
                    sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'none', borderRadius: '5px' }}
                  >
                    Revoke Admin View
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="contained"
                  disableElevation
                  disabled={updatingId === (selectedOrder._id || selectedOrder.id)}
                  onClick={() => handleToggleAdminApproval(selectedOrder._id || selectedOrder.id || '', true)}
                  startIcon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    backgroundColor: '#16A34A !important',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '12px',
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 2,
                  }}
                >
                  ✓ Approve for Admin to View
                </Button>
              )
            )}

            {!isSuperAdmin && (
              <Chip
                label="✓ Approved by Super Admin"
                size="small"
                sx={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 800, fontSize: '11px', border: '1px solid #86EFAC' }}
              />
            )}

            {/* Status Follow-up Dropdown for Both Superadmin & Admin */}
            {selectedOrder && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Update Status:
                </Typography>
                <Select
                  size="small"
                  value={selectedOrder.status || 'PENDING'}
                  disabled={updatingId === (selectedOrder._id || selectedOrder.id)}
                  onChange={(e) =>
                    handleUpdateStatus(selectedOrder._id || selectedOrder.id || '', e.target.value as any)
                  }
                  sx={{
                    fontSize: '12px',
                    fontWeight: 800,
                    height: '32px',
                    minWidth: '150px',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <MenuItem value="PENDING">ORDER PLACED</MenuItem>
                  <MenuItem value="SEEN">SEEN</MenuItem>
                  <MenuItem value="VERIFIED">VERIFIED</MenuItem>
                  <MenuItem value="SENT">SENT / DISPATCHED</MenuItem>
                  <MenuItem value="COMPLETED">COMPLETED</MenuItem>
                  <MenuItem value="REJECTED">REJECTED</MenuItem>
                </Select>
              </Box>
            )}

            {/* Quick Status Actions */}
            {selectedOrder && selectedOrder.status !== 'REJECTED' && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={updatingId === (selectedOrder._id || selectedOrder.id)}
                onClick={() =>
                  handleUpdateStatus(selectedOrder._id || selectedOrder.id || '', 'REJECTED')
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '11.5px',
                  textTransform: 'none',
                  borderRadius: '5px',
                }}
              >
                Reject Order
              </Button>
            )}

            {selectedOrder && selectedOrder.status === 'REJECTED' && (
              <Button
                variant="outlined"
                size="small"
                disabled={updatingId === (selectedOrder._id || selectedOrder.id)}
                onClick={() =>
                  handleUpdateStatus(selectedOrder._id || selectedOrder.id || '', 'PENDING')
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '11.5px',
                  textTransform: 'none',
                  borderRadius: '5px',
                  color: '#475569',
                  borderColor: '#CBD5E1',
                }}
              >
                Re-open Order (Set Pending)
              </Button>
            )}
          </Box>

          <Button
            onClick={() => setSelectedOrder(null)}
            sx={{ color: '#1D4ED8', fontWeight: 700, textTransform: 'none' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
