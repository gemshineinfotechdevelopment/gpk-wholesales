import { useState, useEffect, useMemo, useRef, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Autocomplete,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { CustomersApi, ProductsApi, CompaniesApi, PerformasApi } from '../services/api';
import { PerformaPrintModal } from './PerformaPrintModal';
import type { PerformaPrintData } from './PerformaPrintTemplate';
import { sharePerformaOnWhatsApp } from '../utils/whatsappUtils';

export type PerformaSubTab = 'Create Performa' | 'Customer Performa List';

const SUB_TABS: PerformaSubTab[] = ['Create Performa', 'Customer Performa List'];

interface ProductRowItem {
  id: string;
  productId?: string;
  productCode: string;
  productName: string;
  companyName: string;
  category: string;
  requiredCases: string;
  rate: string;
  pktUnit: string;
  allocatedAmount: string;
}

interface EditProductItem {
  id: string;
  productId?: string;
  productCode: string;
  productName: string;
  companyName: string;
  category: string;
  requiredCases: number | string;
  usedCases?: number;
  remainingCases?: number;
  rate: number | string;
  pktPerUnit: number | string;
  allocatedAmount: number | string;
}

// Helper to determine if a performa date is within the last 3 days compared to current system date
const isWithinLast3Days = (dateStr?: string, createdAt?: string | Date): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let targetDate: Date | null = null;

  if (dateStr && typeof dateStr === 'string' && dateStr.trim() !== '') {
    const trimmed = dateStr.trim();
    const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      targetDate = new Date(year, month, day);
    } else {
      const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (ymd) {
        const year = parseInt(ymd[1], 10);
        const month = parseInt(ymd[2], 10) - 1;
        const day = parseInt(ymd[3], 10);
        targetDate = new Date(year, month, day);
      } else {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
          targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
      }
    }
  }

  if (!targetDate && createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  if (!targetDate) return false;

  const diffMs = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= 3;
};

interface PerformaPageProps {
  initialCustomerName?: string;
  initialSubTab?: PerformaSubTab;
  navigationKey?: number;
  isActive?: boolean;
  onNavigateAllPerforma?: () => void;
  onSelectCustomerForBill?: (customerName: string, subTab?: any) => void;
  userRole?: 'superadmin' | 'admin' | 'user';
}

