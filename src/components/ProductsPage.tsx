import { useState, useEffect, useMemo, useRef, type FC, type ChangeEvent } from 'react';
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
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  InputBase,
  MenuItem,
  Chip,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import { ProductsApi, CompaniesApi } from '../services/api';
import { printProductsListDirectly } from '../utils/printUtils';
import {
  parseProductsExcel,
  downloadSampleProductsTemplate,
  type ParsedProductRow,
} from '../utils/excelUtils';

export interface ProductItem {
  _id?: string;
  id?: string;
  slNo: number;
  name: string;
  code?: string;
  category?: string;
  company?: string;
  caseCount?: number;
  rate?: number;
  pktUnit?: string;
}

export interface CompanyItem {
  _id?: string;
  id?: string;
  slNo?: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  avatarLetter?: string;
  avatarBg?: string;
  avatarColor?: string;
}

export const ProductsPage: FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Company drill-down (null = show companies list, non-null = inside company view)
  const [activeCompany, setActiveCompany] = useState<CompanyItem | null>(null);

  // Toggle for master table view of all products
  const [showAllProductsView, setShowAllProductsView] = useState(false);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');

  // Add / Edit Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    caseCount: '',
    rate: '',
    pktUnit: '1',
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Bulk Upload Modal State
  const [openBulkModal, setOpenBulkModal] = useState(false);
  const [bulkCompany, setBulkCompany] = useState<string>('');
  const [bulkRows, setBulkRows] = useState<ParsedProductRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string>('');
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodsData, compsData] = await Promise.all([
        ProductsApi.getAll(),
        CompaniesApi.getAll(),
      ]);
      setProducts(prodsData || []);
      setCompanies(compsData || []);
    } catch (err) {
      console.error('Failed to fetch products/companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Product counts per company
  const companyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const comp = (p.company || '').trim().toLowerCase();
      if (comp) {
        counts[comp] = (counts[comp] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered companies for the Companies view
  const filteredCompanies = useMemo(() => {
    if (!companySearchTerm.trim()) return companies;
    const term = companySearchTerm.toLowerCase().trim();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        (c.gstin && c.gstin.toLowerCase().includes(term))
    );
  }, [companies, companySearchTerm]);

  // Filtered products when inside a company or in All Products view
  const currentCompanyProducts = useMemo(() => {
    let list = products;
    if (activeCompany) {
      list = list.filter(
        (p) => (p.company || '').trim().toLowerCase() === activeCompany.name.trim().toLowerCase()
      );
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        String(p.slNo).includes(term) ||
        (p.company && p.company.toLowerCase().includes(term)) ||
        (p.pktUnit && p.pktUnit.toLowerCase().includes(term))
    );
  }, [products, activeCompany, searchTerm]);

  // Open Add modal for a specific company
  const handleOpenAddForCompany = (companyName?: string) => {
    setEditingProduct(null);
    const targetComp = companyName || activeCompany?.name || (companies[0]?.name || '');
    setFormData({
      name: '',
      company: targetComp,
      caseCount: '',
      rate: '',
      pktUnit: '1',
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (product: ProductItem) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      company: product.company || '',
      caseCount: product.caseCount !== undefined && product.caseCount !== null ? String(product.caseCount) : '',
      rate: product.rate !== undefined && product.rate !== null ? String(product.rate) : '',
      pktUnit: product.pktUnit || '1',
    });
    setOpenModal(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.name.trim()) {
      alert('Please enter product name');
      return;
    }

    try {
      setModalLoading(true);
      const payload = {
        name: formData.name.trim(),
        company: formData.company.trim(),
        caseCount: formData.caseCount ? parseFloat(formData.caseCount) : 0,
        rate: formData.rate ? parseFloat(formData.rate) : 0,
        pktUnit: formData.pktUnit.trim() || '1',
      };

      if (editingProduct) {
        const id = editingProduct._id || editingProduct.id || '';
        await ProductsApi.update(id, payload);
      } else {
        const nextSlNo = products.length > 0 ? Math.max(...products.map((p) => p.slNo || 0)) + 1 : 1;
        await ProductsApi.create({
          slNo: nextSlNo,
          ...payload,
        });
      }
      setOpenModal(false);
      const updatedProducts = await ProductsApi.getAll();
      setProducts(updatedProducts || []);
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Error saving product');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    const id = product._id || product.id || '';
    if (!id) return;
    if (!window.confirm(`Delete product "${product.name}"?`)) return;

    try {
      await ProductsApi.delete(id);
      setProducts((prev) => prev.filter((p) => (p._id || p.id) !== id));
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Error deleting product');
    }
  };

  // Open Bulk Upload modal for a specific company
  const handleOpenBulkUploadForCompany = (companyName: string) => {
    setBulkCompany(companyName);
    setBulkRows([]);
    setBulkFileName('');
    setBulkError('');
    setOpenBulkModal(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBulkParsing(true);
      setBulkError('');
      setBulkFileName(file.name);
      const rows = await parseProductsExcel(file);
      if (rows.length === 0) {
        setBulkError('No valid product rows found in the uploaded file. Ensure headers match: Product Name, Case, Rate, Pkts/Unit');
        setBulkRows([]);
      } else {
        setBulkRows(rows);
      }
    } catch (err: any) {
      console.error('Failed to parse excel:', err);
      setBulkError(err?.message || 'Failed to parse Excel file. Please check format.');
      setBulkRows([]);
    } finally {
      setBulkParsing(false);
    }
  };

  const handleConfirmBulkUpload = async () => {
    if (bulkRows.length === 0) {
      alert('Please upload a valid Excel or CSV file with product rows');
      return;
    }

    try {
      setBulkSubmitting(true);
      setBulkError('');
      const preparedProducts = bulkRows.map((r) => ({
        name: r.name,
        caseCount: r.caseCount,
        rate: r.rate,
        pktUnit: r.pktUnit,
        company: r.company || bulkCompany || '',
      }));

      await ProductsApi.bulkCreate({
        company: bulkCompany,
        products: preparedProducts,
      });

      alert(`Successfully uploaded ${preparedProducts.length} products for "${bulkCompany}"!`);
      setOpenBulkModal(false);

      // Refresh products
      const updatedProducts = await ProductsApi.getAll();
      setProducts(updatedProducts || []);

      // If user uploaded for a company, set that company as active
      const targetCompObj = companies.find((c) => c.name.toLowerCase() === bulkCompany.toLowerCase());
      if (targetCompObj) {
        setActiveCompany(targetCompObj);
        setShowAllProductsView(false);
      }
    } catch (err: any) {
      console.error('Bulk upload failed:', err);
      setBulkError(err?.message || 'Failed to upload products. Please try again.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        p: { xs: 2, sm: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {/* Top Header Banner */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
            px: { xs: 2, sm: 3 },
            py: 1.6,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            minHeight: '56px',
          }}
        >
          {/* Breadcrumb / Title Area */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            {activeCompany ? (
              <>
                <Button
                  size="small"
                  onClick={() => {
                    setActiveCompany(null);
                    setShowAllProductsView(false);
                    setSearchTerm('');
                  }}
                  startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 1.4,
                    py: 0.4,
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    },
                  }}
                >
                  All Companies
                </Button>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px' }}>›</Typography>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '17px',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {activeCompany.name}
                </Typography>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    px: 1.4,
                    py: 0.35,
                    borderRadius: '12px',
                  }}
                >
                  {currentCompanyProducts.length} {currentCompanyProducts.length === 1 ? 'product' : 'products'}
                </Typography>
              </>
            ) : showAllProductsView ? (
              <>
                <Button
                  size="small"
                  onClick={() => setShowAllProductsView(false)}
                  startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 1.4,
                    py: 0.4,
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    },
                  }}
                >
                  Companies View
                </Button>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px' }}>›</Typography>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '17px',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                  }}
                >
                  All Products ({products.length})
                </Typography>
              </>
            ) : (
              <>
                <DomainOutlinedIcon sx={{ color: '#FFFFFF', fontSize: 22 }} />
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '17px',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Products by Company
                </Typography>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    px: 1.4,
                    py: 0.35,
                    borderRadius: '12px',
                  }}
                >
                  {companies.length} Companies
                </Typography>
              </>
            )}
          </Box>

          {/* Right Header Action Controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            {/* When viewing a company's products */}
            {activeCompany && (
              <>
                {/* Search Box inside Company */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    px: 1.2,
                    height: '36px',
                    width: { xs: '100%', sm: '190px' },
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 18, mr: 0.8 }} />
                  <InputBase
                    placeholder="Search in company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: '#0F172A',
                      width: '100%',
                      '& input::placeholder': { color: '#94A3B8', opacity: 1 },
                    }}
                  />
                  {searchTerm && (
                    <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ p: 0.4 }}>
                      <ClearRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>

                {/* Print List Button */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => printProductsListDirectly(currentCompanyProducts)}
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: 17 }} />}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.5,
                    height: '36px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                  }}
                >
                  Print List
                </Button>

                {/* Bulk Upload Button for this company */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => handleOpenBulkUploadForCompany(activeCompany.name)}
                  startIcon={<UploadFileRoundedIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />}
                  sx={{
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: '#FFFFFF !important',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.6,
                    height: '36px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    whiteSpace: 'nowrap',
                    '&:hover': { background: 'rgb(5, 150, 105)' },
                  }}
                >
                  Bulk Upload Excel
                </Button>

                {/* Add Product Button */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => handleOpenAddForCompany(activeCompany.name)}
                  startIcon={<AddRoundedIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />}
                  sx={{
                    background: '#0F172A',
                    color: '#FFFFFF !important',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.8,
                    height: '36px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    whiteSpace: 'nowrap',
                    '& .MuiSvgIcon-root': { color: '#FFFFFF' },
                    '&:hover': { background: '#1E293B' },
                  }}
                >
                  Add Product
                </Button>
              </>
            )}

            {/* When on Companies Overview page */}
            {!activeCompany && !showAllProductsView && (
              <>
                {/* Search Company Box */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    px: 1.2,
                    height: '36px',
                    width: { xs: '100%', sm: '210px' },
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 18, mr: 0.8 }} />
                  <InputBase
                    placeholder="Search company..."
                    value={companySearchTerm}
                    onChange={(e) => setCompanySearchTerm(e.target.value)}
                    sx={{
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: '#0F172A',
                      width: '100%',
                      '& input::placeholder': { color: '#94A3B8', opacity: 1 },
                    }}
                  />
                  {companySearchTerm && (
                    <IconButton size="small" onClick={() => setCompanySearchTerm('')} sx={{ p: 0.4 }}>
                      <ClearRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>

                {/* View All Products Button */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => setShowAllProductsView(true)}
                  startIcon={<TableRowsRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.6,
                    height: '36px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                  }}
                >
                  View All Products Table
                </Button>
              </>
            )}

            {/* When on All Products Table view */}
            {!activeCompany && showAllProductsView && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    px: 1.2,
                    height: '36px',
                    width: { xs: '100%', sm: '210px' },
                    boxSizing: 'border-box',
                  }}
                >
                  <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 18, mr: 0.8 }} />
                  <InputBase
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: '#0F172A',
                      width: '100%',
                      '& input::placeholder': { color: '#94A3B8', opacity: 1 },
                    }}
                  />
                  {searchTerm && (
                    <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ p: 0.4 }}>
                      <ClearRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>

                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => printProductsListDirectly(currentCompanyProducts)}
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: 17 }} />}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.5,
                    height: '36px',
                    borderRadius: '6px',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                  }}
                >
                  Print List
                </Button>

                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => handleOpenAddForCompany()}
                  startIcon={<AddRoundedIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />}
                  sx={{
                    background: '#0F172A',
                    color: '#FFFFFF !important',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.8,
                    height: '36px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    whiteSpace: 'nowrap',
                    '& .MuiSvgIcon-root': { color: '#FFFFFF' },
                    '&:hover': { background: '#1E293B' },
                  }}
                >
                  Add Product
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: COMPANIES CARDS / TILES (Default Product Page)*/}
        {/* ---------------------------------------------------- */}
        {!activeCompany && !showAllProductsView && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={36} sx={{ color: '#1D4ED8' }} />
              </Box>
            ) : filteredCompanies.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8, color: '#64748B' }}>
                <DomainOutlinedIcon sx={{ fontSize: 48, color: '#CBD5E1', mb: 1 }} />
                <Typography sx={{ fontSize: '15px', fontWeight: 600 }}>
                  {companySearchTerm
                    ? `No companies matching "${companySearchTerm}" found.`
                    : 'No companies registered yet.'}
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(3, 1fr)',
                  },
                  gap: 2.5,
                }}
              >
                {filteredCompanies.map((company) => {
                  const compName = company.name;
                  const count = companyCounts[compName.toLowerCase()] || 0;
                  const initial = company.avatarLetter || compName.charAt(0).toUpperCase();

                  return (
                    <Card
                      key={company._id || company.id || compName}
                      elevation={0}
                      sx={{
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        backgroundColor: '#FFFFFF',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                        '&:hover': {
                          borderColor: '#3B82F6',
                          boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.12)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5, pb: 2 }}>
                        {/* Company Header Row */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '10px',
                              backgroundColor: company.avatarBg || '#EFF6FF',
                              color: company.avatarColor || '#1D4ED8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              fontWeight: 800,
                              flexShrink: 0,
                              border: '1px solid rgba(29, 78, 216, 0.15)',
                            }}
                          >
                            {initial}
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              onClick={() => setActiveCompany(company)}
                              title={compName}
                              sx={{
                                fontSize: '15px',
                                fontWeight: 700,
                                color: '#0F172A',
                                lineHeight: 1.3,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                '&:hover': { color: '#1D4ED8', textDecoration: 'underline' },
                              }}
                            >
                              {compName}
                            </Typography>

                            {company.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                                <PhoneOutlinedIcon sx={{ fontSize: 13, color: '#64748B' }} />
                                <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                                  {company.phone}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Products Count Badge */}
                        <Box
                          onClick={() => setActiveCompany(company)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#F8FAFC',
                            borderRadius: '8px',
                            p: 1.2,
                            px: 1.5,
                            mt: 1,
                            cursor: 'pointer',
                            border: '1px solid #F1F5F9',
                            '&:hover': { backgroundColor: '#F0F9FF', borderColor: '#BFDBFE' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Inventory2OutlinedIcon sx={{ fontSize: 17, color: '#2563EB' }} />
                            <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                              Total Products
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              fontSize: '13px',
                              fontWeight: 800,
                              color: count > 0 ? '#1D4ED8' : '#94A3B8',
                              backgroundColor: count > 0 ? '#DBEAFE' : '#E2E8F0',
                              px: 1.2,
                              py: 0.2,
                              borderRadius: '12px',
                            }}
                          >
                            {count}
                          </Typography>
                        </Box>
                      </CardContent>

                      {/* Action Buttons: View Products & Dedicated Bulk Upload for THIS Company */}
                      <Box
                        sx={{
                          p: 1.8,
                          pt: 1.2,
                          backgroundColor: '#FAFAFA',
                          borderTop: '1px solid #F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        {/* Dedicated Bulk Upload button for THIS company */}
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenBulkUploadForCompany(compName)}
                          startIcon={<UploadFileRoundedIcon sx={{ fontSize: 16 }} />}
                          sx={{
                            height: '34px',
                            borderColor: '#10B981',
                            color: '#059669',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'none',
                            borderRadius: '6px',
                            '&:hover': {
                              backgroundColor: '#ECFDF5',
                              borderColor: '#059669',
                            },
                          }}
                        >
                          Bulk Upload
                        </Button>

                        {/* View Products button */}
                        <Button
                          fullWidth
                          size="small"
                          variant="contained"
                          disableElevation
                          onClick={() => setActiveCompany(company)}
                          endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
                          sx={{
                            height: '34px',
                            backgroundColor: '#1D4ED8',
                            color: '#FFFFFF !important',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'none',
                            borderRadius: '6px',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #172554 0%, #1D4ED8 100%)',
                            },
                          }}
                        >
                          View Products
                        </Button>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 2: INSIDE A COMPANY (Drilled-Down Products View) */}
        {/* ---------------------------------------------------- */}
        {(activeCompany || showAllProductsView) && (
          <TableContainer>
            <Table sx={{ width: '100%' }} aria-label="product table">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell
                    sx={{
                      py: 1.5,
                      px: { xs: 2, sm: 3 },
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                      width: '80px',
                    }}
                  >
                    SL.NO
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 1.5,
                      px: { xs: 2, sm: 3 },
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                    }}
                  >
                    PRODUCT NAME
                  </TableCell>
                  {showAllProductsView && (
                    <TableCell
                      sx={{
                        py: 1.5,
                        px: 2,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      COMPANY
                    </TableCell>
                  )}
                  <TableCell
                    align="center"
                    sx={{
                      py: 1.5,
                      px: 2,
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                      width: '100px',
                    }}
                  >
                    CASE
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      py: 1.5,
                      px: 2,
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                      width: '120px',
                    }}
                  >
                    RATE
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      py: 1.5,
                      px: 2,
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                      width: '110px',
                    }}
                  >
                    PKTS/UNIT
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      py: 1.5,
                      px: 1.5,
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                      width: '80px',
                    }}
                  >
                    EDIT
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      py: 1.5,
                      px: 2,
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#1E293B',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                      width: '80px',
                    }}
                  >
                    DELETE
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={showAllProductsView ? 8 : 7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#1D4ED8' }} />
                    </TableCell>
                  </TableRow>
                ) : currentCompanyProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showAllProductsView ? 8 : 7}
                      align="center"
                      sx={{ py: 6, color: '#64748B' }}
                    >
                      {searchTerm ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: '14px', color: '#64748B', fontWeight: 500 }}>
                            No products matching "{searchTerm}" found.
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => setSearchTerm('')}
                            sx={{ textTransform: 'none', color: '#1D4ED8', fontWeight: 600 }}
                          >
                            Clear Search
                          </Button>
                        </Box>
                      ) : activeCompany ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                          <Typography sx={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>
                            No products added for <b>{activeCompany.name}</b> yet.
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                            <Button
                              variant="outlined"
                              onClick={() => handleOpenBulkUploadForCompany(activeCompany.name)}
                              startIcon={<UploadFileRoundedIcon sx={{ fontSize: 17 }} />}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                borderColor: '#10B981',
                                color: '#059669',
                                '&:hover': { backgroundColor: '#ECFDF5', borderColor: '#059669' },
                              }}
                            >
                              Bulk Upload Excel for {activeCompany.name}
                            </Button>
                            <Button
                              variant="contained"
                              onClick={() => handleOpenAddForCompany(activeCompany.name)}
                              startIcon={<AddRoundedIcon sx={{ fontSize: 17 }} />}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                backgroundColor: '#1D4ED8',
                              }}
                            >
                              Add Product
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        'No products found.'
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentCompanyProducts.map((product, index) => {
                    const isLast = index === currentCompanyProducts.length - 1;
                    return (
                      <TableRow
                        key={product._id || product.id || index}
                        sx={{
                          '&:hover': {
                            backgroundColor: '#F8FAFC',
                          },
                        }}
                      >
                        {/* SL.NO */}
                        <TableCell
                          sx={{
                            py: 1.6,
                            px: { xs: 2, sm: 3 },
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: '#1E293B',
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          {product.slNo || index + 1}
                        </TableCell>

                        {/* Product Name */}
                        <TableCell
                          sx={{
                            py: 1.6,
                            px: { xs: 2, sm: 3 },
                            fontSize: '13.5px',
                            fontWeight: 700,
                            color: '#0F172A',
                            letterSpacing: '0.01em',
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          {product.name}
                        </TableCell>

                        {/* Company (if in All Products view) */}
                        {showAllProductsView && (
                          <TableCell
                            sx={{
                              py: 1.6,
                              px: 2,
                              borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                            }}
                          >
                            {product.company ? (
                              <Chip
                                label={product.company}
                                size="small"
                                onClick={() => {
                                  const compObj = companies.find(
                                    (c) => c.name.toLowerCase() === product.company!.toLowerCase()
                                  );
                                  if (compObj) {
                                    setActiveCompany(compObj);
                                    setShowAllProductsView(false);
                                  }
                                }}
                                sx={{
                                  backgroundColor: '#EFF6FF',
                                  color: '#1D4ED8',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  border: '1px solid #BFDBFE',
                                  cursor: 'pointer',
                                  '&:hover': { backgroundColor: '#DBEAFE' },
                                }}
                              />
                            ) : (
                              <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>-</Typography>
                            )}
                          </TableCell>
                        )}

                        {/* Case */}
                        <TableCell
                          align="center"
                          sx={{
                            py: 1.6,
                            px: 2,
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: '#334155',
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          {product.caseCount !== undefined && product.caseCount !== null && product.caseCount > 0
                            ? product.caseCount
                            : '-'}
                        </TableCell>

                        {/* Rate */}
                        <TableCell
                          align="right"
                          sx={{
                            py: 1.6,
                            px: 2,
                            fontSize: '13.5px',
                            fontWeight: 700,
                            color: '#1D4ED8',
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          {product.rate !== undefined && product.rate !== null && product.rate > 0
                            ? `₹ ${Number(product.rate).toFixed(2)}`
                            : '-'}
                        </TableCell>

                        {/* Pkts/Unit */}
                        <TableCell
                          align="center"
                          sx={{
                            py: 1.6,
                            px: 2,
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#475569',
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          {product.pktUnit || '1'}
                        </TableCell>

                        {/* Edit Button */}
                        <TableCell
                          align="center"
                          sx={{
                            py: 1.6,
                            px: 1.5,
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          <Tooltip title="Edit Product" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEdit(product)}
                              sx={{
                                color: '#64748B',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#1D4ED8',
                                  backgroundColor: '#F0F9FF',
                                  borderColor: '#BFDBFE',
                                },
                              }}
                            >
                              <ModeEditOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>

                        {/* Delete Button */}
                        <TableCell
                          align="center"
                          sx={{
                            py: 1.6,
                            px: 2,
                            borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                          }}
                        >
                          <Tooltip title="Delete Product" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteProduct(product)}
                              sx={{
                                color: '#64748B',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                p: 0.7,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#DC2626',
                                  backgroundColor: '#FEF2F2',
                                  borderColor: '#FECACA',
                                },
                              }}
                            >
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD / EDIT PRODUCT                            */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              p: 1,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
          {editingProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Product Name */}
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Product Name *
              </Typography>
              <TextField
                autoFocus
                fullWidth
                size="small"
                placeholder="e.g. 2 1/2 KURUVI"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                slotProps={{
                  input: {
                    sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                  },
                }}
              />
            </Box>

            {/* Company Selection */}
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Company Name
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                slotProps={{
                  input: {
                    sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                  },
                }}
              >
                <MenuItem value="">
                  <em>(None / General)</em>
                </MenuItem>
                {companies.map((c) => (
                  <MenuItem key={c._id || c.id || c.name} value={c.name}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
              {/* Case */}
              <Box>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                  Case
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 10"
                  value={formData.caseCount}
                  onChange={(e) => setFormData({ ...formData, caseCount: e.target.value })}
                  slotProps={{
                    input: {
                      sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                    },
                  }}
                />
              </Box>

              {/* Rate */}
              <Box>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                  Rate (₹)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 150"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  slotProps={{
                    input: {
                      sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                    },
                  }}
                />
              </Box>

              {/* Pkts/Unit */}
              <Box>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                  Pkts/Unit
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. 1 or 10"
                  value={formData.pktUnit}
                  onChange={(e) => setFormData({ ...formData, pktUnit: e.target.value })}
                  slotProps={{
                    input: {
                      sx: { fontSize: '13.5px', fontWeight: 500, borderRadius: '6px' },
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setOpenModal(false)}
            sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveProduct}
            disabled={modalLoading}
            sx={{
              backgroundColor: '#1D4ED8',
              color: '#FFFFFF !important',
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
              borderRadius: '6px',
              '&:hover': { backgroundColor: '#1E40AF' },
            }}
          >
            {modalLoading ? 'Saving...' : 'Save Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: BULK EXCEL UPLOAD FOR COMPANY                 */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={openBulkModal}
        onClose={() => !bulkSubmitting && setOpenBulkModal(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              p: 1,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', pb: 1 }}>
          Bulk Upload Products for: <span style={{ color: '#1D4ED8' }}>{bulkCompany || 'Company'}</span>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {/* Target Company Banner & Sample Template */}
            <Box
              sx={{
                p: 2,
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', mb: 0.5 }}>
                  Selected Company:
                </Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={bulkCompany}
                  onChange={(e) => setBulkCompany(e.target.value)}
                  slotProps={{
                    input: {
                      sx: { fontSize: '13.5px', fontWeight: 700, color: '#1D4ED8', backgroundColor: '#FFFFFF' },
                    },
                  }}
                >
                  {companies.map((c) => (
                    <MenuItem key={c._id || c.id || c.name} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Button
                variant="outlined"
                onClick={downloadSampleProductsTemplate}
                startIcon={<DownloadRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{
                  height: '40px',
                  alignSelf: { xs: 'stretch', sm: 'flex-end' },
                  borderColor: '#CBD5E1',
                  color: '#1D4ED8',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    borderColor: '#1D4ED8',
                    backgroundColor: '#EFF6FF',
                  },
                }}
              >
                Download Sample Excel
              </Button>
            </Box>

            {/* File Upload Box */}
            <Box
              sx={{
                border: '2px dashed #CBD5E1',
                borderRadius: '8px',
                p: 3,
                textAlign: 'center',
                backgroundColor: '#F8FAFC',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: '#2563EB',
                  backgroundColor: '#F0F9FF',
                },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <UploadFileRoundedIcon sx={{ fontSize: 42, color: '#3B82F6', mb: 1 }} />
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                {bulkFileName ? bulkFileName : `Click to select Excel (.xlsx, .xls) or CSV file for ${bulkCompany}`}
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#64748B', mt: 0.5 }}>
                Expected format: <b>Product Name</b>, <b>Case</b>, <b>Rate</b>, <b>Pkts/Unit</b>
              </Typography>
            </Box>

            {/* Parsing State */}
            {bulkParsing && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={22} sx={{ color: '#1D4ED8' }} />
                <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#1D4ED8' }}>
                  Parsing Excel data...
                </Typography>
              </Box>
            )}

            {/* Error Message */}
            {bulkError && (
              <Alert severity="error" sx={{ fontSize: '13px' }}>
                {bulkError}
              </Alert>
            )}

            {/* Preview of Parsed Rows */}
            {bulkRows.length > 0 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleOutlineRoundedIcon sx={{ color: '#10B981', fontSize: 20 }} />
                    <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                      Ready to upload: {bulkRows.length} products
                    </Typography>
                  </Box>
                  <Chip
                    label={`Company: ${bulkCompany}`}
                    size="small"
                    sx={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700 }}
                  />
                </Box>

                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ maxHeight: 250, borderRadius: '8px' }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '11px', width: '50px' }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '11px' }}>PRODUCT NAME</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '11px', width: '80px' }}>
                          CASE
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '11px', width: '90px' }}>
                          RATE (₹)
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '11px', width: '90px' }}>
                          PKTS/UNIT
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bulkRows.slice(0, 100).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontSize: '12px', color: '#64748B' }}>{idx + 1}</TableCell>
                          <TableCell sx={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                            {row.name}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: '12px', color: '#334155' }}>
                            {row.caseCount || '-'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>
                            {row.rate > 0 ? `₹ ${row.rate.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: '12px', color: '#64748B' }}>
                            {row.pktUnit || '1'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {bulkRows.length > 100 && (
                  <Typography sx={{ fontSize: '11.5px', color: '#64748B', mt: 0.5, textAlign: 'right' }}>
                    Showing first 100 of {bulkRows.length} items
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setOpenBulkModal(false)}
            disabled={bulkSubmitting}
            sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleConfirmBulkUpload}
            disabled={bulkRows.length === 0 || bulkSubmitting}
            startIcon={
              bulkSubmitting ? (
                <CircularProgress size={16} sx={{ color: '#FFFFFF' }} />
              ) : (
                <UploadFileRoundedIcon sx={{ fontSize: 18 }} />
              )
            }
            sx={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF !important',
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
              borderRadius: '6px',
              '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
            }}
          >
            {bulkSubmitting
              ? 'Uploading Products...'
              : `Upload (${bulkRows.length}) Products to ${bulkCompany}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