export const PerformaPage: FC<PerformaPageProps> = ({
  initialCustomerName,
  initialSubTab,
  navigationKey = 0,
  isActive = true,
  onNavigateAllPerforma,
  onSelectCustomerForBill,
  userRole,
}) => {
  const effectiveRole = userRole || (() => {
    try {
      const u = localStorage.getItem('gpk_user') || localStorage.getItem('gpk_auth_user') || localStorage.getItem('dheeksha_auth_user');
      return u ? JSON.parse(u).role : (localStorage.getItem('user_role') || '');
    } catch { return ''; }
  })();
  // Subtab Navigation
  const [activeSubTab, setActiveSubTab] = useState<PerformaSubTab>(() => {
    return initialSubTab || 'Create Performa';
  });

  // Master Dropdown Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Selected Customer Details & Performa Summary
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerPerformaSummary, setCustomerPerformaSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Form State (Create Performa)
  const [performaNumber, setPerformaNumber] = useState<string>('PF-000001');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [packing, setPacking] = useState<string>('');
  const [tax, setTax] = useState<string>('');

  // Product Requirement Entry Line
  const [selectedProductObj, setSelectedProductObj] = useState<any | null>(null);
  const [productCode, setProductCode] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productCompany, setProductCompany] = useState<string>('');
  const [requiredCases, setRequiredCases] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [pktUnit, setPktUnit] = useState<string>('1');

  // Product Rows
  const [productRows, setProductRows] = useState<ProductRowItem[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Customer Performa List Sub-page State
  const [customerPerformas, setCustomerPerformas] = useState<any[]>([]);
  const [customerPerformasLoading, setCustomerPerformasLoading] = useState<boolean>(false);

  // View Details Modal State
  const [selectedPerformaForView, setSelectedPerformaForView] = useState<any | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);
  const [viewLoading, setViewLoading] = useState<boolean>(false);

  // Edit Performa Modal State
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editPerformaId, setEditPerformaId] = useState<string>('');
  const [editPerformaNumber, setEditPerformaNumber] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');
  const [editCustomerAddress, setEditCustomerAddress] = useState<string>('');
  const [editCustomerGst, setEditCustomerGst] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editAdvanceAmount, setEditAdvanceAmount] = useState<string>('0');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState<string>('');
  const [editPacking, setEditPacking] = useState<string>('');
  const [editTax, setEditTax] = useState<string>('');
  const [editProducts, setEditProducts] = useState<EditProductItem[]>([]);

  // Extra Quantity Dialog State
  const [extraQtyDialog, setExtraQtyDialog] = useState<{
    open: boolean;
    targetId: string;
    productName: string;
    companyName: string;
    existingCases: number;
    extraCases: number | string;
    rate: number;
    pktUnit: number;
    isEditModal: boolean;
    mode: 'button' | 'duplicate_detected';
    pendingNewRow?: ProductRowItem | EditProductItem;
  }>({
    open: false,
    targetId: '',
    productName: '',
    companyName: '',
    existingCases: 0,
    extraCases: '',
    rate: 0,
    pktUnit: 1,
    isEditModal: false,
    mode: 'button',
  });

  // Edit Performa: New product entry row state
  const [editNewProductObj, setEditNewProductObj] = useState<any | null>(null);
  const [editNewProductName, setEditNewProductName] = useState<string>('');
  const [editNewProductCode, setEditNewProductCode] = useState<string>('');
  const [editNewProductCompany, setEditNewProductCompany] = useState<string>('');
  const [editNewCases, setEditNewCases] = useState<string>('');
  const [editNewRate, setEditNewRate] = useState<string>('');
  const [editNewPktUnit, setEditNewPktUnit] = useState<string>('1');

  // Print Modal & Toast
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [currentPerformaForPrint, setCurrentPerformaForPrint] = useState<PerformaPrintData | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load initial dropdowns & next performa number
  useEffect(() => {
    const initData = async () => {
      try {
        setLoadingInitial(true);
        const [custList, prodList, compList, nextNumRes] = await Promise.all([
          CustomersApi.getAll(),
          ProductsApi.getAll(),
          CompaniesApi.getAll(),
          PerformasApi.getNextNumber().catch(() => ({ nextPerformaNumber: 'PF-000001' })),
        ]);

        setCustomers(custList || []);
        setProducts(prodList || []);
        setCompanies(compList || []);
        if (nextNumRes?.nextPerformaNumber) {
          setPerformaNumber(nextNumRes.nextPerformaNumber);
        }

        // Auto-select initial customer only if explicitly provided
        if (initialCustomerName && custList && custList.length > 0) {
          const match = custList.find(
            (c: any) => c.name.toLowerCase() === initialCustomerName.toLowerCase()
          );
          if (match) {
            setSelectedCustomer(match);
          }
        }
      } catch (err) {
        console.error('Failed to load Performa initial data:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    initData();
  }, []);

  // Apply cross-page navigation target only when explicitly triggered
  useEffect(() => {
    if (navigationKey === 0) return;
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
    if (initialCustomerName && customers.length > 0) {
      const match = customers.find(
        (c: any) => c.name.toLowerCase() === initialCustomerName.toLowerCase()
      );
      if (match) {
        setSelectedCustomer(match);
      }
    }
  }, [navigationKey, initialSubTab, initialCustomerName]);

  // Silently refresh dropdowns when returning to Performa without clearing draft items
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      Promise.all([
        CustomersApi.getAll().catch(() => null),
        ProductsApi.getAll().catch(() => null),
        CompaniesApi.getAll().catch(() => null),
      ]).then(([custList, prodList, compList]) => {
        if (custList) setCustomers(custList);
        if (prodList) setProducts(prodList);
        if (compList) setCompanies(compList);
      });
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Fetch summary and performas for selected customer
  const fetchCustomerPerformaData = async (customer: any) => {
    if (!customer) {
      setCustomerPerformaSummary(null);
      setCustomerPerformas([]);
      return;
    }

    try {
      setSummaryLoading(true);
      setCustomerPerformasLoading(true);
      const [sumRes, listRes] = await Promise.all([
        PerformasApi.getCustomerSummary(customer._id || customer.name).catch(() => null),
        PerformasApi.getAll({
          customerName: customer.name,
          sortBy: 'date',
          sortOrder: 'desc',
        }).catch(() => []),
      ]);

      setCustomerPerformaSummary(sumRes);
      if (Array.isArray(listRes)) {
        setCustomerPerformas(listRes);
      } else if (listRes && listRes.data) {
        setCustomerPerformas(listRes.data);
      }
    } catch (err) {
      console.error('Failed to load customer performa data:', err);
    } finally {
      setSummaryLoading(false);
      setCustomerPerformasLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerPerformaData(selectedCustomer);
    }
  }, [selectedCustomer]);

  // Filter available products strictly by selected productCompany (Mandatory company selection)
  const filteredProductsForEntry = useMemo(() => {
    if (!productCompany || !productCompany.trim()) {
      return [];
    }
    const comp = productCompany.trim().toLowerCase();
    const exactMatches = products.filter((p: any) => {
      const pComp = (p.company || p.companyName || '').trim().toLowerCase();
      return pComp === comp;
    });
    if (exactMatches.length > 0) return exactMatches;
    return products.filter((p: any) => {
      const pComp = (p.company || p.companyName || '').trim().toLowerCase();
      return pComp && (pComp.includes(comp) || comp.includes(pComp));
    });
  }, [products, productCompany]);

  // When product dropdown selected, autofill code, company, rate without overwriting user entered company
  const handleProductSelect = (prod: any | null) => {
    setSelectedProductObj(prod);
    if (prod) {
      setProductName(prod.name || '');
      setProductCode(prod.code || prod.idCode || `#${prod.slNo || ''}`);
      setRate(prod.rate ? String(prod.rate) : '');
      setPktUnit(prod.pktUnit || '1');
      // If product has a brand name and user hasn't typed one yet, autofill it
      const prodComp = (prod.company || prod.companyName || '').trim();
      if (prodComp && prodComp.toLowerCase() !== 'general') {
        if (!productCompany.trim() || productCompany.trim().toLowerCase() === 'general') {
          setProductCompany(prodComp);
        }
      }
    } else {
      setProductName('');
      setProductCode('');
      setRate('');
      setPktUnit('1');
    }
  };


  // Confirm Extra Quantity Update
  const handleConfirmExtraQty = () => {
    const extraVal = parseFloat(String(extraQtyDialog.extraCases)) || 0;
    if (extraVal <= 0) {
      setToast({ open: true, message: 'Please enter a valid extra quantity > 0', severity: 'error' });
      return;
    }

    const newTotalCases = extraQtyDialog.existingCases + extraVal;

    if (extraQtyDialog.isEditModal) {
      setEditProducts((prev) =>
        prev.map((p) => {
          if (p.id !== extraQtyDialog.targetId) return p;
          const rt = parseFloat(String(p.rate)) || 0;
          const pkt = parseFloat(String(p.pktPerUnit)) || 1;
          const newAllocated = (newTotalCases * rt * pkt).toFixed(2);
          const used = p.usedCases || 0;
          return {
            ...p,
            requiredCases: newTotalCases,
            remainingCases: Math.max(0, newTotalCases - used),
            allocatedAmount: newAllocated,
          };
        })
      );
      if (extraQtyDialog.mode === 'duplicate_detected') {
        setEditNewProductObj(null);
        setEditNewProductName('');
        setEditNewProductCode('');
        setEditNewCases('');
        setEditNewRate('');
        setEditNewPktUnit('1');
      }
    } else {
      setProductRows((prev) =>
        prev.map((r) => {
          if (r.id !== extraQtyDialog.targetId) return r;
          const rt = parseFloat(String(r.rate)) || 0;
          const pkt = parseFloat(String(r.pktUnit)) || 1;
          const newAllocated = (newTotalCases * rt * pkt).toFixed(2);
          return {
            ...r,
            requiredCases: String(newTotalCases),
            allocatedAmount: newAllocated,
          };
        })
      );
      if (extraQtyDialog.mode === 'duplicate_detected') {
        setSelectedProductObj(null);
        setProductName('');
        setProductCode('');
        setRequiredCases('');
        setRate('');
        setPktUnit('1');
      }
    }

    setToast({
      open: true,
      message: `Added +${extraVal} extra cases to ${extraQtyDialog.productName}. Total Cases: ${newTotalCases} Cases!`,
      severity: 'success',
    });

    setExtraQtyDialog((prev) => ({ ...prev, open: false }));
  };

  // Add Product Row
  const handleAddProductRow = () => {
    if (!productCompany || !productCompany.trim()) {
      setToast({ open: true, message: 'Please select a company first (Mandatory)', severity: 'error' });
      return;
    }
    const trimmedName = productName.trim();
    if (!trimmedName) {
      setToast({ open: true, message: 'Please select or enter a product name', severity: 'error' });
      return;
    }
    const casesVal = parseFloat(requiredCases) || 0;
    if (casesVal <= 0) {
      setToast({ open: true, message: 'Please enter a valid required case count > 0', severity: 'error' });
      return;
    }
    const rateVal = parseFloat(rate) || 0;
    if (rateVal <= 0) {
      setToast({ open: true, message: 'Please enter a valid rate > 0', severity: 'error' });
      return;
    }
    const unitsVal = parseFloat(pktUnit) || 1;
    const allocatedAmt = (casesVal * rateVal * unitsVal).toFixed(2);

    const rowCompany =
      productCompany.trim() ||
      ((selectedProductObj?.company || selectedProductObj?.companyName) && (selectedProductObj.company || selectedProductObj.companyName).toLowerCase() !== 'general' ? (selectedProductObj.company || selectedProductObj.companyName) : '') ||
      (selectedCustomer?.companyName && selectedCustomer.companyName.toLowerCase() !== 'general' ? selectedCustomer.companyName : '') ||
      '';

    // Check if product with same name (and compatible company) already exists in productRows
    const existingRow = productRows.find((r) => {
      const nameMatch = r.productName.trim().toLowerCase() === trimmedName.toLowerCase();
      if (!nameMatch) return false;
      if (!rowCompany || !r.companyName) return true;
      return r.companyName.trim().toLowerCase() === rowCompany.toLowerCase();
    });

    const newRow: ProductRowItem = {
      id: Date.now().toString(),
      productId: selectedProductObj?._id,
      productCode: productCode.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      productName: trimmedName,
      companyName: rowCompany,
      category: selectedProductObj?.category || 'Trading',
      requiredCases: String(casesVal),
      rate: String(rateVal),
      pktUnit: String(unitsVal),
      allocatedAmount: allocatedAmt,
    };

    if (existingRow) {
      const existingCasesNum = parseFloat(existingRow.requiredCases) || 0;
      setExtraQtyDialog({
        open: true,
        targetId: existingRow.id,
        productName: existingRow.productName,
        companyName: existingRow.companyName || rowCompany,
        existingCases: existingCasesNum,
        extraCases: casesVal,
        rate: rateVal || parseFloat(existingRow.rate) || 0,
        pktUnit: unitsVal,
        isEditModal: false,
        mode: 'duplicate_detected',
        pendingNewRow: newRow,
      });
      return;
    }

    setProductRows((prev) => [...prev, newRow]);

    // Reset entry fields but preserve company for rapid sequential additions
    setSelectedProductObj(null);
    setProductName('');
    setProductCode('');
    setRequiredCases('');
    setRate('');
    setPktUnit('1');
  };

  const handleRemoveProductRow = (id: string) => {
    setProductRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Inline editing state for product rows in Create Performa tab
  const [inlineEditingRowId, setInlineEditingRowId] = useState<string | null>(null);
  const [inlineEditCases, setInlineEditCases] = useState<string>('');
  const [inlineEditRate, setInlineEditRate] = useState<string>('');
  const [inlineEditPktUnit, setInlineEditPktUnit] = useState<string>('');

  const handleStartInlineEdit = (row: ProductRowItem) => {
    setInlineEditingRowId(row.id);
    setInlineEditCases(row.requiredCases || '');
    setInlineEditRate(row.rate || '');
    setInlineEditPktUnit(row.pktUnit || '1');
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingRowId(null);
    setInlineEditCases('');
    setInlineEditRate('');
    setInlineEditPktUnit('');
  };

  const handleSaveInlineEdit = (id: string) => {
    const cVal = parseFloat(String(inlineEditCases)) || 0;
    const rVal = parseFloat(String(inlineEditRate)) || 0;
    const pVal = parseFloat(String(inlineEditPktUnit)) || 1;

    if (cVal <= 0) {
      setToast({ open: true, message: 'Please enter a valid quantity of cases > 0', severity: 'error' });
      return;
    }
    if (rVal < 0) {
      setToast({ open: true, message: 'Rate cannot be negative', severity: 'error' });
      return;
    }

    const calculatedAllocated = (cVal * rVal * pVal).toFixed(2);

    setProductRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          requiredCases: String(cVal),
          rate: String(rVal),
          pktUnit: String(pVal),
          allocatedAmount: calculatedAllocated,
        };
      })
    );

    setInlineEditingRowId(null);
    setToast({ open: true, message: 'Product updated successfully!', severity: 'success' });
  };

  // Group products by Company Name (Set of products grouped like wholesale order sheet)
  const groupedProductRows = useMemo(() => {
    const groups: { [company: string]: ProductRowItem[] } = {};
    for (const row of productRows) {
      const comp = row.companyName?.trim() || 'General';
      if (!groups[comp]) {
        groups[comp] = [];
      }
      groups[comp].push(row);
    }
    return groups;
  }, [productRows]);

  // Unique companies added in current performa (excluding empty or general)
  const uniqueAddedCompanies = useMemo(() => {
    return Array.from(
      new Set(
        productRows
          .map((r) => r.companyName?.trim())
          .filter((c): c is string => Boolean(c) && c.toLowerCase() !== 'general')
      )
    );
  }, [productRows]);

  // Calculate Aggregates
  const totalRequiredCasesCount = useMemo(() => {
    return productRows.reduce((acc, r) => acc + (parseFloat(r.requiredCases) || 0), 0);
  }, [productRows]);

  const subtotalAllocatedValue = useMemo(() => {
    return productRows.reduce((acc, r) => acc + (parseFloat(r.allocatedAmount) || 0), 0);
  }, [productRows]);

  // Discount Calculation (Supports % like 5% or 5 or flat rupees)
  const discountVal = useMemo(() => {
    if (!discount) return 0;
    const cleanDisc = String(discount).trim();
    const num = parseFloat(cleanDisc) || 0;
    if (num <= 0) return 0;
    if (cleanDisc.endsWith('%') || num <= 100) {
      return (subtotalAllocatedValue * num) / 100;
    }
    return num;
  }, [discount, subtotalAllocatedValue]);

  // Discounted base (only on this discounted amount, packing charge is applied)
  const baseAfterDiscount = useMemo(() => {
    return Math.max(0, subtotalAllocatedValue - discountVal);
  }, [subtotalAllocatedValue, discountVal]);

  // Packing Calculation (Applied ONLY on discounted amount, supports decimals e.g. 2.5%, 3.75%)
  const packingVal = useMemo(() => {
    if (!packing) return 0;
    const cleanPack = String(packing).trim();
    const num = parseFloat(cleanPack) || 0;
    if (num <= 0) return 0;
    if (cleanPack.endsWith('%') || num <= 100) {
      return (baseAfterDiscount * num) / 100;
    }
    return num;
  }, [packing, baseAfterDiscount]);

  // Tax Calculation (Formula: 2500 * no. of cases * 18% or specified %)
  const taxVal = useMemo(() => {
    if (!tax) return 0;
    const cleanTax = String(tax).trim();
    if (cleanTax === '0') return 0;
    const num = parseFloat(cleanTax.replace(/[^0-9.]/g, '')) || 0;
    if (num <= 0) return 0;
    if (cleanTax.endsWith('%') || num <= 100) {
      const cases = totalRequiredCasesCount || 0;
      return Number(((2500 * cases * num) / 100).toFixed(2));
    }
    return num;
  }, [tax, totalRequiredCasesCount]);

  // Final Net Total Allocated Amount
  const finalTotalAllocatedValue = useMemo(() => {
    const net = Math.max(0, subtotalAllocatedValue - discountVal + packingVal + taxVal);
    return Number(net.toFixed(2));
  }, [subtotalAllocatedValue, discountVal, packingVal, taxVal]);

  const totalReceivedAmount = useMemo(() => {
    if (customerPerformaSummary && typeof customerPerformaSummary.ledgerTotalCredit === 'number') {
      return customerPerformaSummary.ledgerTotalCredit;
    }
    if (selectedCustomer) {
      return Number(selectedCustomer.totalCredit || selectedCustomer.totalAdvanceReceived || 0);
    }
    return 0;
  }, [customerPerformaSummary, selectedCustomer]);

  const purchaseAmount = useMemo(() => {
    if (customerPerformaSummary && typeof customerPerformaSummary.ledgerTotalDebit === 'number') {
      return customerPerformaSummary.ledgerTotalDebit;
    }
    if (selectedCustomer) {
      return Number(selectedCustomer.totalDebit || 0);
    }
    return 0;
  }, [customerPerformaSummary, selectedCustomer]);

  const balanceAmount = useMemo(() => {
    if (customerPerformaSummary && typeof customerPerformaSummary.ledgerCreditBalance === 'number') {
      return customerPerformaSummary.ledgerCreditBalance;
    }
    return totalReceivedAmount - purchaseAmount;
  }, [customerPerformaSummary, totalReceivedAmount, purchaseAmount]);

  // Reset Form
  const handleReset = async () => {
    setProductRows([]);
    setNotes('');
    setDiscount('');
    setPacking('');
    setTax('');
    setSelectedProductObj(null);
    setProductName('');
    setProductCode('');
    setProductCompany('');
    setRequiredCases('');
    setRate('');
    setPktUnit('1');
    try {
      const nextRes = await PerformasApi.getNextNumber();
      if (nextRes?.nextPerformaNumber) setPerformaNumber(nextRes.nextPerformaNumber);
    } catch {
      // ignore
    }
  };

  // Submit Performa
  const handleCreatePerforma = async () => {
    if (!selectedCustomer) {
      setToast({ open: true, message: 'Please select a customer first', severity: 'error' });
      return;
    }

    if (productRows.length === 0) {
      setToast({ open: true, message: 'Please add at least one product requirement', severity: 'error' });
      return;
    }

    try {
      setSubmitLoading(true);
      const combinedCompanyName =
        uniqueAddedCompanies.length > 0
          ? uniqueAddedCompanies.join(', ')
          : productCompany?.trim() || selectedCustomer.companyName || '';

      const payload = {
        performaNumber,
        companyName: combinedCompanyName,
        customerId: selectedCustomer._id,
        customerSnapshot: {
          name: selectedCustomer.name,
          phone: selectedCustomer.mobile || selectedCustomer.phone || '',
          companyName: combinedCompanyName || selectedCustomer.companyName || '',
          address: selectedCustomer.address || '',
          gst: selectedCustomer.gst || '',
        },
        advanceAmount: totalReceivedAmount || 0,
        date: date,
        notes: notes.trim(),
        discount: discount || '0',
        packing: packing || '0',
        tax: tax || '0',
        products: productRows.map((r) => ({
          productId: r.productId,
          productSnapshot: {
            productCode: r.productCode,
            productName: r.productName,
            companyName: r.companyName || productCompany || '',
            category: r.category,
          },
          requiredCases: parseFloat(r.requiredCases) || 0,
          rate: parseFloat(r.rate) || 0,
          pktPerUnit: parseFloat(r.pktUnit) || 1,
          allocatedAmount: parseFloat(r.allocatedAmount) || 0,
        })),
      };

      const created = await PerformasApi.create(payload);

      setToast({
        open: true,
        message: `Performa ${created.performaNumber || performaNumber} created successfully!`,
        severity: 'success',
      });

      // Refresh customer performa data
      fetchCustomerPerformaData(selectedCustomer);

      // Refresh customer data & reset form
      if (selectedCustomer) {
        await fetchCustomerPerformaData(selectedCustomer);
      }
      handleReset();
      await handleOpenPrintModal(created);
    } catch (err: any) {
      console.error('Failed to create performa:', err);
      setToast({
        open: true,
        message: err.message || 'Failed to create Performa',
        severity: 'error',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Open View Performa Modal
  const handleOpenViewModal = async (id: string) => {
    try {
      setViewLoading(true);
      setViewModalOpen(true);
      const res = await PerformasApi.getById(id);
      setSelectedPerformaForView(res);
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to load details', severity: 'error' });
    } finally {
      setViewLoading(false);
    }
  };

  // Open Print Modal for a specific performa record
  const handleOpenPrintModal = async (performa: any) => {
    let fullPerforma = performa;
    if (performa._id && (!performa.customerBills || performa.customerBills.length === 0 || performa.totalAdvanceReceived === undefined)) {
      try {
        const res = await PerformasApi.getById(performa._id);
        if (res) fullPerforma = { ...performa, ...res };
      } catch (err) {
        console.warn('Failed to load full performa for print:', err);
      }
    }

    const advAmt = Number(fullPerforma.advanceAmount) || 0;
    const totalAvail = advAmt;
    const usedAmt = 0;
    const remAmt = advAmt;
    const balAmt = Math.max(0, (fullPerforma.totalAllocatedAmount || 0) - advAmt);
    const initAdv = advAmt;
    const addlCred = 0;
    const bills = fullPerforma.customerBills || [];

    const printData: PerformaPrintData = {
      ...fullPerforma,
      performaNumber: fullPerforma.performaNumber,
      companyName: fullPerforma.companyName || fullPerforma.customerSnapshot?.companyName,
      date: fullPerforma.date,
      customerSnapshot: fullPerforma.customerSnapshot,
      advanceAmount: totalAvail,
      initialAdvance: initAdv,
      additionalCredits: addlCred,
      totalAdvanceReceived: totalAvail,
      totalAvailableAmount: totalAvail,
      advanceUsedAmount: usedAmt,
      usedAmount: usedAmt,
      remainingAdvanceAmount: remAmt,
      balanceAmount: balAmt,
      performaRemainingAmount: fullPerforma.performaRemainingAmount !== undefined
        ? fullPerforma.performaRemainingAmount
        : Math.max(0, (fullPerforma.totalAllocatedAmount || 0) - totalAvail),
      customerPendingAmount: fullPerforma.customerPendingAmount !== undefined
        ? fullPerforma.customerPendingAmount
        : (balAmt < 0 ? Math.abs(balAmt) : 0),
      customerBills: bills,
      products: (fullPerforma.products || []).map((p: any) => ({
        productCode: p.productSnapshot?.productCode || p.productCode,
        productName: p.productSnapshot?.productName || p.productName,
        companyName: p.productSnapshot?.companyName || p.companyName,
        category: p.productSnapshot?.category || p.category,
        requiredCases: p.requiredCases,
        usedCases: p.usedCases,
        remainingCases: p.remainingCases,
        rate: p.rate,
        pktPerUnit: p.pktPerUnit || 1,
        allocatedAmount: p.allocatedAmount,
      })),
      totalRequiredCases: fullPerforma.totalRequiredCases,
      totalUsedCases: fullPerforma.totalUsedCases,
      totalRemainingCases: fullPerforma.totalRemainingCases,
      subtotal: fullPerforma.subtotal,
      discount: fullPerforma.discount,
      discountAmount: fullPerforma.discountAmount,
      packing: fullPerforma.packing,
      packingAmount: fullPerforma.packingAmount,
      tax: fullPerforma.tax,
      taxAmount: fullPerforma.taxAmount,
      totalAllocatedAmount: fullPerforma.totalAllocatedAmount,
      totalUsedAmount: fullPerforma.totalUsedAmount || usedAmt,
      totalRemainingAmount: fullPerforma.totalRemainingAmount,
      status: fullPerforma.status,
      notes: fullPerforma.notes,
    };
    setCurrentPerformaForPrint(printData);
    setPrintModalOpen(true);
  };

  // Open Edit Performa Modal
  const handleOpenEditModal = async (performa: any) => {
    const isCustomerOrder =
      performa.createdBy === 'Customer Order' ||
      (performa.notes && /Customer Online Order/i.test(performa.notes));
    if (effectiveRole === 'admin' && isCustomerOrder) {
      setToast({
        open: true,
        message: 'Customer Online Order performas can only be edited by Superadmin.',
        severity: 'info',
      });
      return;
    }
    try {
      setEditLoading(true);
      setEditModalOpen(true);
      const res = await PerformasApi.getById(performa._id);
      const data = res || performa;

      setEditPerformaId(data._id);
      setEditPerformaNumber(data.performaNumber || '');
      setEditCompanyName(data.companyName || data.customerSnapshot?.companyName || '');
      setEditCustomerName(data.customerSnapshot?.name || '');
      setEditCustomerPhone(data.customerSnapshot?.phone || '');
      setEditCustomerAddress(data.customerSnapshot?.address || '');
      setEditCustomerGst(data.customerSnapshot?.gst || '');
      setEditDate(data.date || '');
      setEditAdvanceAmount(String(data.advanceAmount || 0));
      setEditStatus(data.status || 'ACTIVE');
      setEditNotes(data.notes || '');
      setEditDiscount(data.discount !== undefined ? String(data.discount) : '');
      setEditPacking(data.packing !== undefined ? String(data.packing) : '');
      setEditTax(data.tax !== undefined ? String(data.tax) : '');

      const loadedProducts: EditProductItem[] = (data.products || []).map((p: any, idx: number) => ({
        id: p._id || String(idx) + '-' + Date.now(),
        productId: p.productId,
        productCode: p.productSnapshot?.productCode || p.productCode || '',
        productName: p.productSnapshot?.productName || p.productName || 'Product',
        companyName: p.productSnapshot?.companyName || p.companyName || data.companyName || '',
        category: p.productSnapshot?.category || p.category || '',
        requiredCases: p.requiredCases || 0,
        usedCases: p.usedCases || 0,
        remainingCases: p.remainingCases || p.requiredCases || 0,
        rate: p.rate || 0,
        pktPerUnit: p.pktPerUnit || 1,
        allocatedAmount: p.allocatedAmount || (p.requiredCases || 0) * (p.rate || 0) * (p.pktPerUnit || 1),
      }));

      setEditProducts(loadedProducts);
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to load Performa for edit', severity: 'error' });
      setEditModalOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditProductChange = (id: string, field: 'requiredCases' | 'rate' | 'pktPerUnit' | 'companyName' | 'productName', val: string) => {
    setEditProducts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        const req = parseFloat(String(updated.requiredCases)) || 0;
        const rt = parseFloat(String(updated.rate)) || 0;
        const pkt = parseFloat(String(updated.pktPerUnit)) || 1;
        updated.allocatedAmount = (req * rt * pkt).toFixed(2);
        return updated;
      })
    );
  };

  const handleRemoveEditProductRow = (id: string) => {
    setEditProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Filter products for Edit Modal by chosen brand
  const filteredEditModalProducts = useMemo(() => {
    const comp = (editNewProductCompany || editCompanyName || '').trim().toLowerCase();
    if (!comp || comp === 'general') return products;
    const exactMatches = products.filter(
      (p: any) => (p.company || p.companyName || '').trim().toLowerCase() === comp
    );
    if (exactMatches.length > 0) return exactMatches;
    return products.filter((p: any) => {
      const pComp = (p.company || p.companyName || '').trim().toLowerCase();
      return pComp && (pComp.includes(comp) || comp.includes(pComp));
    });
  }, [products, editNewProductCompany, editCompanyName]);

  // Add Product or Extra Quantity in Edit Modal
  const handleAddProductToEditList = () => {
    const trimmed = editNewProductName.trim();
    if (!trimmed) {
      setToast({ open: true, message: 'Please select or type a product name', severity: 'error' });
      return;
    }
    const casesVal = parseFloat(editNewCases) || 0;
    if (casesVal <= 0) {
      setToast({ open: true, message: 'Enter a valid case quantity > 0', severity: 'error' });
      return;
    }
    const rateVal = parseFloat(editNewRate) || 0;
    if (rateVal <= 0) {
      setToast({ open: true, message: 'Enter a valid rate > 0', severity: 'error' });
      return;
    }
    const unitsVal = parseFloat(editNewPktUnit) || 1;
    const allocatedAmt = (casesVal * rateVal * unitsVal).toFixed(2);
    const rowCompany = editNewProductCompany.trim() || (editCompanyName && editCompanyName.toLowerCase() !== 'general' ? editCompanyName.trim() : '') || '';

    const existingItem = editProducts.find(
      (p) =>
        p.productName.trim().toLowerCase() === trimmed.toLowerCase() &&
        (!rowCompany || !p.companyName || p.companyName.trim().toLowerCase() === rowCompany.toLowerCase())
    );

    const newItem: EditProductItem = {
      id: Date.now().toString(),
      productId: editNewProductObj?._id,
      productCode: editNewProductCode.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      productName: trimmed,
      companyName: rowCompany,
      category: editNewProductObj?.category || 'Trading',
      requiredCases: casesVal,
      usedCases: 0,
      remainingCases: casesVal,
      rate: rateVal,
      pktPerUnit: unitsVal,
      allocatedAmount: allocatedAmt,
    };

    if (existingItem) {
      const existingCasesNum = parseFloat(String(existingItem.requiredCases)) || 0;
      setExtraQtyDialog({
        open: true,
        targetId: existingItem.id,
        productName: existingItem.productName,
        companyName: existingItem.companyName || rowCompany,
        existingCases: existingCasesNum,
        extraCases: casesVal,
        rate: rateVal || parseFloat(String(existingItem.rate)) || 0,
        pktUnit: unitsVal,
        isEditModal: true,
        mode: 'duplicate_detected',
        pendingNewRow: newItem,
      });
      return;
    }

    setEditProducts((prev) => [...prev, newItem]);
    setEditNewProductObj(null);
    setEditNewProductName('');
    setEditNewProductCode('');
    setEditNewCases('');
    setEditNewRate('');
    setEditNewPktUnit('1');
  };

  const editTotalCases = useMemo(() => {
    return editProducts.reduce((sum, p) => sum + (parseFloat(String(p.requiredCases)) || 0), 0);
  }, [editProducts]);

  const editSubtotalAllocated = useMemo(() => {
    return editProducts.reduce((sum, p) => sum + (parseFloat(String(p.allocatedAmount)) || 0), 0);
  }, [editProducts]);

  const editDiscountVal = useMemo(() => {
    if (!editDiscount) return 0;
    const cleanDisc = String(editDiscount).trim();
    const num = parseFloat(cleanDisc) || 0;
    if (num <= 0) return 0;
    if (cleanDisc.endsWith('%') || num <= 100) {
      return (editSubtotalAllocated * num) / 100;
    }
    return num;
  }, [editDiscount, editSubtotalAllocated]);

  const editBaseAfterDiscount = useMemo(() => {
    return Math.max(0, editSubtotalAllocated - editDiscountVal);
  }, [editSubtotalAllocated, editDiscountVal]);

  const editPackingVal = useMemo(() => {
    if (!editPacking) return 0;
    const cleanPack = String(editPacking).trim();
    const num = parseFloat(cleanPack) || 0;
    if (num <= 0) return 0;
    if (cleanPack.endsWith('%') || num <= 100) {
      return (editBaseAfterDiscount * num) / 100;
    }
    return num;
  }, [editPacking, editBaseAfterDiscount]);

  const editTaxVal = useMemo(() => {
    if (!editTax) return 0;
    const cleanTax = String(editTax).trim().replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanTax) || 0;
    if (num <= 0) return 0;
    return num;
  }, [editTax]);

  const editFinalTotalAllocated = useMemo(() => {
    const net = Math.max(0, editSubtotalAllocated - editDiscountVal + editPackingVal + editTaxVal);
    return Number(net.toFixed(2));
  }, [editSubtotalAllocated, editDiscountVal, editPackingVal, editTaxVal]);

  const handleSaveEditPerforma = async () => {
    if (!editPerformaId) return;
    if (editProducts.length === 0) {
      setToast({ open: true, message: 'At least one product item is required', severity: 'error' });
      return;
    }

    try {
      setEditLoading(true);
      const uniqueCompanies = Array.from(
        new Set(
          editProducts
            .map((p) => p.companyName?.trim())
            .filter((c): c is string => Boolean(c))
        )
      );
      const combinedCompanyName =
        uniqueCompanies.length > 0
          ? uniqueCompanies.join(', ')
          : editCompanyName.trim() || 'General';

      const payload = {
        companyName: combinedCompanyName,
        customerSnapshot: {
          name: editCustomerName.trim(),
          phone: editCustomerPhone.trim(),
          companyName: combinedCompanyName || editCustomerName.trim(),
          address: editCustomerAddress.trim(),
          gst: editCustomerGst.trim(),
        },
        advanceAmount: parseFloat(String(editAdvanceAmount).replace(/,/g, '')) || 0,
        date: editDate,
        status: editStatus,
        notes: editNotes.trim(),
        discount: editDiscount || '0',
        packing: editPacking || '0',
        tax: editTax || '0',
        products: editProducts.map((p) => ({
          productId: p.productId,
          productSnapshot: {
            productCode: p.productCode,
            productName: p.productName,
            companyName: p.companyName || editCompanyName || '',
            category: p.category,
          },
          requiredCases: parseFloat(String(p.requiredCases)) || 0,
          usedCases: p.usedCases || 0,
          rate: parseFloat(String(p.rate)) || 0,
          pktPerUnit: parseFloat(String(p.pktPerUnit)) || 1,
          allocatedAmount: parseFloat(String(p.allocatedAmount)) || 0,
        })),
      };

      await PerformasApi.update(editPerformaId, payload);
      setToast({ open: true, message: `Performa ${editPerformaNumber} updated successfully!`, severity: 'success' });
      setEditModalOpen(false);
      if (selectedCustomer) fetchCustomerPerformaData(selectedCustomer);
    } catch (err: any) {
      console.error('Failed to update performa:', err);
      setToast({ open: true, message: err?.message || 'Failed to save changes', severity: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Performa
  const handleDeletePerforma = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Performa ${num}?`)) return;
    try {
      await PerformasApi.delete(id);
      setToast({ open: true, message: `Performa ${num} deleted successfully`, severity: 'success' });
      if (selectedCustomer) fetchCustomerPerformaData(selectedCustomer);
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to delete', severity: 'error' });
    }
  };

  if (loadingInitial) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#1D4ED8' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: '1440px', margin: '0 auto' }}>
      {/* Subtabs Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, sm: 3, md: 4 },
          mb: 2.5,
          overflowX: 'auto',
          flexWrap: { xs: 'nowrap', md: 'wrap' },
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
          borderBottom: '1px solid #EEF2F6',
          pb: 0.8,
          '&::-webkit-scrollbar': { height: '3px' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#CBD5E1', borderRadius: '3px' },
        }}
      >
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              sx={{
                position: 'relative',
                pb: 1.2,
                cursor: 'pointer',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14.5px',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#1D4ED8' : '#64748B',
                  px: 0.5,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  '&:hover': {
                    color: '#1D4ED8',
                  },
                }}
              >
                {tab === 'Create Performa' ? (
                  <ReceiptLongRoundedIcon sx={{ fontSize: 18, color: isActive ? '#1D4ED8' : '#94A3B8' }} />
                ) : (
                  <ListAltRoundedIcon sx={{ fontSize: 18, color: isActive ? '#1D4ED8' : '#94A3B8' }} />
                )}
                {tab}
                {tab === 'Customer Performa List' && selectedCustomer && (
                  <Chip
                    label={customerPerformas.length}
                    size="small"
                    sx={{
                      height: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: isActive ? '#BAE6FD' : '#F1F5F9',
                      color: isActive ? '#1D4ED8' : '#64748B',
                    }}
                  />
                )}
              </Typography>

              {/* Active Tab Indicator */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
                    borderTopLeftRadius: '2px',
                    borderTopRightRadius: '2px',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* SUB-TAB 1: CREATE PERFORMA */}
      {activeSubTab === 'Create Performa' && (
        <Box>
          {/* Top Banner Header */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#F0F9FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReceiptLongRoundedIcon sx={{ fontSize: 26, color: '#1D4ED8' }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '20px' }}>
                  Create Performa
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', fontSize: '13px' }}>
                  Customer advance allocation & product requirement order (Not a sales tax bill)
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
              <Chip
                label={`Performa No: ${performaNumber}`}
                sx={{
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  px: 1,
                  height: '36px',
                }}
              />
              {selectedCustomer && (
                <Button
                  variant="outlined"
                  onClick={() => setActiveSubTab('Customer Performa List')}
                  startIcon={<ListAltRoundedIcon />}
                  sx={{
                    borderColor: '#1D4ED8',
                    color: '#1D4ED8',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '8px',
                    '&:hover': { backgroundColor: '#F0F9FF' },
                  }}
                >
                  View Customer's Performas
                </Button>
              )}
              {onNavigateAllPerforma && (
                <Button
                  variant="outlined"
                  onClick={onNavigateAllPerforma}
                  sx={{
                    borderColor: '#CBD5E1',
                    color: '#334155',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '8px',
                    '&:hover': {
                      borderColor: '#94A3B8',
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  View All Performas
                </Button>
              )}
            </Box>
          </Paper>

          {/* Grid: Left Customer Selection & Summary | Right Advance Information */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' }, gap: 3, mb: 3 }}>
            {/* Customer Select Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonOutlineRoundedIcon sx={{ color: '#1D4ED8', fontSize: 20 }} />
                Customer Details
              </Typography>

              {/* Customer Selector */}
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                value={selectedCustomer}
                onChange={(_e, val) => setSelectedCustomer(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search & Select Customer"
                    placeholder="Type customer name..."
                    size="small"
                    fullWidth
                  />
                )}
                sx={{ mb: 2.5 }}
              />

              {selectedCustomer ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #EEF2F6',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                      {selectedCustomer.name}
                    </Typography>
                    <Chip
                      label={selectedCustomer.idCode || 'CUSTOMER'}
                      size="small"
                      sx={{ backgroundColor: '#BAE6FD', color: '#1D4ED8', fontWeight: 700, fontSize: '11px' }}
                    />
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '12.5px', color: '#475569' }}>
                    <div><strong>Phone:</strong> {selectedCustomer.mobile || selectedCustomer.phone || '-'}</div>
                    <div><strong>GST:</strong> {selectedCustomer.gst || '-'}</div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <strong>Address:</strong> {selectedCustomer.address || '-'}
                    </div>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic' }}>
                  Please select a customer to view their account summary and advance balance.
                </Typography>
              )}
            </Paper>

            {/* Customer Account & Advance Summary Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalanceWalletRoundedIcon sx={{ color: '#16A34A', fontSize: 20 }} />
                  Customer Account Summary
                </Typography>

                {summaryLoading ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ color: '#1D4ED8' }} />
                  </Box>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
                    {/* 1. Total Receive Amount */}
                    <Card elevation={0} sx={{ backgroundColor: '#F0F9FF', border: '1px solid #BFDBFE', borderRadius: '10px' }}>
                      <CardContent sx={{ p: '14px !important' }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Total Receive Amount
                        </Typography>
                        <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#1D4ED8', mt: 0.5 }}>
                          ₹{totalReceivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.3, fontWeight: 500 }}>
                          Advance + Add Credit
                        </Typography>
                      </CardContent>
                    </Card>

                    {/* 2. Purchase Amount */}
                    <Card elevation={0} sx={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px' }}>
                      <CardContent sx={{ p: '14px !important' }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Purchase Amount
                        </Typography>
                        <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', mt: 0.5 }}>
                          ₹{purchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.3, fontWeight: 500 }}>
                          Particulars Bills Total
                        </Typography>
                      </CardContent>
                    </Card>

                    {/* 3. Balance Amount */}
                    <Card
                      elevation={0}
                      sx={{
                        backgroundColor: balanceAmount >= 0 ? '#F0FDF4' : '#FFF1F2',
                        border: `1px solid ${balanceAmount >= 0 ? '#BBF7D0' : '#FECDD3'}`,
                        borderRadius: '10px',
                      }}
                    >
                      <CardContent sx={{ p: '14px !important' }}>
                        <Typography
                          sx={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: balanceAmount >= 0 ? '#166534' : '#9F1239',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Balance Amount
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '18px',
                            fontWeight: 800,
                            color: balanceAmount >= 0 ? '#15803D' : '#E11D48',
                            mt: 0.5,
                          }}
                        >
                          ₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.3, fontWeight: 500 }}>
                          Total Amt - Purchase Amt
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                )}
              </Box>

              {/* Performa Date */}
              <Box sx={{ pt: 2, borderTop: '1px solid #EEF2F6', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <TextField
                  label="Performa Date"
                  type="date"
                  size="small"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  sx={{ width: { xs: '100%', sm: '220px' } }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
            </Paper>
          </Box>

          {/* Product Required Section (Grouped Wholesale Order Sheet Layout) */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            {/* Header Title and Tagline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <ReceiptLongRoundedIcon sx={{ color: '#1D4ED8', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.2px' }}>
                    Product Required *
                  </Typography>
                  <Chip
                    label="Customer Requirement Entry"
                    size="small"
                    sx={{
                      backgroundColor: '#F0F9FF',
                      color: '#1D4ED8',
                      fontWeight: 700,
                      fontSize: '11px',
                      border: '1px solid #BAE6FD',
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: '12px', color: '#64748B', mt: 0.4 }}>
                  Select/type company first at top. Then enter products and cases. Grouped like wholesale order sheets.
                </Typography>
              </Box>

              {productRows.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    if (window.confirm('Clear all added product requirements?')) {
                      setProductRows([]);
                    }
                  }}
                  startIcon={<RestartAltRoundedIcon />}
                  sx={{
                    borderColor: '#E2E8F0',
                    color: '#64748B',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    borderRadius: '8px',
                    '&:hover': {
                      borderColor: '#CBD5E1',
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  Reset Items
                </Button>
              )}
            </Box>

            {/* 1. Dedicated Company Selection Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 2.5,
                borderRadius: '10px',
                border: '1.5px solid #BFDBFE',
                backgroundColor: '#F0F7FF',
              }}
            >
              <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#1D4ED8', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <BusinessRoundedIcon sx={{ fontSize: 18, color: '#1D4ED8' }} />
                Company Selection (Type / Select Company First) *
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Autocomplete
                  freeSolo
                  options={companies.map((c: any) => c.name).filter(Boolean)}
                  value={productCompany}
                  onChange={(_e, val) => {
                    const nextComp = val || '';
                    setProductCompany(nextComp);
                    if (selectedProductObj) {
                      const prodComp = (selectedProductObj.company || selectedProductObj.companyName || '').trim().toLowerCase();
                      if (nextComp && prodComp && prodComp !== nextComp.trim().toLowerCase()) {
                        setSelectedProductObj(null);
                        setProductName('');
                        setProductCode('');
                        setRate('');
                        setPktUnit('1');
                      }
                    }
                  }}
                  onInputChange={(_e, val, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                      setProductCompany(val || '');
                    }
                  }}
                  sx={{ flex: 1, minWidth: '280px', backgroundColor: '#FFFFFF', borderRadius: '8px' }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Type / Select Company..."
                      size="small"
                      fullWidth
                    />
                  )}
                />

                {/* Active Company Status Badge */}
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.2,
                    borderRadius: '8px',
                    backgroundColor: productCompany ? '#BAE6FD' : '#E2E8F0',
                    border: `1.5px solid ${productCompany ? '#93C5FD' : '#CBD5E1'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minWidth: '220px',
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: productCompany ? '#1D4ED8' : '#94A3B8',
                      boxShadow: productCompany ? '0 0 0 3px rgba(37, 99, 235, 0.25)' : 'none',
                    }}
                  />
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 800, color: productCompany ? '#1D4ED8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Active Company
                    </Typography>
                    <Typography sx={{ fontSize: '13.5px', fontWeight: 900, color: productCompany ? '#0F172A' : '#64748B' }}>
                      {productCompany || 'None Selected'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* 2. Product Entry Input Row */}
            <Box
              sx={{
                p: 2,
                mb: 3,
                borderRadius: '10px',
                border: !productCompany || !productCompany.trim() ? '1.5px dashed #CBD5E1' : '1px solid #E2E8F0',
                backgroundColor: !productCompany || !productCompany.trim() ? '#F8FAFC' : '#FFFFFF',
                transition: 'all 0.2s ease',
              }}
            >
              {(!productCompany || !productCompany.trim()) && (
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  ℹ️ Select a Company above first to view and select products.
                </Typography>
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '2.5fr 1.2fr 1fr 0.8fr auto' },
                  gap: 1.5,
                  alignItems: 'center',
                }}
              >
                {/* Customer Product Required */}
                <Autocomplete
                  disabled={!productCompany || !productCompany.trim()}
                  options={filteredProductsForEntry}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    const cName = option.company || option.companyName || '';
                    return `${option.name || ''} ${option.code ? `(${option.code})` : ''} ${cName ? `• ${cName}` : ''}`.trim();
                  }}
                  value={selectedProductObj}
                  onChange={(_e, val) => handleProductSelect(val)}
                  freeSolo={Boolean(productCompany && productCompany.trim())}
                  onInputChange={(_e, newInputValue) => setProductName(newInputValue)}
                  noOptionsText={
                    productCompany && productCompany.trim()
                      ? `No products found for "${productCompany}".`
                      : 'Please select a company above first.'
                  }
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    const optName = typeof option === 'string' ? option : option.name;
                    const optCompany = typeof option === 'string' ? '' : (option.company || option.companyName);
                    const optCode = typeof option === 'string' ? '' : option.code;

                    return (
                      <Box
                        component="li"
                        key={key || (typeof option === 'string' ? option : option._id || option.name)}
                        {...otherProps}
                        sx={{
                          width: '100% !important',
                          display: 'flex !important',
                          flexDirection: 'column !important',
                          alignItems: 'flex-start !important',
                          justifyContent: 'flex-start !important',
                          textAlign: 'left !important',
                          py: 0.8,
                          px: 2,
                        }}
                      >
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left' }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', textAlign: 'left' }}>
                            {optName}
                          </Typography>
                        </Box>
                        {(optCompany || optCode) && (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.3, width: '100%', justifyContent: 'flex-start' }}>
                            {optCompany && (
                              <Chip
                                label={optCompany}
                                size="small"
                                sx={{ height: '18px', fontSize: '10px', fontWeight: 600, backgroundColor: '#F0F9FF', color: '#1D4ED8' }}
                              />
                            )}
                            {optCode && (
                              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                                Code: {optCode}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer Product Required *"
                      size="small"
                      placeholder={
                        productCompany && productCompany.trim()
                          ? `Select product from ${productCompany}...`
                          : 'Select company above first...'
                      }
                    />
                  )}
                />

                {/* Required Cases */}
                <TextField
                  disabled={!productCompany || !productCompany.trim()}
                  label="Required Cases"
                  size="small"
                  type="number"
                  value={requiredCases}
                  onChange={(e) => setRequiredCases(e.target.value)}
                  placeholder="Enter Cases (e.g. 1)"
                />

                {/* Rate */}
                <TextField
                  disabled={!productCompany || !productCompany.trim()}
                  label="Rate (₹)"
                  size="small"
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g. 5000"
                />

                {/* Pkt / Units */}
                <TextField
                  disabled={!productCompany || !productCompany.trim()}
                  label="Units/Pkt"
                  size="small"
                  type="number"
                  value={pktUnit}
                  onChange={(e) => setPktUnit(e.target.value)}
                />

                {/* Add Button */}
                <Button
                  variant="contained"
                  disableElevation
                  disabled={!productCompany || !productCompany.trim()}
                  onClick={handleAddProductRow}
                  startIcon={<AddRoundedIcon />}
                  sx={{
                    backgroundColor: '#1D4ED8',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '13px',
                    textTransform: 'none',
                    borderRadius: '8px',
                    height: '40px',
                    px: 3,
                    '&:hover': {
                      backgroundColor: '#1E40AF',
                    },
                  }}
                >
                   Add
                </Button>
              </Box>
            </Box>

            {/* 3. Grouped Products Tables (By Company / Brand) */}
            <Box sx={{ mb: 2.5 }}>
              {Object.keys(groupedProductRows).length === 0 ? (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    color: '#64748B',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#475569' }}>
                    No product requirements added yet.
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#94A3B8', mt: 0.5 }}>
                    Select a company above, enter product name & required cases, then click <strong>+ Add</strong>.
                  </Typography>
                </Box>
              ) : (
                Object.entries(groupedProductRows).map(([groupComp, items]) => {
                  const groupCases = items.reduce((acc, it) => acc + (parseFloat(it.requiredCases) || 0), 0);
                  const groupAmount = items.reduce((acc, it) => acc + (parseFloat(it.allocatedAmount) || 0), 0);

                  return (
                    <Box
                      key={groupComp}
                      sx={{
                        mb: 2.5,
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      {/* Group Header Row */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#F8FAFC',
                          px: 2.5,
                          py: 1.3,
                          borderBottom: '1.5px solid #E2E8F0',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
                          <Typography
                            sx={{
                              fontWeight: 900,
                              fontSize: '15px',
                              color: '#0F172A',
                              textDecoration: 'underline',
                              textDecorationThickness: '2px',
                              textUnderlineOffset: '4px',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {groupComp}
                          </Typography>
                          <Chip
                            label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                            size="small"
                            sx={{
                              height: '22px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: '#FFFFFF',
                              color: '#475569',
                              border: '1px solid #CBD5E1',
                            }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={`Subtotal: ${groupCases} Cases • ₹${groupAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '12px',
                              fontWeight: 800,
                              backgroundColor: '#F0F9FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Items Table */}
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ backgroundColor: '#FFFFFF' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 800, color: '#64748B', width: '60px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase' }}>
                                S.NO
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                                CUSTOMER PRODUCT REQUIRED
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#64748B', width: '140px', fontSize: '11px', textTransform: 'uppercase' }}>
                                REQUIRED CASES
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#64748B', width: '110px', fontSize: '11px', textTransform: 'uppercase' }}>
                                RATE (₹)
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#64748B', width: '90px', fontSize: '11px', textTransform: 'uppercase' }}>
                                UNITS/PKT
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#64748B', width: '130px', fontSize: '11px', textTransform: 'uppercase' }}>
                                AMOUNT (₹)
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '130px', fontSize: '11px', textTransform: 'uppercase' }}>
                                ACTION
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {items.map((row, idx) => {
                              const isEditing = inlineEditingRowId === row.id;
                              const editCasesNum = parseFloat(inlineEditCases) || 0;
                              const editRateNum = parseFloat(inlineEditRate) || 0;
                              const editPktNum = parseFloat(inlineEditPktUnit) || 1;
                              const liveAllocated = (editCasesNum * editRateNum * editPktNum).toFixed(2);

                              return (
                                <TableRow key={row.id} hover sx={{ '&:last-child td': { borderBottom: 0 }, backgroundColor: isEditing ? '#F0F9FF' : 'inherit' }}>
                                  <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: '#64748B', fontSize: '12.5px' }}>
                                    {idx + 1}
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                                    {row.productName}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center' }}>
                                    {isEditing ? (
                                      <TextField
                                        size="small"
                                        type="number"
                                        autoFocus
                                        value={inlineEditCases}
                                        onChange={(e) => setInlineEditCases(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveInlineEdit(row.id);
                                          if (e.key === 'Escape') handleCancelInlineEdit();
                                        }}
                                        slotProps={{
                                          htmlInput: { min: 1, style: { textAlign: 'center', padding: '4px 6px', fontSize: '13px', fontWeight: 700, color: '#1D4ED8' } },
                                        }}
                                        sx={{ width: '85px', backgroundColor: '#FFFFFF' }}
                                      />
                                    ) : (
                                      <Typography sx={{ fontWeight: 800, color: '#1D4ED8', fontSize: '13px' }}>
                                        {row.requiredCases} Cases
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right' }}>
                                    {isEditing ? (
                                      <TextField
                                        size="small"
                                        type="number"
                                        value={inlineEditRate}
                                        onChange={(e) => setInlineEditRate(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveInlineEdit(row.id);
                                          if (e.key === 'Escape') handleCancelInlineEdit();
                                        }}
                                        slotProps={{
                                          htmlInput: { min: 0, step: 'any', style: { textAlign: 'right', padding: '4px 6px', fontSize: '13px', fontWeight: 600, color: '#334155' } },
                                        }}
                                        sx={{ width: '90px', backgroundColor: '#FFFFFF' }}
                                      />
                                    ) : (
                                      <Typography sx={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                                        ₹{parseFloat(row.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center' }}>
                                    {isEditing ? (
                                      <TextField
                                        size="small"
                                        type="number"
                                        value={inlineEditPktUnit}
                                        onChange={(e) => setInlineEditPktUnit(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveInlineEdit(row.id);
                                          if (e.key === 'Escape') handleCancelInlineEdit();
                                        }}
                                        slotProps={{
                                          htmlInput: { min: 1, style: { textAlign: 'center', padding: '4px 6px', fontSize: '12.5px', fontWeight: 600, color: '#64748B' } },
                                        }}
                                        sx={{ width: '65px', backgroundColor: '#FFFFFF' }}
                                      />
                                    ) : (
                                      <Typography sx={{ color: '#64748B', fontSize: '12.5px', fontWeight: 500 }}>
                                        {row.pktUnit}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#16A34A', fontSize: '13px' }}>
                                    ₹{parseFloat(isEditing ? liveAllocated : row.allocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center' }}>
                                    {isEditing ? (
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                        <Tooltip title="Save (Enter)">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleSaveInlineEdit(row.id)}
                                            sx={{
                                              color: '#FFFFFF',
                                              backgroundColor: '#16A34A',
                                              borderRadius: '6px',
                                              p: 0.6,
                                              '&:hover': { backgroundColor: '#15803D' },
                                            }}
                                          >
                                            <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Cancel (Esc)">
                                          <IconButton
                                            size="small"
                                            onClick={handleCancelInlineEdit}
                                            sx={{
                                              color: '#64748B',
                                              backgroundColor: '#F1F5F9',
                                              borderRadius: '6px',
                                              p: 0.6,
                                              '&:hover': { backgroundColor: '#E2E8F0', color: '#0F172A' },
                                            }}
                                          >
                                            <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    ) : (
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8 }}>
                                        <Tooltip title="Edit Cases, Rate & Units/Pkt">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleStartInlineEdit(row)}
                                            sx={{
                                              color: '#1D4ED8',
                                              backgroundColor: '#EFF6FF',
                                              border: '1px solid #BFDBFE',
                                              borderRadius: '6px',
                                              p: 0.6,
                                              '&:hover': {
                                                backgroundColor: '#DBEAFE',
                                                borderColor: '#93C5FD',
                                              },
                                            }}
                                          >
                                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Remove item">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleRemoveProductRow(row.id)}
                                            sx={{ color: '#EF4444', '&:hover': { backgroundColor: '#FEE2E2' } }}
                                          >
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  );
                })
              )}
            </Box>

            {/* 4. Total Cases & Items Summary Strip */}
            <Box
              sx={{
                p: 2,
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16A34A' }} />
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  {productRows.length} items entered for{' '}
                  <span style={{ color: '#1D4ED8', fontWeight: 800 }}>{selectedCustomer?.name || 'Selected Customer'}</span>
                </Typography>
              </Box>

              <Card
                elevation={0}
                sx={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: '8px',
                  px: 2,
                  py: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Case Total
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 900, color: '#1D4ED8' }}>
                  {totalRequiredCasesCount} Cases
                </Typography>
              </Card>
            </Box>

            {/* Financial Adjustments: Discount, Packing (%), Tax (Amount) */}
            <Box
              sx={{
                mt: 3,
                p: 2.5,
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Financial Adjustments & Charges
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1.5fr' },
                  gap: 2,
                  mb: 2.5,
                  alignItems: 'flex-start',
                }}
              >
                {/* 1. Discount */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Discount (% or ₹)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 5% or 500"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    helperText={discountVal > 0 ? `- ₹${discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Optional discount'}
                    slotProps={{
                      formHelperText: { sx: { color: discountVal > 0 ? '#DC2626' : undefined, fontWeight: 700 } },
                    }}
                  />
                </Box>

                {/* 2. Packing Charge in % */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Packing Charge (%)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 2.5% or 3"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                    helperText={packingVal > 0 ? `+ ₹${packingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (on discounted amt)` : 'Supports decimal (e.g. 2.5%)'}
                    slotProps={{
                      formHelperText: { sx: { color: packingVal > 0 ? '#1D4ED8' : undefined, fontWeight: 600 } },
                    }}
                  />
                </Box>

                {/* 3. Tax in Amount */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                      Tax
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setTax(tax ? '' : '18%')}
                      sx={{
                        fontSize: '11px',
                        fontWeight: 700,
                        py: 0,
                        px: 0.8,
                        minWidth: 0,
                        height: '20px',
                        color: tax ? '#DC2626' : '#166534',
                        backgroundColor: tax ? '#FEF2F2' : '#F0FDF4',
                        borderRadius: '4px',
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: tax ? '#FEE2E2' : '#DCFCE7',
                        },
                      }}
                    >
                      {tax ? 'Clear' : '+ 18% GST'}
                    </Button>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. 18%"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    helperText={
                      taxVal > 0
                        ? `+ ₹${taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : undefined
                    }
                    slotProps={{
                      formHelperText: { sx: { color: taxVal > 0 ? '#166534' : undefined, fontWeight: 700 } },
                    }}
                  />
                </Box>

                {/* 4. Notes */}
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', mb: 0.5 }}>
                    Performa Notes / Terms
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Optional notes or special delivery conditions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Box>
              </Box>

              {/* Aggregates Summary Box & Action Buttons */}
              <Box
                sx={{
                  pt: 2,
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {/* Live Breakdown Badges */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2.5 }, alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Total Cases
                    </Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      {totalRequiredCasesCount}
                    </Typography>
                  </Box>

                  <Box sx={{ height: '28px', width: '1px', backgroundColor: '#CBD5E1', display: { xs: 'none', sm: 'block' } }} />

                  <Box>
                    <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      Subtotal
                    </Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      ₹{subtotalAllocatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>

                  {discountVal > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase' }}>
                        Discount ({discount})
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#DC2626' }}>
                        - ₹{discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}

                  {packingVal > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                        Packing ({packing}%)
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#1D4ED8' }}>
                        + ₹{packingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}

                  {taxVal > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                        Tax ({tax.includes('%') ? tax : `${tax}%`})
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                        + ₹{taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ height: '28px', width: '1px', backgroundColor: '#CBD5E1', display: { xs: 'none', sm: 'block' } }} />

                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 800, textTransform: 'uppercase' }}>
                      Performa Total
                    </Typography>
                    <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#1D4ED8' }}>
                      ₹{finalTotalAllocatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Box>

                {/* Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto' }}>
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    startIcon={<RestartAltRoundedIcon />}
                    sx={{
                      borderColor: '#CBD5E1',
                      color: '#475569',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: '8px',
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleCreatePerforma}
                    disabled={submitLoading || productRows.length === 0 || !selectedCustomer}
                    startIcon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 20 }} />}
                    sx={{
                      backgroundColor: '#1D4ED8',
                      color: '#FFFFFF !important',
                      fontWeight: 800,
                      fontSize: '14.5px',
                      letterSpacing: '0.015em',
                      textTransform: 'none',
                      borderRadius: '8px',
                      px: 3.5,
                      py: 1.1,
                      boxShadow: '0 2px 4px rgba(29, 78, 216, 0.25)',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
                      transition: 'all 0.15s ease-in-out',
                      '&:hover': {
                        backgroundColor: '#1E40AF',
                        boxShadow: '0 4px 8px rgba(29, 78, 216, 0.35)',
                      },
                      '&.Mui-disabled': {
                        backgroundColor: '#E2E8F0 !important',
                        background: '#E2E8F0 !important',
                        color: '#94A3B8 !important',
                        textShadow: 'none',
                        boxShadow: 'none',
                        cursor: 'not-allowed',
                      },
                    }}
                  >
                    {submitLoading ? 'Generating...' : 'Save & Generate Performa'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* SUB-TAB 2: CUSTOMER PERFORMA LIST */}
      {activeSubTab === 'Customer Performa List' && (
        <Box>
          {/* Top Customer Filter Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: '280px' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#F0F9FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ListAltRoundedIcon sx={{ fontSize: 26, color: '#1D4ED8' }} />
              </Box>
              <Box sx={{ flex: 1, maxWidth: '400px' }}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                  value={selectedCustomer}
                  onChange={(_e, val) => setSelectedCustomer(val)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Customer for Performa List"
                      placeholder="Type customer name..."
                      size="small"
                      fullWidth
                    />
                  )}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
              <IconButton
                onClick={() => selectedCustomer && fetchCustomerPerformaData(selectedCustomer)}
                sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}
              >
                <RefreshRoundedIcon sx={{ color: '#475569', fontSize: 20 }} />
              </IconButton>
              <Button
                variant="contained"
                disableElevation
                onClick={() => setActiveSubTab('Create Performa')}
                startIcon={<AddRoundedIcon />}
                sx={{
                  backgroundColor: '#1D4ED8',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  textTransform: 'none',
                  borderRadius: '8px',
                  px: 2,
                  '&:hover': {
                    backgroundColor: '#1E40AF',
                  },
                }}
              >
                Create New Performa
              </Button>
            </Box>
          </Paper>

          {/* Customer Profile Summary Badges */}
          {selectedCustomer && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2, mb: 3 }}>
              <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Total Performas
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', mt: 0.5 }}>
                    {customerPerformas.length}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#F0F9FF' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>
                    Total Cases Entered
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#1D4ED8', mt: 0.5 }}>
                    {customerPerformas.reduce((acc, p) => acc + (p.totalRequiredCases || 0), 0)}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BBF7D0', borderRadius: '10px', backgroundColor: '#F0FDF4' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    Total Performa Value (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#15803D', mt: 0.5 }}>
                    ₹{customerPerformas.reduce((acc, p) => acc + (p.totalAllocatedAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #BFDBFE', borderRadius: '10px', backgroundColor: '#F0F9FF' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>
                    Total Advance (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#1D4ED8', mt: 0.5 }}>
                    ₹{customerPerformas.reduce((acc, p) => acc + (p.advanceAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: '1px solid #FECACA', borderRadius: '10px', backgroundColor: '#FEF2F2' }}>
                <CardContent sx={{ p: '14px !important' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                    Total Balance to Pay (₹)
                  </Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#B91C1C', mt: 0.5 }}>
                    ₹{Math.max(0, customerPerformas.reduce((acc, p) => acc + (p.totalAllocatedAmount || 0), 0) - customerPerformas.reduce((acc, p) => acc + (p.advanceAmount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}



          {/* Customer Performas Table */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
            }}
          >
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#475569', py: 1.5, width: '50px' }}>S.No</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Performa No</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Company / Brand</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>Total Cases</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Total Amount</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Advance Amount</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right', color: '#475569' }}>Balance to Pay</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'center', color: '#475569' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customerPerformasLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                        <CircularProgress size={30} sx={{ color: '#1D4ED8' }} />
                      </TableCell>
                    </TableRow>
                  ) : !selectedCustomer ? (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6, color: '#94A3B8' }}>
                        Please select a customer above to view their performa records.
                      </TableCell>
                    </TableRow>
                  ) : customerPerformas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography sx={{ color: '#64748B', fontWeight: 600, mb: 1 }}>
                          No performas found for {selectedCustomer.name}.
                        </Typography>
                        <Button
                          variant="contained"
                          disableElevation
                          onClick={() => setActiveSubTab('Create Performa')}
                          startIcon={<AddRoundedIcon />}
                          sx={{
                            backgroundColor: '#1D4ED8',
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: '8px',
                          }}
                        >
                          Create Performa for {selectedCustomer.name}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerPerformas.map((p, idx) => {
                      const compDisplay =
                        p.companyName || p.customerSnapshot?.companyName || (p.products?.[0]?.productSnapshot?.companyName) || 'General';
                      const advReceived = p.advanceAmount || 0;
                      const balanceToPay = Math.max(0, (p.totalAllocatedAmount || 0) - advReceived);
                      return (
                        <TableRow key={p._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell sx={{ color: '#64748B' }}>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800, color: '#1D4ED8', fontSize: '13.5px' }}>
                              {p.performaNumber}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {(() => {
                              const isRecent = isWithinLast3Days(p.date, p.createdAt);
                              if (isRecent) {
                                return (
                                  <Tooltip title="Recent Performa (Within last 3 days from system date)" arrow>
                                    <Box
                                      sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.6,
                                        backgroundColor: '#ECFDF5',
                                        border: '1.5px solid #10B981',
                                        color: '#065F46',
                                        px: 1,
                                        py: 0.35,
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        fontSize: '12.5px',
                                        boxShadow: '0 1px 2px rgba(16, 185, 129, 0.15)',
                                      }}
                                    >
                                      <span>{p.date}</span>
                                      <Chip
                                        label="NEW"
                                        size="small"
                                        sx={{
                                          height: '16px',
                                          fontSize: '9px',
                                          fontWeight: 900,
                                          backgroundColor: '#10B981',
                                          color: '#FFFFFF',
                                          px: 0.2,
                                          borderRadius: '4px',
                                        }}
                                      />
                                    </Box>
                                  </Tooltip>
                                );
                              }
                              return (
                                <Typography sx={{ color: '#475569', fontSize: '13px', fontWeight: 500 }}>
                                  {p.date}
                                </Typography>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={<BusinessRoundedIcon sx={{ fontSize: '14px !important' }} />}
                              label={compDisplay}
                              size="small"
                              sx={{
                                backgroundColor: '#F1F5F9',
                                color: '#334155',
                                fontWeight: 700,
                                fontSize: '11.5px',
                                maxWidth: '170px',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                            {p.totalRequiredCases || 0}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            ₹{(p.totalAllocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                            ₹{advReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: balanceToPay > 0 ? '#DC2626' : '#15803D' }}>
                            ₹{balanceToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ color: '#64748B', fontSize: '12.5px', maxWidth: '180px' }}>
                            {p.notes || '-'}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Tooltip title="Share on WhatsApp">
                                <IconButton
                                  size="small"
                                  onClick={() => sharePerformaOnWhatsApp(p)}
                                  sx={{
                                    color: '#FFFFFF',
                                    backgroundColor: '#25D366',
                                    '&:hover': { backgroundColor: '#1EBE5D' },
                                  }}
                                >
                                  <WhatsAppIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Print Performa">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenPrintModal(p)}
                                  sx={{
                                    color: '#1D4ED8',
                                    backgroundColor: '#F0F9FF',
                                    '&:hover': { backgroundColor: '#BAE6FD' },
                                  }}
                                >
                                  <PrintOutlinedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>

                              {onSelectCustomerForBill && p.status !== 'CANCELLED' && p.status !== 'COMPLETED' && (
                                <Tooltip title="Create Particular Bill for this Customer">
                                  <IconButton
                                    size="small"
                                    onClick={() => onSelectCustomerForBill(p.customerSnapshot?.name || '', 'Create Particular')}
                                    sx={{ color: '#059669', '&:hover': { backgroundColor: '#F0F9FF' } }}
                                  >
                                    <ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              )}

                              <Tooltip title="View Details">
                                <IconButton size="small" onClick={() => handleOpenViewModal(p._id)} sx={{ color: '#475569' }}>
                                  <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>

                              {(() => {
                                const isCustomerOrder =
                                  p.createdBy === 'Customer Order' ||
                                  (p.notes && /Customer Online Order/i.test(p.notes));
                                const canEdit = effectiveRole === 'superadmin' || !isCustomerOrder;
                                if (!canEdit) {
                                  return (
                                    <Tooltip title="Customer Online Orders can only be edited by Superadmin">
                                      <span>
                                        <IconButton
                                          size="small"
                                          disabled
                                          sx={{ color: '#94A3B8 !important', cursor: 'not-allowed' }}
                                        >
                                          <ModeEditOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  );
                                }
                                return (
                                  <Tooltip title="Edit Performa">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenEditModal(p)}
                                      sx={{ color: '#2563EB' }}
                                    >
                                      <ModeEditOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                );
                              })()}

                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => handleDeletePerforma(p._id, p.performaNumber)} sx={{ color: '#DC2626' }}>
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* View Performa Details Dialog */}
      <Dialog
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
            color: '#FFFFFF',
            py: 1.8,
            px: 2.5,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '17px', color: '#FFFFFF' }}>
              Performa Details - {selectedPerformaForView?.performaNumber}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#FFFFFF', opacity: 0.95 }}>
              {selectedPerformaForView?.companyName || selectedPerformaForView?.customerSnapshot?.companyName || 'General'} | {selectedPerformaForView?.customerSnapshot?.name} | {selectedPerformaForView?.date}
            </Typography>
          </Box>
          <IconButton onClick={() => setViewModalOpen(false)} sx={{ color: '#FFFFFF', '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' } }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#F8FAFC' }}>
          {viewLoading || !selectedPerformaForView ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={30} sx={{ color: '#1D4ED8' }} />
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 0.5 }}>
                    Customer & Company Details
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                    {selectedPerformaForView.customerSnapshot?.name}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#475569' }}>
                    <strong>Company / Brand:</strong> {selectedPerformaForView.companyName || selectedPerformaForView.customerSnapshot?.companyName || 'General'}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#475569' }}>
                    <strong>Phone:</strong> {selectedPerformaForView.customerSnapshot?.phone || '-'}
                  </Typography>
                  <Typography sx={{ fontSize: '12.5px', color: '#475569' }}>
                    <strong>Address:</strong> {selectedPerformaForView.customerSnapshot?.address || '-'}
                  </Typography>
                </Paper>

                <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 1 }}>
                    Performa Financial Summary
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '12.5px' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Subtotal:</span>
                      <strong>₹{(selectedPerformaForView.subtotal ?? (selectedPerformaForView.products || []).reduce((s: number, p: any) => s + (p.allocatedAmount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Discount:</span>
                      <strong style={{ color: selectedPerformaForView.discountAmount ? '#DC2626' : undefined }}>
                        {selectedPerformaForView.discountAmount ? `- ₹${selectedPerformaForView.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (selectedPerformaForView.discount || '-')}
                      </strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Packing Charge:</span>
                      <strong style={{ color: selectedPerformaForView.packingAmount ? '#1D4ED8' : undefined }}>
                        {selectedPerformaForView.packingAmount ? `+ ₹${selectedPerformaForView.packingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (selectedPerformaForView.packing ? `${selectedPerformaForView.packing}%` : '-')}
                      </strong>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Tax Amount:</span>
                      <strong style={{ color: selectedPerformaForView.taxAmount ? '#166534' : undefined }}>
                        {selectedPerformaForView.taxAmount ? `+ ₹${selectedPerformaForView.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (selectedPerformaForView.tax ? `₹${selectedPerformaForView.tax}` : '-')}
                      </strong>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', pt: 0.8, borderTop: '1px solid #EEF2F6' }}>
                      <span style={{ color: '#1D4ED8', fontWeight: 800 }}>Performa Total Value:</span>
                      <strong style={{ color: '#1D4ED8', fontSize: '14.5px', fontWeight: 900 }}>
                        ₹{(selectedPerformaForView.totalAllocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </Box>
                  </Box>
                  {selectedPerformaForView.notes && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #EEF2F6', fontSize: '12px', color: '#475569' }}>
                      <strong>Notes:</strong> {selectedPerformaForView.notes}
                    </Box>
                  )}
                </Paper>
              </Box>

              <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 1.5 }}>
                Product Allocation
              </Typography>
              <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', mb: 3, backgroundColor: '#FFFFFF' }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#F1F5F9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, width: '50px' }}>S.No</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Product Name & Code</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Company / Brand</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'center', width: '90px' }}>Total Cases</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right', width: '90px' }}>Rate (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right', width: '110px' }}>Allocated (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPerformaForView.products || []).map((prod: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ color: '#64748B' }}>{idx + 1}</TableCell>
                        <TableCell>
                          <strong>{prod.productSnapshot?.productName || prod.productName}</strong>
                          {prod.productSnapshot?.productCode && (
                            <div style={{ fontSize: '11px', color: '#64748B' }}>Code: {prod.productSnapshot.productCode}</div>
                          )}
                        </TableCell>
                        <TableCell sx={{ color: '#1D4ED8', fontWeight: 600 }}>
                          {prod.productSnapshot?.companyName || prod.companyName || selectedPerformaForView.companyName || '-'}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                          {prod.requiredCases}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>₹{prod.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                          ₹{prod.allocatedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
          <Button onClick={() => setViewModalOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Close
          </Button>
          {selectedPerformaForView && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                disableElevation
                onClick={() => {
                  sharePerformaOnWhatsApp(selectedPerformaForView);
                }}
                startIcon={<WhatsAppIcon sx={{ fontSize: 18 }} />}
                sx={{
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { backgroundColor: '#1EBE5D' },
                }}
              >
                Share on WhatsApp
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={() => {
                  setViewModalOpen(false);
                  handleOpenPrintModal(selectedPerformaForView);
                }}
                startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
                sx={{ backgroundColor: '#1D4ED8', '&:hover': { backgroundColor: '#1E40AF' }, textTransform: 'none', fontWeight: 700 }}
              >
                Print Performa
              </Button>
              {onSelectCustomerForBill && selectedPerformaForView.status !== 'CANCELLED' && (
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => {
                    setViewModalOpen(false);
                    const custName = selectedPerformaForView.customerSnapshot?.name || '';
                    onSelectCustomerForBill(custName, 'Create Particular');
                  }}
                  startIcon={<ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    textTransform: 'none',
                    fontWeight: 700,
                    '&:hover': { backgroundColor: '#1D4ED8' },
                  }}
                >
                  Create Bill / Particular
                </Button>
              )}
            </Box>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Performa Dialog */}
      <Dialog
        open={editModalOpen}
        onClose={() => !editLoading && setEditModalOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', color: '#FFFFFF', py: 1.8 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '17px' }}>
              Edit Performa - {editPerformaNumber}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
              Modify brand/company, customer information, status, and product quantities
            </Typography>
          </Box>
          <IconButton onClick={() => !editLoading && setEditModalOpen(false)} sx={{ color: '#FFFFFF' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#F8FAFC' }}>
          {editLoading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={30} sx={{ color: '#1D4ED8' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', mb: 2 }}>
                  Performa Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.2fr 1.2fr 1fr 1fr' }, gap: 2 }}>
                  <Autocomplete
                    freeSolo
                    options={companies.map((c) => c.name).filter(Boolean)}
                    value={editCompanyName}
                    onChange={(_e, val) => setEditCompanyName(val || '')}
                    onInputChange={(_e, val) => setEditCompanyName(val || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Company / Brand" size="small" fullWidth />
                    )}
                  />

                  <TextField
                    label="Customer Name"
                    size="small"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    fullWidth
                  />

                  <TextField
                    label="Performa Date"
                    type="date"
                    size="small"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />

                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={editStatus}
                      label="Status"
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                      <MenuItem value="PARTIALLY_USED">PARTIALLY USED</MenuItem>
                      <MenuItem value="COMPLETED">COMPLETED</MenuItem>
                      <MenuItem value="CANCELLED">CANCELLED</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 2fr' }, gap: 2, mt: 2 }}>
                  <TextField
                    label="Phone"
                    size="small"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                  />
                  <TextField
                    label="GST Number"
                    size="small"
                    value={editCustomerGst}
                    onChange={(e) => setEditCustomerGst(e.target.value)}
                  />
                  <TextField
                    label="Address & Notes"
                    size="small"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </Box>

                {/* Financial Adjustments in Edit Modal */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mt: 2, pt: 2, borderTop: '1px solid #EEF2F6' }}>
                  <TextField
                    label="Discount (% or ₹)"
                    size="small"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    placeholder="e.g. 5% or 500"
                    helperText={editDiscountVal > 0 ? `- ₹${editDiscountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined}
                    slotProps={{
                      formHelperText: { sx: { color: '#DC2626', fontWeight: 700 } },
                    }}
                  />
                  <TextField
                    label="Packing Charge (%)"
                    size="small"
                    value={editPacking}
                    onChange={(e) => setEditPacking(e.target.value)}
                    placeholder="e.g. 2.5% or 3"
                    helperText={editPackingVal > 0 ? `+ ₹${editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Supports decimal (%)'}
                    slotProps={{
                      formHelperText: { sx: { color: '#1D4ED8', fontWeight: 600 } },
                    }}
                  />
                  <TextField
                    label="Tax (₹ Amount)"
                    size="small"
                    type="number"
                    value={editTax}
                    onChange={(e) => setEditTax(e.target.value)}
                    placeholder="e.g. 1000"
                    helperText={editTaxVal > 0 ? `+ ₹${editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined}
                    slotProps={{
                      formHelperText: { sx: { color: '#166534', fontWeight: 600 } },
                    }}
                  />
                </Box>
              </Paper>

              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                    Allocated Products & Quantities
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <Chip label={`Cases: ${editTotalCases}`} sx={{ fontWeight: 800, backgroundColor: '#F0F9FF', color: '#1D4ED8' }} />
                    <Chip label={`Subtotal: ₹${editSubtotalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }} />
                    {editDiscountVal > 0 && (
                      <Chip label={`Discount: -₹${editDiscountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#FEF2F2', color: '#DC2626' }} />
                    )}
                    {editPackingVal > 0 && (
                      <Chip label={`Packing: +₹${editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#F0F9FF', color: '#1D4ED8' }} />
                    )}
                    {editTaxVal > 0 && (
                      <Chip label={`Tax: +₹${editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 700, backgroundColor: '#F0FDF4', color: '#166534' }} />
                    )}
                    <Chip label={`Net Total: ₹${editFinalTotalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sx={{ fontWeight: 900, backgroundColor: '#BAE6FD', color: '#1D4ED8' }} />
                  </Box>
                </Box>

                {/* Add new product line / extra quantity row in Edit Modal */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1.5fr 1fr 1fr 1fr 0.8fr auto' },
                    gap: 1.5,
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    p: 1.5,
                    borderRadius: '8px',
                    border: '1px solid #EEF2F6',
                    mb: 2,
                  }}
                >
                  <Autocomplete
                    options={filteredEditModalProducts}
                    getOptionLabel={(o) => {
                      if (typeof o === 'string') return o;
                      return `${o.name || ''} ${o.code ? `(${o.code})` : ''} ${o.companyName ? `• ${o.companyName}` : ''}`.trim();
                    }}
                    value={editNewProductObj}
                    onChange={(_e, val) => {
                      setEditNewProductObj(val);
                      if (val) {
                        setEditNewProductName(val.name || '');
                        setEditNewProductCode(val.code || val.idCode || '');
                        setEditNewProductCompany(val.companyName || editCompanyName || '');
                        setEditNewRate(val.rate ? String(val.rate) : '');
                        setEditNewPktUnit(val.pktUnit ? String(val.pktUnit) : '1');
                      }
                    }}
                    freeSolo
                    onInputChange={(_e, val) => setEditNewProductName(val || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Add Product / Extra Qty" placeholder="Select or type product..." size="small" />
                    )}
                  />

                  <Autocomplete
                    freeSolo
                    options={companies.map((c) => c.name).filter(Boolean)}
                    value={editNewProductCompany}
                    onChange={(_e, val) => setEditNewProductCompany(val || '')}
                    onInputChange={(_e, val) => setEditNewProductCompany(val || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Company / Brand" size="small" placeholder="Brand name" />
                    )}
                  />

                  <TextField
                    label="Req Cases"
                    type="number"
                    size="small"
                    value={editNewCases}
                    onChange={(e) => setEditNewCases(e.target.value)}
                    placeholder="e.g. 10"
                  />

                  <TextField
                    label="Rate (₹)"
                    type="number"
                    size="small"
                    value={editNewRate}
                    onChange={(e) => setEditNewRate(e.target.value)}
                    placeholder="e.g. 5000"
                  />

                  <TextField
                    label="Pkt/Unit"
                    type="number"
                    size="small"
                    value={editNewPktUnit}
                    onChange={(e) => setEditNewPktUnit(e.target.value)}
                  />

                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleAddProductToEditList}
                    startIcon={<AddRoundedIcon />}
                    sx={{ backgroundColor: '#1D4ED8', '&:hover': { backgroundColor: '#1E40AF' }, textTransform: 'none', fontWeight: 700, height: '40px', px: 2 }}
                  >
                    + Add
                  </Button>
                </Box>

                <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#F8FAFC' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>Product Name & Code</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Company / Brand</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '200px' }}>Req Cases</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '110px' }}>Rate (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '80px' }}>Pkt/Unit</TableCell>
                        <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Allocated (₹)</TableCell>
                        <TableCell sx={{ fontWeight: 800, width: '50px', textAlign: 'center' }}>Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700, fontSize: '13px' }}>{p.productName}</Typography>
                            <Typography sx={{ fontSize: '11px', color: '#64748B' }}>{p.productCode}</Typography>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={p.companyName}
                              onChange={(e) => handleEditProductChange(p.id, 'companyName', e.target.value)}
                              sx={{ maxWidth: '140px' }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={p.requiredCases}
                              onChange={(e) => handleEditProductChange(p.id, 'requiredCases', e.target.value)}
                              sx={{ width: '85px' }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={p.rate}
                              onChange={(e) => handleEditProductChange(p.id, 'rate', e.target.value)}
                              sx={{ width: '90px' }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={p.pktPerUnit}
                              onChange={(e) => handleEditProductChange(p.id, 'pktPerUnit', e.target.value)}
                              sx={{ width: '65px' }}
                            />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                            ₹{(parseFloat(String(p.allocatedAmount)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <IconButton size="small" onClick={() => handleRemoveEditProductRow(p.id)} sx={{ color: '#DC2626' }}>
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={() => setEditModalOpen(false)} sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEditPerforma}
            disabled={editLoading}
            sx={{ backgroundColor: '#1D4ED8', '&:hover': { backgroundColor: '#1E40AF' }, textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Extra Quantity Dialog */}
      <Dialog
        open={extraQtyDialog.open}
        onClose={() => setExtraQtyDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '14px', overflow: 'hidden' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            py: 1.8,
            px: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <AddCircleOutlineRoundedIcon sx={{ color: '#38BDF8', fontSize: 24 }} />
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '16px', lineHeight: 1.2 }}>
                {extraQtyDialog.mode === 'duplicate_detected'
                  ? 'Product Already Exists - Add Extra Quantity'
                  : 'Add Extra Quantity to Product'}
              </Typography>
              <Typography sx={{ fontSize: '11.5px', color: '#94A3B8', mt: 0.2 }}>
                {extraQtyDialog.productName} {extraQtyDialog.companyName ? `• ${extraQtyDialog.companyName}` : ''}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={() => setExtraQtyDialog((prev) => ({ ...prev, open: false }))}
            sx={{ color: '#94A3B8', '&:hover': { color: '#FFFFFF' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, backgroundColor: '#F8FAFC' }}>
          {extraQtyDialog.mode === 'duplicate_detected' && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: '8px', fontSize: '12.5px', fontWeight: 600 }}>
              <strong>{extraQtyDialog.productName}</strong> is already in this performa! You can add extra quantity to update the total cases seamlessly.
            </Alert>
          )}

          {/* Product & Current Status Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Product & Brand
                </Typography>
                <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  {extraQtyDialog.productName}
                </Typography>
                {extraQtyDialog.companyName && (
                  <Chip
                    label={extraQtyDialog.companyName}
                    size="small"
                    sx={{ height: '20px', fontSize: '10.5px', fontWeight: 700, mt: 0.5, backgroundColor: '#F0F9FF', color: '#1D4ED8' }}
                  />
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Current Requirement
                </Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 900, color: '#1D4ED8' }}>
                  {extraQtyDialog.existingCases} Cases
                </Typography>
                <Typography sx={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
                  @ ₹{extraQtyDialog.rate.toLocaleString('en-IN')} (Unit: {extraQtyDialog.pktUnit})
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Extra Quantity Input Section */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: '10px',
              border: '1px solid #BFDBFE',
              backgroundColor: '#F0F7FF',
            }}
          >
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#1D4ED8', mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Extra Cases to Add
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
              <TextField
                autoFocus
                type="number"
                size="small"
                placeholder="Enter extra cases (e.g. 5)"
                value={extraQtyDialog.extraCases}
                onChange={(e) =>
                  setExtraQtyDialog((prev) => ({ ...prev, extraCases: e.target.value }))
                }
                sx={{ flex: 1, minWidth: '180px', backgroundColor: '#FFFFFF', borderRadius: '8px' }}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">Cases</InputAdornment>,
                  },
                }}
              />
            </Box>

            {/* Quick Add Chips */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                Quick Add:
              </Typography>
              {[1, 2, 5, 10, 20, 50].map((inc) => (
                <Chip
                  key={inc}
                  label={`+${inc}`}
                  size="small"
                  clickable
                  onClick={() => {
                    const current = parseFloat(String(extraQtyDialog.extraCases)) || 0;
                    setExtraQtyDialog((prev) => ({
                      ...prev,
                      extraCases: String(current + inc),
                    }));
                  }}
                  sx={{
                    fontWeight: 800,
                    fontSize: '11px',
                    backgroundColor: '#FFFFFF',
                    color: '#1D4ED8',
                    border: '1px solid #93C5FD',
                    '&:hover': {
                      backgroundColor: '#BAE6FD',
                    },
                  }}
                />
              ))}
            </Box>
          </Paper>

          {/* TOTAL CASES CALCULATION PREVIEW BANNER */}
          {(() => {
            const extraNum = parseFloat(String(extraQtyDialog.extraCases)) || 0;
            const totalCasesNum = extraQtyDialog.existingCases + extraNum;
            const currentAmount = extraQtyDialog.existingCases * extraQtyDialog.rate * extraQtyDialog.pktUnit;
            const extraAmount = extraNum * extraQtyDialog.rate * extraQtyDialog.pktUnit;
            const newTotalAmount = totalCasesNum * extraQtyDialog.rate * extraQtyDialog.pktUnit;

            return (
              <Paper
                elevation={0}
                sx={{
                  p: 2.2,
                  borderRadius: '10px',
                  border: '2px solid #16A34A',
                  backgroundColor: '#F0FDF4',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Cases Calculation
                  </Typography>
                  <Chip
                    label="Live Preview"
                    size="small"
                    sx={{ height: '20px', fontSize: '10px', fontWeight: 800, backgroundColor: '#DCFCE7', color: '#15803D' }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 2 }, py: 1, backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #BBF7D0', mb: 1.5 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Existing Cases</Typography>
                    <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                      {extraQtyDialog.existingCases}
                    </Typography>
                  </Box>

                  <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#1D4ED8' }}>+</Typography>

                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 700 }}>Extra Added</Typography>
                    <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#2563EB' }}>
                      {extraNum}
                    </Typography>
                  </Box>

                  <Typography sx={{ fontSize: '20px', fontWeight: 900, color: '#16A34A' }}>=</Typography>

                  <Box sx={{ textAlign: 'center', px: 1.5, py: 0.5, borderRadius: '6px', backgroundColor: '#DCFCE7' }}>
                    <Typography sx={{ fontSize: '11px', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>Total Cases</Typography>
                    <Typography sx={{ fontSize: '22px', fontWeight: 900, color: '#15803D' }}>
                      {totalCasesNum} Cases
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#334155', fontWeight: 600, flexWrap: 'wrap', gap: 1 }}>
                  <span>Previous Amt: ₹{currentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span>+ Extra: ₹{extraAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span style={{ color: '#15803D', fontWeight: 800 }}>
                    New Total: ₹{newTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </Box>
              </Paper>
            );
          })()}
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', justifyContent: 'space-between' }}>
          <Button
            onClick={() => setExtraQtyDialog((prev) => ({ ...prev, open: false }))}
            sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}
          >
            Cancel
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {extraQtyDialog.mode === 'duplicate_detected' && extraQtyDialog.pendingNewRow && (
              <Button
                variant="outlined"
                onClick={() => {
                  if (extraQtyDialog.isEditModal) {
                    setEditProducts((prev) => [...prev, extraQtyDialog.pendingNewRow as EditProductItem]);
                    setEditNewProductObj(null);
                    setEditNewProductName('');
                    setEditNewProductCode('');
                    setEditNewCases('');
                    setEditNewRate('');
                    setEditNewPktUnit('1');
                  } else {
                    setProductRows((prev) => [...prev, extraQtyDialog.pendingNewRow as ProductRowItem]);
                    setSelectedProductObj(null);
                    setProductName('');
                    setProductCode('');
                    setRequiredCases('');
                    setRate('');
                    setPktUnit('1');
                  }
                  setExtraQtyDialog((prev) => ({ ...prev, open: false }));
                  setToast({ open: true, message: 'Added as separate row', severity: 'info' });
                }}
                sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#CBD5E1', color: '#475569' }}
              >
                Add as Separate Row
              </Button>
            )}

            {(() => {
              const extraNum = parseFloat(String(extraQtyDialog.extraCases)) || 0;
              const totalCasesNum = extraQtyDialog.existingCases + extraNum;
              return (
                <Button
                  variant="contained"
                  disableElevation
                  disabled={extraNum <= 0}
                  onClick={handleConfirmExtraQty}
                  sx={{
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    textTransform: 'none',
                    px: 2.5,
                    '&:hover': { backgroundColor: '#15803D' },
                  }}
                >
                  Confirm & Update Total ({totalCasesNum} Cases)
                </Button>
              );
            })()}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Performa Print Modal */}
      <PerformaPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        performa={currentPerformaForPrint}
      />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })}
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
