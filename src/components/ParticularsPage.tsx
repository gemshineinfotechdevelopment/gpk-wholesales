import { useState, useEffect, useMemo, type FC } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import {
  CustomersApi,
  CompaniesApi,
  ProductsApi,
  ParticularsApi,
  AccountsApi,
  PerformasApi,
} from '../services/api';
import { BillPrintModal } from './BillPrintModal';
import type { BillPrintData } from './BillPrintTemplate';
import { printBillDirectly, printLedgerStatementDirectly, printParticularsListDirectly } from '../utils/printUtils';
import {
  shareBillOnWhatsApp,
  shareLedgerOnWhatsApp,
  shareParticularsListOnWhatsApp,
} from '../utils/whatsappUtils';
import { DateRangePrintModal } from './DateRangePrintModal';
import { DatePickerField } from './DatePickerField';

export type ParticularSubTab =
  | 'Select Customer'
  | 'Create Particular'
  | 'Account Details'
  | 'Particular Details'
  | 'Add Credit';

const SUB_TABS: ParticularSubTab[] = [
  'Select Customer',
  'Create Particular',
  'Account Details',
  'Particular Details',
  'Add Credit',
];

interface ProductRowItem {
  id: string;
  particular: string;
  quantity: string;
  rate: string;
  pktUnit: string;
  amount: string;
  isAdditional?: boolean;
}

interface ParticularsPageProps {
  initialCustomerName?: string;
  initialSubTab?: ParticularSubTab;
  userRole?: 'superadmin' | 'admin' | 'user';
  onNavigateToPerforma?: (customerName?: string) => void;
}

export const ParticularsPage: FC<ParticularsPageProps> = ({
  initialCustomerName,
  initialSubTab,
  userRole = 'superadmin',
  onNavigateToPerforma,
}) => {
  const isCustomer = userRole === 'user';
  const [activeSubTab, setActiveSubTab] = useState<ParticularSubTab>(() => {
    if (isCustomer) return 'Account Details';
    return initialSubTab || (localStorage.getItem('gpk_particular_subtab') as ParticularSubTab) || (localStorage.getItem('dheeksha_particular_subtab') as ParticularSubTab) || 'Select Customer';
  });

  // Live Dropdown options
  const [customerOptions, setCustomerOptions] = useState<{ id: string; name: string }[]>([]);
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);

  // Persistent Selected Customer for Creation & Filter
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [currentCustomerName, setCurrentCustomerName] = useState<string>(() => {
    return initialCustomerName || '';
  });
  const [filterCustomer, setFilterCustomer] = useState<string>(() => {
    return initialCustomerName || '';
  });

  const [accountCustomerInput, setAccountCustomerInput] = useState<string>(() => {
    return initialCustomerName && initialCustomerName !== 'ALL' ? initialCustomerName : (isCustomer ? '' : 'All Customers');
  });
  const [particularCustomerInput, setParticularCustomerInput] = useState<string>(() => {
    return initialCustomerName && initialCustomerName !== 'ALL' ? initialCustomerName : (isCustomer ? '' : 'All Customers');
  });

  useEffect(() => {
    const name = filterCustomer && filterCustomer !== 'ALL'
      ? filterCustomer
      : (currentCustomerName && currentCustomerName !== 'ALL' ? currentCustomerName : 'All Customers');
    setAccountCustomerInput(name);
    setParticularCustomerInput(name);
  }, [filterCustomer, currentCustomerName]);

  const activeSelectedCustomer = isCustomer
    ? (initialCustomerName || currentCustomerName || filterCustomer || 'Customer')
    : (filterCustomer && filterCustomer !== 'ALL' && filterCustomer !== 'All Customers'
        ? filterCustomer
        : (currentCustomerName && currentCustomerName !== 'ALL' && currentCustomerName !== 'All Customers' ? currentCustomerName : ''));

  const isSingleCustomer = isCustomer || Boolean(activeSelectedCustomer);

  // Subtab 2: Create Particular Form State
  const [caseCount, setCaseCount] = useState<string>('0');
  const [company, setCompany] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [transport, setTransport] = useState<string>('');
  const [packing, setPacking] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [tax, setTax] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });

  // Product Entry Form State
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [pkt, setPkt] = useState<string>('');
  const [productRows, setProductRows] = useState<ProductRowItem[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<{
    particular: string;
    quantity: string;
    rate: string;
    pktUnit: string;
  }>({ particular: '', quantity: '', rate: '', pktUnit: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // Customer Active Performa Summary State
  const [performaSummary, setPerformaSummary] = useState<any | null>(null);
  const [_loadingPerforma, setLoadingPerforma] = useState<boolean>(false);

  // Warning Dialog State for Additional Product / Exceeded Cases
  const [warningDialog, setWarningDialog] = useState<{
    open: boolean;
    type: 'NEW_PRODUCT' | 'EXCEEDED_CASES';
    productName: string;
    quantity: string;
    rate: string;
    pkt: string;
    performaNumber: string;
    remainingCases: number;
    extraCases: number;
    pendingRowData?: {
      particular: string;
      quantity: string;
      rate: string;
      pktUnit: string;
      isEdit?: boolean;
      editId?: string;
    };
  }>({
    open: false,
    type: 'NEW_PRODUCT',
    productName: '',
    quantity: '',
    rate: '',
    pkt: '',
    performaNumber: '',
    remainingCases: 0,
    extraCases: 0,
  });

  // Subtab 3: Account Details State
  const [accountDetails, setAccountDetails] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);

  // Subtab 4: Particular Details State
  const [particularDetails, setParticularDetails] = useState<any[]>([]);
  const [particularLoading, setParticularLoading] = useState(false);
  const [filterParticularCompany, setFilterParticularCompany] = useState<string>('ALL');

  const filteredParticularRows = useMemo(() => {
    return particularDetails.filter((row) => {
      if (filterParticularCompany && filterParticularCompany !== 'ALL') {
        const rowComp = (row.companyName || '').trim().toLowerCase();
        if (rowComp !== filterParticularCompany.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [particularDetails, filterParticularCompany]);

  const particularCasesSummary = useMemo(() => {
    let totalBooked = 0;
    let totalOut = 0;
    let totalPending = 0;

    const uniqueCusts = new Map<string, { booked: number; out: number; pending: number }>();
    for (const r of filteredParticularRows) {
      const cKey = (r.customerName || '').toLowerCase().trim();
      const bCases = Number(r.totalCustomerCases) || 0;
      const oCases = Number(r.deliveredCaseCount) || 0;
      const pCases = Number(r.pendingCaseCount) || 0;

      if (!uniqueCusts.has(cKey)) {
        uniqueCusts.set(cKey, { booked: bCases, out: oCases, pending: pCases });
      } else {
        const existing = uniqueCusts.get(cKey)!;
        if (bCases > existing.booked) existing.booked = bCases;
        if (oCases > existing.out) existing.out = oCases;
        if (pCases > existing.pending) existing.pending = pCases;
      }
    }

    for (const val of uniqueCusts.values()) {
      totalBooked += val.booked;
      totalOut += val.out;
      totalPending += (val.booked > 0 ? Math.max(0, val.booked - val.out) : val.pending);
    }

    if (totalOut === 0) {
      totalOut = filteredParticularRows.reduce((acc, r) => acc + (parseFloat(r.caseCount) || 0), 0);
    }

    return { totalBooked, totalOut, totalPending, totalBills: filteredParticularRows.length };
  }, [filteredParticularRows]);

  // Subtab 5: Add Credit Form State
  const [addCreditCustomerName, setAddCreditCustomerName] = useState<string>('');
  const [addCreditCompanyName, setAddCreditCompanyName] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditNotes, setCreditNotes] = useState<string>('Additional customer advance');
  const [creditDate, setCreditDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });
  const [creditLoading, setCreditLoading] = useState(false);

  // Bill Print Modal State
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<BillPrintData | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [openAccountDateModal, setOpenAccountDateModal] = useState(false);
  const [openParticularDateModal, setOpenParticularDateModal] = useState(false);

  // Edit Particular Modal State
  const [openEditParticularModal, setOpenEditParticularModal] = useState(false);
  const [editingParticularId, setEditingParticularId] = useState<string | null>(null);
  const [editBillForm, setEditBillForm] = useState<{
    billNo: string;
    date: string;
    customerName: string;
    companyName: string;
    transport: string;
    caseCount: string;
    discount: string;
    packing: string;
    tax: string;
    products: Array<{
      id?: string;
      particular: string;
      quantity: string;
      rate: string;
      pktUnit: string;
      amount: string;
    }>;
  }>({
    billNo: '',
    date: '',
    customerName: '',
    companyName: '',
    transport: '',
    caseCount: '0',
    discount: '0',
    packing: '0',
    tax: '0',
    products: [],
  });
  const [editBillLoading, setEditBillLoading] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Automatically calculate total case count from added product rows
  useEffect(() => {
    if (productRows.length > 0) {
      const totalCases = productRows.reduce((acc, row) => acc + (parseFloat(row.quantity) || 0), 0);
      setCaseCount(String(totalCases));
    } else {
      setCaseCount('0');
    }
  }, [productRows]);

  // Update customer when prop changes
  useEffect(() => {
    if (initialCustomerName) {
      setCurrentCustomerName(initialCustomerName);
      setFilterCustomer(initialCustomerName);
      setAddCreditCustomerName(initialCustomerName);
      const match = customerOptions.find((c) => c.name === initialCustomerName);
      if (match) {
        setSelectedCustomerId(match.id);
      }
    } else {
      setCurrentCustomerName('');
      setFilterCustomer('');
      setAddCreditCustomerName('');
      setSelectedCustomerId('');
    }
  }, [initialCustomerName, customerOptions]);

  // Update subtab when prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
      localStorage.setItem('gpk_particular_subtab', initialSubTab);
    }
  }, [initialSubTab]);

  // Persist activeSubTab whenever it changes
  useEffect(() => {
    if (activeSubTab) {
      localStorage.setItem('gpk_particular_subtab', activeSubTab);
    }
  }, [activeSubTab]);

  // Fetch Customer Performa Summary whenever customer changes
  useEffect(() => {
    if (!currentCustomerName || currentCustomerName === 'ALL' || currentCustomerName === 'All Customers') {
      setPerformaSummary(null);
      return;
    }
    let isMounted = true;
    const loadPerforma = async () => {
      try {
        setLoadingPerforma(true);
        const res = await PerformasApi.getCustomerSummary(currentCustomerName);
        if (isMounted) {
          setPerformaSummary(res);
        }
      } catch (err) {
        console.warn('Failed to fetch customer performa summary:', err);
        if (isMounted) setPerformaSummary(null);
      } finally {
        if (isMounted) setLoadingPerforma(false);
      }
    };
    loadPerforma();
    return () => {
      isMounted = false;
    };
  }, [currentCustomerName]);

  // Load Dropdown Options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [custRes, compRes, prodRes] = await Promise.all([
          CustomersApi.getAll(),
          CompaniesApi.getAll(),
          ProductsApi.getAll(),
        ]);

        if (custRes && custRes.length > 0) {
          const mapped = custRes.map((c: any) => ({ id: c._id || c.id, name: c.name }));
          setCustomerOptions(mapped);

          if (currentCustomerName) {
            const existing = mapped.find((c: any) => c.name === currentCustomerName);
            if (existing) {
              setSelectedCustomerId(existing.id);
              setAddCreditCustomerName(existing.name);
              setFilterCustomer(existing.name);
            }
          }
        }

        if (compRes && compRes.length > 0) {
          const mapped = compRes.map((c: any) => ({ id: c._id || c.id, name: c.name }));
          setCompanyOptions(mapped);
        }

        if (prodRes && prodRes.length > 0) {
          const mapped = prodRes.map((p: any) => ({ id: p._id || p.id, name: p.name }));
          setProductOptions(mapped);
        }
      } catch (err) {
        console.error('Error loading dropdown options:', err);
      }
    };
    loadOptions();
  }, []);

  // Fetch Accounts
  const fetchAccounts = async (targetCustomer?: string) => {
    try {
      setAccountLoading(true);
      const cust = isCustomer
        ? (initialCustomerName || currentCustomerName || filterCustomer)
        : (targetCustomer !== undefined ? targetCustomer : (filterCustomer || currentCustomerName));

      if (isCustomer && (!cust || cust === 'ALL')) {
        setAccountDetails([]);
        return;
      }

      const data = await AccountsApi.getAll(cust && cust !== 'ALL' ? cust : undefined);
      setAccountDetails(data || []);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  // Fetch Particulars (Loads bills filtered by customer, or all)
  const fetchParticulars = async (targetCustomer?: string) => {
    try {
      setParticularLoading(true);
      const cust = isCustomer
        ? (initialCustomerName || currentCustomerName || filterCustomer)
        : (targetCustomer !== undefined ? targetCustomer : (filterCustomer || currentCustomerName));

      if (isCustomer && (!cust || cust === 'ALL')) {
        setParticularDetails([]);
        return;
      }

      const data = await ParticularsApi.getAll(cust && cust !== 'ALL' ? cust : undefined);
      setParticularDetails(data || []);
    } catch (err) {
      console.error('Failed to load particulars:', err);
    } finally {
      setParticularLoading(false);
    }
  };

  useEffect(() => {
    if (isCustomer && activeSubTab !== 'Account Details' && activeSubTab !== 'Particular Details') {
      setActiveSubTab('Account Details');
    }
  }, [isCustomer, activeSubTab]);

  useEffect(() => {
    const custToFetch = isCustomer
      ? (initialCustomerName || currentCustomerName || filterCustomer)
      : (filterCustomer || currentCustomerName);
    if (activeSubTab === 'Account Details') {
      fetchAccounts(custToFetch);
    } else if (activeSubTab === 'Particular Details') {
      fetchParticulars(custToFetch);
    }
  }, [activeSubTab, filterCustomer, currentCustomerName, initialCustomerName, isCustomer]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    accountDetails.forEach((row) => {
      totalDebit += parseFloat(String(row.debit || '0').replace(/,/g, '')) || 0;
      totalCredit += parseFloat(String(row.credit || '0').replace(/,/g, '')) || 0;
    });
    return {
      totalDebit,
      totalCredit,
      netBalance: totalCredit - totalDebit,
    };
  }, [accountDetails]);

  const handleSelectCustomerClick = () => {
    if (!selectedCustomerId && !currentCustomerName) {
      alert('Please select a customer first');
      return;
    }
    setActiveSubTab('Create Particular');
  };

  // Helper to add product row to state
  const executeAddProductRow = (
    prodName: string,
    qty: string,
    rt: string,
    pktUnitVal: string,
    isAdditional: boolean
  ) => {
    const caseVal = parseFloat(qty) || 0;
    const piecesPerCase = parseFloat(pktUnitVal) || 1;
    const totalPieces = caseVal * (piecesPerCase > 0 ? piecesPerCase : 1);
    const lineAmt = (totalPieces * (parseFloat(rt) || 0)).toFixed(2);

    const newRow: ProductRowItem = {
      id: Date.now().toString(),
      particular: prodName,
      quantity: qty,
      rate: rt,
      pktUnit: pktUnitVal && pktUnitVal !== '' ? pktUnitVal : '-',
      amount: lineAmt,
      isAdditional,
    };
    setProductRows((prev) => [...prev, newRow]);
    setSelectedProduct('');
    setQuantity('');
    setRate('');
    setPkt('');
  };

  // Helper to save edited row to state
  const executeSaveEditRow = (
    id: string,
    prodName: string,
    qty: string,
    rt: string,
    pktUnitVal: string,
    isAdditional: boolean
  ) => {
    const caseVal = parseFloat(qty) || 0;
    const piecesPerCase = parseFloat(pktUnitVal) || 1;
    const totalPieces = caseVal * (piecesPerCase > 0 ? piecesPerCase : 1);
    const lineAmt = (totalPieces * (parseFloat(rt) || 0)).toFixed(2);

    setProductRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              particular: prodName.trim(),
              quantity: qty.trim(),
              rate: rt.trim(),
              pktUnit: pktUnitVal.trim() !== '' ? pktUnitVal.trim() : '-',
              amount: lineAmt,
              isAdditional,
            }
          : row
      )
    );
    setEditingRowId(null);
  };

  // Navigate to Performa Page for customer to add products
  const handleGoToCustomerPerforma = () => {
    const cust = currentCustomerName || filterCustomer || '';
    if (cust) {
      localStorage.setItem('gpk_active_customer', cust);
    }
    localStorage.setItem('gpk_active_tab', 'Performa');
    setWarningDialog((prev) => ({ ...prev, open: false }));
    if (onNavigateToPerforma) {
      onNavigateToPerforma(cust);
    } else {
      window.location.reload();
    }
  };

  // Confirm adding product from Warning Dialog (Exceeded cases only; unquoted products are strictly blocked)
  const handleConfirmWarningAdd = () => {
    if (warningDialog.type === 'NEW_PRODUCT') {
      return;
    }
    if (warningDialog.pendingRowData) {
      const { particular, quantity, rate, pktUnit, isEdit, editId } = warningDialog.pendingRowData;
      if (isEdit && editId) {
        executeSaveEditRow(editId, particular, quantity, rate, pktUnit, true);
      } else {
        executeAddProductRow(particular, quantity, rate, pktUnit, true);
      }
    }
    setWarningDialog((prev) => ({ ...prev, open: false }));
  };

  // Quick-import all remaining performa items
  const handleImportAllPerformaProducts = () => {
    if (!performaSummary?.masterPerforma?.products) return;
    const activeProducts = performaSummary.masterPerforma.products.filter(
      (p: any) => (p.remainingCases || 0) > 0
    );
    if (activeProducts.length === 0) {
      alert('All products in this performa quotation have already been fulfilled/consumed!');
      return;
    }

    const importedRows: ProductRowItem[] = activeProducts.map((p: any, idx: number) => {
      const caseVal = p.remainingCases || 1;
      const piecesPerCase = parseFloat(p.pktPerUnit) || 1;
      const totalPieces = caseVal * piecesPerCase;
      const lineAmt = (totalPieces * (parseFloat(p.rate) || 0)).toFixed(2);
      return {
        id: (Date.now() + idx).toString(),
        particular: p.productName,
        quantity: String(p.remainingCases),
        rate: String(p.rate),
        pktUnit: String(p.pktPerUnit || '-'),
        amount: lineAmt,
        isAdditional: false,
      };
    });

    setProductRows((prev) => [...prev, ...importedRows]);
    if (performaSummary.masterPerforma.companyName && !company) {
      setCompany(performaSummary.masterPerforma.companyName);
    }
  };

  // Quick-select a performa product to fill the form inputs
  const handleQuickSelectPerformaProduct = (p: any) => {
    setSelectedProduct(p.productName);
    setQuantity(String(p.remainingCases > 0 ? p.remainingCases : p.requiredCases || 1));
    setRate(String(p.rate || ''));
    setPkt(String(p.pktPerUnit || ''));
  };

  // Subtab 2: Product Line Addition with Performa Validation
  const handleAddProductRow = () => {
    if (!selectedProduct || !quantity || !rate) {
      alert('Please select Product, enter Case and Rate');
      return;
    }
    const caseVal = parseFloat(quantity) || 0;
    if (caseVal <= 0) {
      alert('Please enter a valid Case quantity greater than 0');
      return;
    }

    const activeMasterPerforma = performaSummary?.hasMasterPerforma ? performaSummary.masterPerforma : null;
    const isPerformaActive =
      activeMasterPerforma &&
      (activeMasterPerforma.status === 'ACTIVE' || activeMasterPerforma.status === 'PARTIALLY_USED') &&
      activeMasterPerforma.products &&
      activeMasterPerforma.products.length > 0;

    if (isPerformaActive) {
      const normInput = selectedProduct.trim().toLowerCase();
      const matchedP = activeMasterPerforma.products.find((p: any) => {
        const pName = (p.productName || '').trim().toLowerCase();
        const pCode = (p.productCode || '').trim().toLowerCase();
        return pName === normInput || (pCode && pCode === normInput);
      });

      if (!matchedP) {
        // Warning: Product not in performa quotation
        setWarningDialog({
          open: true,
          type: 'NEW_PRODUCT',
          productName: selectedProduct.trim(),
          quantity: quantity.trim(),
          rate: rate.trim(),
          pkt: pkt ? pkt.trim() : '-',
          performaNumber: activeMasterPerforma.performaNumber,
          remainingCases: 0,
          extraCases: caseVal,
          pendingRowData: {
            particular: selectedProduct.trim(),
            quantity: quantity.trim(),
            rate: rate.trim(),
            pktUnit: pkt ? pkt.trim() : '-',
            isEdit: false,
          },
        });
        return;
      }

      // Check cases against performa remaining quota
      const existingCasesInTable = productRows
        .filter((r) => {
          const rName = r.particular.trim().toLowerCase();
          return rName === normInput || (matchedP.productCode && rName === matchedP.productCode.trim().toLowerCase());
        })
        .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);

      const totalWillBe = existingCasesInTable + caseVal;
      const remCases = matchedP.remainingCases || 0;

      if (totalWillBe > remCases) {
        const extra = Number((totalWillBe - remCases).toFixed(2));
        setWarningDialog({
          open: true,
          type: 'EXCEEDED_CASES',
          productName: selectedProduct.trim(),
          quantity: quantity.trim(),
          rate: rate.trim(),
          pkt: pkt ? pkt.trim() : '-',
          performaNumber: activeMasterPerforma.performaNumber,
          remainingCases: remCases,
          extraCases: extra,
          pendingRowData: {
            particular: selectedProduct.trim(),
            quantity: quantity.trim(),
            rate: rate.trim(),
            pktUnit: pkt ? pkt.trim() : '-',
            isEdit: false,
          },
        });
        return;
      }
    }

    // Direct add (within quota or no active performa)
    executeAddProductRow(selectedProduct.trim(), quantity.trim(), rate.trim(), pkt ? pkt.trim() : '-', false);
  };

  // Start editing a product row
  const handleStartEditRow = (row: ProductRowItem) => {
    setEditingRowId(row.id);
    setEditRowData({
      particular: row.particular,
      quantity: row.quantity,
      rate: row.rate,
      pktUnit: row.pktUnit === '-' ? '' : row.pktUnit,
    });
  };

  // Save edited product row with Performa Validation
  const handleSaveEditRow = (id: string) => {
    if (!editRowData.particular || !editRowData.quantity || !editRowData.rate) {
      alert('Please enter Product, Cases, and Rate');
      return;
    }
    const caseVal = parseFloat(editRowData.quantity) || 0;
    if (caseVal <= 0) {
      alert('Please enter a valid Case quantity greater than 0');
      return;
    }

    const activeMasterPerforma = performaSummary?.hasMasterPerforma ? performaSummary.masterPerforma : null;
    const isPerformaActive =
      activeMasterPerforma &&
      (activeMasterPerforma.status === 'ACTIVE' || activeMasterPerforma.status === 'PARTIALLY_USED') &&
      activeMasterPerforma.products &&
      activeMasterPerforma.products.length > 0;

    if (isPerformaActive) {
      const normInput = editRowData.particular.trim().toLowerCase();
      const matchedP = activeMasterPerforma.products.find((p: any) => {
        const pName = (p.productName || '').trim().toLowerCase();
        const pCode = (p.productCode || '').trim().toLowerCase();
        return pName === normInput || (pCode && pCode === normInput);
      });

      if (!matchedP) {
        setWarningDialog({
          open: true,
          type: 'NEW_PRODUCT',
          productName: editRowData.particular.trim(),
          quantity: editRowData.quantity.trim(),
          rate: editRowData.rate.trim(),
          pkt: editRowData.pktUnit ? editRowData.pktUnit.trim() : '-',
          performaNumber: activeMasterPerforma.performaNumber,
          remainingCases: 0,
          extraCases: caseVal,
          pendingRowData: {
            particular: editRowData.particular.trim(),
            quantity: editRowData.quantity.trim(),
            rate: editRowData.rate.trim(),
            pktUnit: editRowData.pktUnit ? editRowData.pktUnit.trim() : '-',
            isEdit: true,
            editId: id,
          },
        });
        return;
      }

      // Check cases excluding current row being edited
      const otherCasesInTable = productRows
        .filter(
          (r) =>
            r.id !== id &&
            (r.particular.trim().toLowerCase() === normInput ||
              (matchedP.productCode && r.particular.trim().toLowerCase() === matchedP.productCode.trim().toLowerCase()))
        )
        .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);

      const totalWillBe = otherCasesInTable + caseVal;
      const remCases = matchedP.remainingCases || 0;

      if (totalWillBe > remCases) {
        const extra = Number((totalWillBe - remCases).toFixed(2));
        setWarningDialog({
          open: true,
          type: 'EXCEEDED_CASES',
          productName: editRowData.particular.trim(),
          quantity: editRowData.quantity.trim(),
          rate: editRowData.rate.trim(),
          pkt: editRowData.pktUnit ? editRowData.pktUnit.trim() : '-',
          performaNumber: activeMasterPerforma.performaNumber,
          remainingCases: remCases,
          extraCases: extra,
          pendingRowData: {
            particular: editRowData.particular.trim(),
            quantity: editRowData.quantity.trim(),
            rate: editRowData.rate.trim(),
            pktUnit: editRowData.pktUnit ? editRowData.pktUnit.trim() : '-',
            isEdit: true,
            editId: id,
          },
        });
        return;
      }
    }

    executeSaveEditRow(
      id,
      editRowData.particular.trim(),
      editRowData.quantity.trim(),
      editRowData.rate.trim(),
      editRowData.pktUnit ? editRowData.pktUnit.trim() : '-',
      false
    );
  };

  // Cancel editing product row
  const handleCancelEditRow = () => {
    setEditingRowId(null);
  };

  // Subtotal (Sum of all products)
  const subtotalAmount = useMemo(() => {
    return productRows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  }, [productRows]);

  // Discount Calculation (Supports % like 5% or flat rupees like 500)
  const discountVal = useMemo(() => {
    if (!discount) return 0;
    const cleanDisc = String(discount).trim();
    const num = parseFloat(cleanDisc) || 0;
    if (num <= 0) return 0;
    if (cleanDisc.endsWith('%') || num <= 100) {
      return (subtotalAmount * num) / 100;
    }
    return num;
  }, [discount, subtotalAmount]);

  // Packing Calculation (Calculated from reduced amount after discount)
  const packingVal = useMemo(() => {
    if (!packing) return 0;
    const cleanPack = String(packing).trim();
    const num = parseFloat(cleanPack) || 0;
    if (num <= 0) return 0;
    const baseAfterDiscount = Math.max(0, subtotalAmount - discountVal);
    if (cleanPack.endsWith('%') || num <= 100) {
      return (baseAfterDiscount * num) / 100;
    }
    return num;
  }, [packing, subtotalAmount, discountVal]);

  // Tax Calculation (Manual fixed amount directly added)
  const taxVal = useMemo(() => {
    if (!tax) return 0;
    const cleanTax = String(tax).trim().replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanTax) || 0;
    if (num <= 0) return 0;
    return num;
  }, [tax]);

  // Final Net Total Amount
  const finalTotalAmount = useMemo(() => {
    const net = Math.max(0, subtotalAmount - discountVal + packingVal + taxVal);
    return net.toFixed(2);
  }, [subtotalAmount, discountVal, packingVal, taxVal]);

  // Subtab 2: Submit Particular Bill
  const handleCreateParticular = async () => {
    if (createLoading) return;
    if (!billNo || !billNo.trim()) {
      alert('Please enter a Bill Number');
      return;
    }
    if (!currentCustomerName) {
      alert('Please select a Customer');
      return;
    }
    if (productRows.length === 0) {
      alert('Please add at least one Product Item');
      return;
    }

    try {
      setCreateLoading(true);
      const created = await ParticularsApi.create({
        customerName: currentCustomerName || 'General',
        caseCount: caseCount || '0',
        companyName: company ? company.trim() : '',
        discount: discount || '0',
        transport: transport || '-',
        packing: packing || '0',
        billNo: billNo.trim(),
        tax: tax || '0',
        amount: subtotalAmount.toFixed(2),
        total: finalTotalAmount,
        date: date,
        products: productRows,
        performaId: performaSummary?.masterPerforma?._id,
        performaNumber: performaSummary?.masterPerforma?.performaNumber,
      });

      const assignedBillNo = created?.billNo || billNo.trim();
      const createdBillData: BillPrintData = {
        billNo: assignedBillNo,
        customerName: currentCustomerName || 'General',
        companyName: company ? company.trim() : '',
        preparedBy: 'Admin',
        phone: '+91 98765 43210',
        email: 'info@gpkcrackers.com',
        website: 'www.gpkcrackers.com',
        transport: transport && transport.trim() !== '' && transport !== '-' ? transport.trim() : '-',
        caseCount: caseCount || '0',
        date: date,
        products: productRows.map((p) => ({
          particular: p.particular,
          quantity: p.quantity,
          rate: p.rate,
          pktUnit: p.pktUnit,
          amount: p.amount,
          isAdditional: p.isAdditional,
        })),
        amount: subtotalAmount.toFixed(2),
        discount: discount || '0',
        packing: packing || '0',
        tax: tax || '0',
        total: finalTotalAmount,
        performaNumber: performaSummary?.masterPerforma?.performaNumber || created?.performaNumber,
      };

      const successMsg = `Particular bill #${assignedBillNo}${company && company.trim() ? ` for ${company.trim()}` : ''} created successfully!`;
      alert(successMsg);

      setBillNo('');
      setCompany('');
      setSelectedProduct('');
      setProductRows([]);
      setCaseCount('0');
      setDiscount('');
      setTransport('');
      setPacking('');
      setTax('');

      const createdCustomer = currentCustomerName || 'General';
      setFilterCustomer(createdCustomer);
      setParticularCustomerInput(createdCustomer);
      setAccountCustomerInput(createdCustomer);
      setFilterParticularCompany('ALL');
      fetchAccounts(createdCustomer);
      fetchParticulars(createdCustomer);
      if (currentCustomerName) {
        PerformasApi.getCustomerSummary(currentCustomerName)
          .then((res) => setPerformaSummary(res))
          .catch(() => {});
      }

      setActiveSubTab('Particular Details');

      // Open the print invoice modal automatically
      setSelectedBillForPrint(createdBillData);
      setPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to create particular:', err);
      alert('Error creating particular bill');
    } finally {
      setCreateLoading(false);
    }
  };

  // Subtab 5: Submit Credit
  const handleAddCreditSubmit = async () => {
    const targetCust = addCreditCustomerName || currentCustomerName || (customerOptions[0]?.name ?? 'General');
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      alert('Please enter a valid credit amount');
      return;
    }

    try {
      setCreditLoading(true);
      const res = await AccountsApi.addCredit({
        customerName: targetCust,
        companyName: addCreditCompanyName ? addCreditCompanyName.trim() : '',
        creditAmount: creditAmount.trim(),
        date: creditDate,
        paymentMode: 'Bank',
        reference: '',
        notes: creditNotes.trim(),
      });

      alert(res?.message || 'Credit added successfully!');
      setCreditAmount('');
      setCreditNotes('Additional customer payment');
      
      // Refresh all financial states
      fetchAccounts(filterCustomer);
      fetchParticulars();
      setActiveSubTab('Account Details');
    } catch (err: any) {
      console.error('Failed to add credit:', err);
      alert(err?.message || 'Error adding credit');
    } finally {
      setCreditLoading(false);
    }
  };

  // Delete handlers
  const handleDeleteAccountEntry = async (id: string) => {
    if (isCustomer) return;
    if (!window.confirm('Delete this account ledger transaction?')) return;
    try {
      const entryToDelete = accountDetails.find((a) => (a._id || a.id) === id);
      await AccountsApi.delete(id);
      setAccountDetails((prev) => prev.filter((a) => (a._id || a.id) !== id));
      if (entryToDelete) {
        setParticularDetails((prev) =>
          prev.filter((p) => {
            const pId = p._id || p.id;
            if (entryToDelete.particularId && (pId === entryToDelete.particularId || p._id === entryToDelete.particularId)) return false;
            if (entryToDelete.billNo && p.billNo === entryToDelete.billNo) return false;
            return true;
          })
        );
      }
      fetchAccounts(filterCustomer);
      fetchParticulars();
    } catch (err) {
      console.error('Failed to delete account entry:', err);
    }
  };

  const handleDeleteParticular = async (id: string) => {
    if (isCustomer) return;
    if (!window.confirm('Delete this particular bill?')) return;
    try {
      const billToDelete = particularDetails.find((p) => (p._id || p.id) === id);
      await ParticularsApi.delete(id);
      setParticularDetails((prev) => prev.filter((p) => (p._id || p.id) !== id));
      setAccountDetails((prev) =>
        prev.filter((a) => {
          if (a.particularId && (a.particularId === id || (billToDelete && a.particularId === (billToDelete._id || billToDelete.id)))) {
            return false;
          }
          if (billToDelete?.billNo && a.billNo && a.billNo === billToDelete.billNo) {
            return false;
          }
          return true;
        })
      );
      fetchAccounts(filterCustomer);
      fetchParticulars();
    } catch (err) {
      console.error('Failed to delete particular bill:', err);
    }
  };

  const handleOpenBillPrint = (billData: any, autoTrigger = false) => {
    const formattedBill: BillPrintData = {
      billNo: billData.billNo || '',
      date: billData.date || '',
      customerName: billData.customerName || currentCustomerName || '',
      companyName: billData.companyName || company || '',
      preparedBy: billData.preparedBy || 'S.Nagaraj',
      phone: '+91 98765 43210',
      email: 'info@gpkcrackers.com',
      website: 'www.gpkcrackers.com',
      transport: billData.transport && billData.transport.trim() !== '' && billData.transport !== '-' ? billData.transport.trim() : '-',
      caseCount: billData.caseCount || billData.cases || (billData.products ? billData.products.reduce((acc: number, p: any) => acc + (parseFloat(p.quantity) || 0), 0) : 0),
      products: (billData.products || []).map((p: any) => ({
        particular: p.particular || p.particularName || p.name || '',
        quantity: p.quantity || '',
        rate: p.rate || '',
        pktUnit: p.pktUnit || p.pkt || '',
        amount: p.amount || '',
      })),
      amount: billData.amount || billData.total || '0.00',
      discount: billData.discount !== undefined && billData.discount !== null ? String(billData.discount) : '0',
      packing: billData.packing !== undefined && billData.packing !== null ? String(billData.packing) : '0',
      tax: billData.tax !== undefined && billData.tax !== null ? String(billData.tax) : '0',
      total: billData.total || billData.amount || '0.00',
      pdfData: billData.pdfData || '',
      pdfUrl: billData.pdfUrl || '',
      pdfName: billData.pdfName || '',
    };

    setSelectedBillForPrint(formattedBill);

    if (autoTrigger) {
      printBillDirectly(formattedBill);
    } else {
      setPrintModalOpen(true);
    }
  };

  // WhatsApp Share Handlers
  const handleShareBillWhatsApp = async (billData: any) => {
    try {
      const formattedBill: BillPrintData = {
        billNo: billData.billNo || '',
        customerName: billData.customerName || 'General',
        companyName: billData.companyName || '',
        preparedBy: 'S.Nagaraj',
        phone: billData.phone || '+91 98765 43210',
        email: 'info@gpkcrackers.com',
        website: 'www.gpkcrackers.com',
        transport: billData.transport && billData.transport !== '-' ? billData.transport : '-',
        caseCount: billData.caseCount || '0',
        date: billData.date || new Date().toISOString().split('T')[0],
        products: (billData.products || []).map((p: any) => ({
          particular: p.particular || p.particularName || p.name || 'Product',
          quantity: String(p.quantity || '0'),
          rate: String(p.rate || '0'),
          pktUnit: p.pktUnit || p.pkt || '-',
          amount: String(p.amount || '0'),
        })),
        amount: billData.amount || '0.00',
        discount: billData.discount !== undefined && billData.discount !== null ? String(billData.discount) : '0',
        packing: billData.packing !== undefined && billData.packing !== null ? String(billData.packing) : '0',
        tax: billData.tax !== undefined && billData.tax !== null ? String(billData.tax) : '0',
        total: billData.total || billData.amount || '0.00',
      };
      await shareBillOnWhatsApp(formattedBill);
    } catch (err) {
      console.error('Failed to share bill on WhatsApp:', err);
    }
  };

  const handleShareParticularsListWhatsApp = async () => {
    try {
      const cust = filterCustomer || currentCustomerName || 'All Customers';
      await shareParticularsListOnWhatsApp(cust, particularDetails);
    } catch (err) {
      console.error('Failed to share particulars on WhatsApp:', err);
    }
  };

  const handleShareLedgerWhatsApp = async () => {
    try {
      const cust = filterCustomer || currentCustomerName || 'All Customers';
      await shareLedgerOnWhatsApp(cust, accountDetails);
    } catch (err) {
      console.error('Failed to share ledger on WhatsApp:', err);
    }
  };

  // Edit Particular Handlers
  const handleOpenEditParticular = (row: any) => {
    if (isCustomer) return;
    const rowId = row._id || row.id || '';
    setEditingParticularId(rowId);
    setEditBillForm({
      billNo: row.billNo || '',
      date: row.date || '',
      customerName: row.customerName || '',
      companyName: row.companyName || '',
      transport: row.transport && row.transport !== '-' ? row.transport : '',
      caseCount: String(row.caseCount || '0'),
      discount: String(row.discount || '0'),
      packing: String(row.packing || '0'),
      tax: String(row.tax || '0'),
      products: (row.products || []).map((p: any, idx: number) => ({
        id: p._id || p.id || `edit-prod-${idx}`,
        particular: p.particular || p.particularName || p.name || '',
        quantity: String(p.quantity || '0'),
        rate: String(p.rate || '0'),
        pktUnit: p.pktUnit || p.pkt || '-',
        amount: String(p.amount || '0'),
      })),
    });
    setOpenEditParticularModal(true);
  };

  const handleAddEditProductRow = () => {
    setEditBillForm((prev) => {
      const updated = [
        ...prev.products,
        {
          id: `edit-prod-${Date.now()}`,
          particular: productOptions[0]?.name || '',
          quantity: '1',
          rate: '0',
          pktUnit: '-',
          amount: '0.00',
        },
      ];
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  const handleUpdateEditProductRow = (index: number, field: string, val: string) => {
    setEditBillForm((prev) => {
      const updated = [...prev.products];
      const row = { ...updated[index], [field]: val };
      if (field === 'quantity' || field === 'rate' || field === 'pktUnit') {
        const q = parseFloat(field === 'quantity' ? val : row.quantity) || 0;
        const r = parseFloat(field === 'rate' ? val : row.rate) || 0;
        const pktStr = (field === 'pktUnit' ? val : row.pktUnit) || '';
        const pNum = parseFloat(pktStr);
        const pieces = !isNaN(pNum) && pNum > 0 ? pNum : 1;
        row.amount = (q * pieces * r).toFixed(2);
      }
      updated[index] = row;
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  const handleDeleteEditProductRow = (index: number) => {
    setEditBillForm((prev) => {
      const updated = prev.products.filter((_, i) => i !== index);
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  // Edit Calculation Hooks
  const editSubtotal = useMemo(() => {
    return editBillForm.products.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  }, [editBillForm.products]);

  const editDiscountVal = useMemo(() => {
    const dStr = String(editBillForm.discount || '').trim();
    if (!dStr) return 0;
    const cleanDisc = dStr.replace(/[^0-9.]/g, '');
    const dNum = parseFloat(cleanDisc) || 0;
    if (dNum <= 0) return 0;
    return dStr.includes('%') || dNum <= 100 ? (editSubtotal * dNum) / 100 : dNum;
  }, [editSubtotal, editBillForm.discount]);

  const editPackingVal = useMemo(() => {
    const pStr = String(editBillForm.packing || '').trim();
    if (!pStr) return 0;
    const cleanPack = pStr.replace(/[^0-9.]/g, '');
    const pNum = parseFloat(cleanPack) || 0;
    if (pNum <= 0) return 0;
    const baseAfterDiscount = Math.max(0, editSubtotal - editDiscountVal);
    return pStr.includes('%') || pNum <= 100 ? (baseAfterDiscount * pNum) / 100 : pNum;
  }, [editSubtotal, editDiscountVal, editBillForm.packing]);

  const editTaxVal = useMemo(() => {
    const tStr = String(editBillForm.tax || '').trim();
    if (!tStr) return 0;
    const cleanTax = tStr.replace(/[^0-9.]/g, '');
    const tNum = parseFloat(cleanTax) || 0;
    if (tNum <= 0) return 0;
    return tNum;
  }, [editBillForm.tax]);

  const editFinalTotal = useMemo(() => {
    const net = Math.max(0, editSubtotal - editDiscountVal + editPackingVal + editTaxVal);
    return net.toFixed(2);
  }, [editSubtotal, editDiscountVal, editPackingVal, editTaxVal]);

  const handleSaveEditParticular = async () => {
    if (isCustomer || !editingParticularId) return;
    try {
      setEditBillLoading(true);
      await ParticularsApi.update(editingParticularId, {
        customerName: editBillForm.customerName,
        companyName: editBillForm.companyName,
        date: editBillForm.date,
        transport: editBillForm.transport || '-',
        caseCount: editBillForm.caseCount || '0',
        discount: editBillForm.discount || '0',
        packing: editBillForm.packing || '0',
        tax: editBillForm.tax || '0',
        billNo: editBillForm.billNo,
        amount: editSubtotal.toFixed(2),
        total: editFinalTotal,
        products: editBillForm.products,
      });

      await fetchParticulars();
      await fetchAccounts(filterCustomer);
      setOpenEditParticularModal(false);
      setToast({
        open: true,
        message: `Bill #${editBillForm.billNo} updated successfully!`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to update particular bill:', err);
      alert('Error updating bill details');
    } finally {
      setEditBillLoading(false);
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
      {/* Subtabs Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, sm: 3, md: 4 },
          mb: 2.5,
          flexWrap: 'wrap',
          borderBottom: '1px solid #EEF2F6',
          pb: 0.5,
        }}
      >
        {(isCustomer
          ? (['Account Details', 'Particular Details'] as ParticularSubTab[])
          : SUB_TABS
        ).map((tab) => {
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
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? '#0B4DB7' : '#475569',
                  backgroundColor: isActive && tab === 'Add Credit' ? '#EFF6FF' : 'transparent',
                  px: isActive && tab === 'Add Credit' ? 1.5 : 0.5,
                  py: isActive && tab === 'Add Credit' ? 0.6 : 0,
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: '#0B4DB7',
                  },
                }}
              >
                {tab}
              </Typography>

              {/* Active Tab Underline Bar */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    backgroundColor: '#0B4DB7',
                    borderTopLeftRadius: '2px',
                    borderTopRightRadius: '2px',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* View 1: Select Customer View */}
      {activeSubTab === 'Select Customer' && (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#0B4DB7',
              px: { xs: 2, sm: 3 },
              py: 1.6,
              minHeight: '52px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Select Customer
            </Typography>
          </Box>

          <Box
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              pt: { xs: 4, md: 5 },
              pb: { xs: 5, md: 6 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: { xs: 1.5, sm: 4 },
                maxWidth: '800px',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0F172A',
                  minWidth: '140px',
                }}
              >
                Select Customer
              </Typography>

              <Box sx={{ width: { xs: '100%', sm: '380px', md: '420px' } }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.id === selectedCustomerId) || null}
                  onChange={(_, val) => {
                    if (val) {
                      setSelectedCustomerId(val.id);
                      setCurrentCustomerName(val.name);
                      setFilterCustomer(val.name);
                      setAddCreditCustomerName(val.name);
                      localStorage.setItem('gpk_active_customer', val.name);
                    } else {
                      setSelectedCustomerId('');
                      setCurrentCustomerName('');
                      setFilterCustomer('');
                      setAddCreditCustomerName('');
                      localStorage.removeItem('gpk_active_customer');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Type or select customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '40px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleSelectCustomerClick}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      textTransform: 'none',
                      px: 2.6,
                      py: 0.9,
                      borderRadius: '6px',
                      lineHeight: 1.3,
                      '&:hover': {
                        backgroundColor: '#083B8D',
                      },
                    }}
                  >
                    Click to Select
                  </Button>
                </Box>
              </Box>


            </Box>
          </Box>
        </Paper>
      )}

      {/* View 2: Create Particular View */}
      {activeSubTab === 'Create Particular' && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 2.5,
            width: '100%',
            alignItems: 'flex-start',
          }}
        >
          {/* Left Card: Create Particular Form */}
          <Paper
            elevation={0}
            sx={{
              width: { xs: '100%', lg: '360px', xl: '380px' },
              flexShrink: 0,
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: 2.2,
                py: 1.4,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Create Particular - {currentCustomerName || 'Customer'}
              </Typography>
            </Box>

            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.6 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Customer
                  </Typography>
                  <Autocomplete
                    fullWidth
                    size="small"
                    autoHighlight
                    options={customerOptions}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                    isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                    value={customerOptions.find((c) => c.name === currentCustomerName) || null}
                    onChange={(_, val) => {
                      const name = val ? val.name : '';
                      setCurrentCustomerName(name);
                      localStorage.setItem('gpk_active_customer', name);
                      if (val) {
                        setSelectedCustomerId(val.id);
                        setFilterCustomer(val.name);
                        setAddCreditCustomerName(val.name);
                      } else {
                        setSelectedCustomerId('');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search Customer..."
                        sx={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-root': {
                            height: '36px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#0F172A',
                            '& fieldset': {
                              borderColor: '#CBD5E1',
                            },
                            '&:hover fieldset': {
                              borderColor: '#94A3B8',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#0B4DB7',
                              borderWidth: '1.5px',
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Case Count
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={caseCount}
                    onChange={(e) => setCaseCount(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 600,
                          height: '36px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '6px',
                          color: '#0F172A',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#CBD5E1',
                          },
                        },
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Linked Active Performa Card */}
              {performaSummary?.masterPerforma && (
                <Box
                  sx={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    p: 1.4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Chip
                        size="small"
                        label={performaSummary.masterPerforma.performaNumber}
                        sx={{
                          fontWeight: 800,
                          backgroundColor: '#DCFCE7',
                          color: '#166534',
                          fontSize: '11.5px',
                        }}
                      />
                      <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                        Linked Performa Active
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={performaSummary.masterPerforma.status}
                      sx={{
                        fontWeight: 700,
                        fontSize: '10.5px',
                        backgroundColor:
                          performaSummary.masterPerforma.status === 'ACTIVE' ? '#DBEAFE' : '#FEF3C7',
                        color:
                          performaSummary.masterPerforma.status === 'ACTIVE' ? '#1E40AF' : '#92400E',
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1,
                      backgroundColor: '#FFFFFF',
                      p: 1,
                      borderRadius: '6px',
                      border: '1px solid #DCFCE7',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>
                        Available Advance
                      </Typography>
                      <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#16A34A' }}>
                        ₹{(performaSummary.availableAmount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>
                        Remaining Cases
                      </Typography>
                      <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                        {performaSummary.masterPerforma.totalRemainingCases || 0} Cases
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Company
                  </Typography>
                  <Autocomplete
                    fullWidth
                    size="small"
                    autoHighlight
                    options={companyOptions}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                    isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                    value={companyOptions.find((c) => c.name === company) || null}
                    onChange={(_, val) => setCompany(val ? val.name : '')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search Company..."
                        sx={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-root': {
                            height: '36px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#0F172A',
                            '& fieldset': {
                              borderColor: '#CBD5E1',
                            },
                            '&:hover fieldset': {
                              borderColor: '#94A3B8',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#0B4DB7',
                              borderWidth: '1.5px',
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Discount (%)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#CBD5E1',
                          },
                        },
                      },
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Transport
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#CBD5E1',
                          },
                        },
                      },
                    }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Packing (%)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#CBD5E1',
                          },
                        },
                      },
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Bill No *
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter Bill No (e.g. 101)"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 600,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#CBD5E1',
                          },
                        },
                      },
                    }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Tax (₹)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter Tax Amount"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: '13px',
                          fontWeight: 500,
                          height: '36px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#CBD5E1',
                          },
                        },
                      },
                    }}
                  />
                </Box>
              </Box>



              <Box
                sx={{
                  backgroundColor: '#F8FAFC',
                  p: 1.4,
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', mb: 0.5 }}>
                    Amount
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: '#E2E8F0',
                      borderRadius: '4px',
                      px: 1.5,
                      py: 0.7,
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0F172A',
                      textAlign: 'right',
                    }}
                  >
                    {subtotalAmount.toFixed(2)}
                  </Box>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', mb: 0.5 }}>
                    Total
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: '#E2E8F0',
                      borderRadius: '4px',
                      px: 1.5,
                      py: 0.7,
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0B4DB7',
                      textAlign: 'right',
                    }}
                  >
                    {finalTotalAmount}
                  </Box>
                </Box>
              </Box>



              <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 1.5, mt: 0.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                    Date
                  </Typography>
                  <DatePickerField
                    value={date}
                    onChange={setDate}
                    placeholder="dd-mm-yyyy"
                    iconSize={16}
                    inputSx={{ height: '36px' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    variant="contained"
                    disableElevation
                    fullWidth
                    onClick={handleCreateParticular}
                    disabled={createLoading}
                    sx={{
                      backgroundColor: '#0284C7',
                      color: '#FFFFFF',
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: '6px',
                      '&:hover': {
                        backgroundColor: '#0369A1',
                      },
                    }}
                  >
                    {createLoading ? 'Creating...' : 'Click to Create'}
                  </Button>
                </Box>
              </Box>


            </Box>
          </Paper>

          {/* Right Card: Product Grid & Entry */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: 2.2,
                py: 1.4,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Product Entry
              </Typography>
            </Box>

            {/* Quick Pick Performa Products Bar */}
            {performaSummary?.masterPerforma && performaSummary.masterPerforma.products && (
              <Box
                sx={{
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  px: 2,
                  py: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1 }}>
                  <Typography
                    sx={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Inventory2RoundedIcon sx={{ fontSize: 16, color: '#0B4DB7' }} />
                    Quotation Items:
                  </Typography>
                  {performaSummary.masterPerforma.products.map((p: any, idx: number) => {
                    const isFulfilled = (p.remainingCases || 0) <= 0;
                    return (
                      <Chip
                        key={idx}
                        size="small"
                        clickable={!isFulfilled}
                        onClick={() => !isFulfilled && handleQuickSelectPerformaProduct(p)}
                        label={`${p.productName} (${p.remainingCases || 0} rem @ ₹${p.rate})`}
                        sx={{
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isFulfilled ? '#F1F5F9' : '#EFF6FF',
                          color: isFulfilled ? '#94A3B8' : '#1D4ED8',
                          border: isFulfilled ? '1px dashed #CBD5E1' : '1px solid #BFDBFE',
                          cursor: isFulfilled ? 'default' : 'pointer',
                          '&:hover': isFulfilled ? {} : { backgroundColor: '#DBEAFE' },
                        }}
                      />
                    );
                  })}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleImportAllPerformaProducts}
                  startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderColor: '#0B4DB7',
                    color: '#0B4DB7',
                    borderRadius: '6px',
                    py: 0.4,
                    px: 1.2,
                    '&:hover': {
                      backgroundColor: '#EFF6FF',
                      borderColor: '#083B8D',
                    },
                  }}
                >
                  Import All Remaining
                </Button>
              </Box>
            )}

            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <Autocomplete
                size="small"
                autoHighlight
                sx={{ flex: { xs: '1 1 100%', sm: 2.5 }, minWidth: '160px' }}
                options={productOptions}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                value={productOptions.find((p) => p.name === selectedProduct) || null}
                onChange={(_, val) => setSelectedProduct(val ? val.name : '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search Product..."
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-root': {
                        height: '36px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#0F172A',
                        '& fieldset': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover fieldset': {
                          borderColor: '#94A3B8',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0B4DB7',
                          borderWidth: '1.5px',
                        },
                      },
                    }}
                  />
                )}
              />

              <TextField
                size="small"
                placeholder="Case"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', sm: 1 },
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="Rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', sm: 1 },
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="Pkt / Units"
                type="number"
                value={pkt}
                onChange={(e) => setPkt(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', sm: 1 },
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="Amount"
                value={
                  quantity && rate
                    ? (((parseFloat(quantity) || 0) * (parseFloat(pkt) || 1)) * (parseFloat(rate) || 0)).toFixed(2)
                    : ''
                }
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: {
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                    },
                  },
                }}
                sx={{ flex: { xs: '1 1 45%', sm: 1.2 } }}
              />

              <Button
                variant="contained"
                disableElevation
                onClick={handleAddProductRow}
                sx={{
                  backgroundColor: '#0B4DB7',
                  color: '#FFFFFF',
                  minWidth: '36px',
                  width: '36px',
                  height: '36px',
                  p: 0,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: '#083B8D',
                  },
                }}
              >
                <AddRoundedIcon sx={{ fontSize: 20 }} />
              </Button>
            </Box>

            <TableContainer>
              <Table sx={{ width: '100%', borderCollapse: 'collapse' }} aria-label="particular product table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 2,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '30%',
                      }}
                    >
                      PARTICULAR
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '14%',
                      }}
                    >
                      CASE
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '14%',
                      }}
                    >
                      RATE
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '14%',
                      }}
                    >
                      PKT / UNITS
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        width: '14%',
                      }}
                    >
                      AMOUNT
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        width: '14%',
                      }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productRows.length > 0 ? (
                    productRows.map((row) => {
                      const isEditing = editingRowId === row.id;
                      const liveAmount = isEditing
                        ? (
                            (parseFloat(editRowData.quantity) || 0) *
                            (parseFloat(editRowData.pktUnit) || 1) *
                            (parseFloat(editRowData.rate) || 0)
                          ).toFixed(2)
                        : row.amount;

                      return (
                        <TableRow
                          key={row.id}
                          sx={{
                            backgroundColor: isEditing ? '#F8FAFC' : 'inherit',
                            '&:hover': {
                              backgroundColor: isEditing ? '#F1F5F9' : '#FAFAFA',
                            },
                          }}
                        >
                          <TableCell
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              color: '#0F172A',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <Autocomplete
                                freeSolo
                                size="small"
                                options={productOptions.map((p) => p.name)}
                                value={editRowData.particular}
                                onInputChange={(_e, val) =>
                                  setEditRowData((prev) => ({ ...prev, particular: val || '' }))
                                }
                                onChange={(_e, val) =>
                                  setEditRowData((prev) => ({ ...prev, particular: val || '' }))
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    size="small"
                                    placeholder="Product Name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEditRow(row.id);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEditRow();
                                      }
                                    }}
                                    sx={{
                                      backgroundColor: '#FFFFFF',
                                      '& .MuiInputBase-input': {
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        py: 0.5,
                                      },
                                    }}
                                  />
                                )}
                                sx={{ minWidth: '140px' }}
                              />
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                                  {row.particular}
                                </Typography>
                                {row.isAdditional ? (
                                  <Chip
                                    label="Additional"
                                    size="small"
                                    sx={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      backgroundColor: '#FEF3C7',
                                      color: '#92400E',
                                      border: '1px solid #FDE68A',
                                      height: '20px',
                                    }}
                                  />
                                ) : performaSummary?.masterPerforma ? (
                                  <Chip
                                    label="Performa"
                                    size="small"
                                    sx={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE',
                                      height: '20px',
                                    }}
                                  />
                                ) : null}
                              </Box>
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={editRowData.quantity}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, quantity: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '80px' }}
                              />
                            ) : (
                              row.quantity
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={editRowData.rate}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, rate: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '85px' }}
                              />
                            ) : (
                              row.rate
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                placeholder="1"
                                value={editRowData.pktUnit}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, pktUnit: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '70px' }}
                              />
                            ) : (
                              row.pktUnit
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: isEditing ? '#0B4DB7' : '#0F172A',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            ₹{parseFloat(liveAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell align="center" sx={{ borderBottom: '1px solid #E2E8F0', py: isEditing ? 0.8 : 1.2 }}>
                            {isEditing ? (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                                <Tooltip title="Save (Enter)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveEditRow(row.id)}
                                    sx={{
                                      backgroundColor: '#16A34A',
                                      color: '#FFFFFF',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#15803D' },
                                    }}
                                  >
                                    <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel (Esc)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={handleCancelEditRow}
                                    sx={{
                                      backgroundColor: '#F1F5F9',
                                      color: '#64748B',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#E2E8F0', color: '#0F172A' },
                                    }}
                                  >
                                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                                <Tooltip title="Edit Product Item (Cases, Rate, Pkt/Unit)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleStartEditRow(row)}
                                    sx={{
                                      backgroundColor: '#EFF6FF',
                                      color: '#0B4DB7',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#DBEAFE' },
                                    }}
                                  >
                                    <ModeEditOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Item" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => setProductRows((prev) => prev.filter((p) => p.id !== row.id))}
                                    sx={{
                                      backgroundColor: '#FEF2F2',
                                      color: '#DC2626',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#FEE2E2' },
                                    }}
                                  >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <>
                      <TableRow sx={{ height: '65px' }}>
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0' }} />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* View 3: Account Details View */}
      {activeSubTab === 'Account Details' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Top Metric Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReceiptLongRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  Total Purchases (Debit)
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>
                  ₹{overallTotals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  Total Paid / Credits
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#16A34A' }}>
                  ₹{overallTotals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: overallTotals.netBalance < 0 ? '#FEF2F2' : '#F0FDF4',
                  color: overallTotals.netBalance < 0 ? '#DC2626' : '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  Net Outstanding Balance
                </Typography>
                <Typography
                  sx={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: overallTotals.netBalance < 0 ? '#DC2626' : '#16A34A',
                  }}
                >
                  ₹{overallTotals.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Account Details Table */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: { xs: 2, sm: 3 },
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
                minHeight: '52px',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '15.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Account Details {isCustomer ? `- ${initialCustomerName || currentCustomerName || filterCustomer || 'My Account'}` : (filterCustomer && filterCustomer !== 'ALL' ? `- ${filterCustomer}` : (currentCustomerName ? `- ${currentCustomerName}` : '(All Customers)'))}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                {!isCustomer && (
                  <Autocomplete
                    size="small"
                    openOnFocus
                    autoHighlight
                    options={[{ id: 'ALL', name: 'All Customers' }, ...customerOptions]}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                    isOptionEqualToValue={(option, val) => option.name === val.name}
                    value={
                      filterCustomer && filterCustomer !== 'ALL'
                        ? customerOptions.find((c) => c.name === filterCustomer) || { id: filterCustomer, name: filterCustomer }
                        : (currentCustomerName && currentCustomerName !== 'ALL' ? customerOptions.find((c) => c.name === currentCustomerName) || { id: 'ALL', name: 'All Customers' } : { id: 'ALL', name: 'All Customers' })
                    }
                    inputValue={accountCustomerInput}
                    onInputChange={(_, newInputValue, reason) => {
                      if (reason === 'input') {
                        setAccountCustomerInput(newInputValue);
                      } else if (reason === 'reset') {
                        const curName = filterCustomer && filterCustomer !== 'ALL'
                          ? filterCustomer
                          : (currentCustomerName && currentCustomerName !== 'ALL' ? currentCustomerName : 'All Customers');
                        setAccountCustomerInput(newInputValue || curName);
                      } else if (reason === 'clear') {
                        setAccountCustomerInput('');
                      }
                    }}
                    filterOptions={(options, state) => {
                      if (!state.inputValue || state.inputValue === 'All Customers') {
                        return options;
                      }
                      const query = state.inputValue.toLowerCase().trim();
                      return options.filter((o) => {
                        const name = typeof o === 'string' ? o : o.name;
                        return name && name.toLowerCase().includes(query);
                      });
                    }}
                    onChange={(_, val) => {
                      const selectedName = val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL';
                      setFilterCustomer(selectedName);
                      if (val && val.id !== 'ALL') {
                        setCurrentCustomerName(val.name);
                        setSelectedCustomerId(val.id);
                        localStorage.setItem('gpk_active_customer', val.name);
                      }
                      fetchAccounts(selectedName);
                    }}
                    sx={{ width: 220 }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Filter Customer..."
                        onClick={() => {
                          if (accountCustomerInput === 'All Customers') {
                            setAccountCustomerInput('');
                          }
                        }}
                        onFocus={(e) => {
                          if (accountCustomerInput === 'All Customers') {
                            setAccountCustomerInput('');
                          } else {
                            (e.target as HTMLInputElement)?.select?.();
                          }
                        }}
                        sx={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '6px',
                          '& .MuiOutlinedInput-root': {
                            height: '34px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            py: 0,
                          },
                        }}
                      />
                    )}
                  />
                )}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleShareLedgerWhatsApp}
                  startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
                  sx={{
                    backgroundColor: '#25D366',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    py: 0.7,
                    borderRadius: '6px',
                    lineHeight: 1.2,
                    '&:hover': {
                      backgroundColor: '#1EBE5D',
                    },
                  }}
                >
                  Share on WhatsApp
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => setOpenAccountDateModal(true)}
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
                  sx={{
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2.2,
                    py: 0.7,
                    borderRadius: '6px',
                    lineHeight: 1.2,
                    '&:hover': {
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  Click to Print
                </Button>
              </Box>
            </Box>

            <TableContainer>
              <Table sx={{ width: '100%' }} aria-label="account details table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell sx={{ py: 1.5, px: { xs: 2, sm: 3 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '60px' }}>
                      SL.NO
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      DATE
                    </TableCell>
                    {!isSingleCustomer && (
                      <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '140px' }}>
                        CUSTOMER
                      </TableCell>
                    )}
                    <TableCell sx={{ py: 1.5, px: { xs: 2, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B' }}>
                      COMPANY NAME
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      DEBIT
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      CREDIT
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '120px' }}>
                      BALANCE
                    </TableCell>
                    {!isCustomer && (
                      <TableCell align="center" sx={{ py: 1.5, px: { xs: 2, sm: 3 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '70px' }}>
                        DELETE
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accountLoading ? (
                    <TableRow>
                      <TableCell colSpan={8 - (isSingleCustomer ? 1 : 0) - (isCustomer ? 1 : 0)} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                      </TableCell>
                    </TableRow>
                  ) : accountDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8 - (isSingleCustomer ? 1 : 0) - (isCustomer ? 1 : 0)} align="center" sx={{ py: 6, color: '#64748B' }}>
                        No account details found {filterCustomer && filterCustomer !== 'ALL' ? `for ${filterCustomer}` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    accountDetails.map((row: any, index: number) => {
                      const isLast = index === accountDetails.length - 1;
                      const rowId = row._id || row.id || '';
                      return (
                        <TableRow
                          key={rowId || index}
                          sx={{
                            '&:hover': {
                              backgroundColor: '#F8FAFC',
                            },
                          }}
                        >
                          <TableCell sx={{ py: 1.6, px: { xs: 2, sm: 3 }, fontSize: '13.5px', fontWeight: 600, color: '#1E293B', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {index + 1}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 500, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.date}
                          </TableCell>
                          {!isSingleCustomer && (
                            <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 700, color: '#0B4DB7', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                              {row.customerName}
                            </TableCell>
                          )}
                          <TableCell sx={{ py: 1.6, px: { xs: 2, sm: 2.5 }, fontSize: '13.5px', fontWeight: 600, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.companyName && row.companyName !== 'General' ? row.companyName : '-'}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 500, color: '#DC2626', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.debit}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 600, color: '#16A34A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.credit}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              py: 1.6,
                              px: { xs: 1.5, sm: 2.5 },
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: String(row.balance).startsWith('-') ? '#DC2626' : '#16A34A',
                              borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                            }}
                          >
                            {row.balance}
                          </TableCell>
                          {!isCustomer && (
                            <TableCell align="center" sx={{ py: 1.6, px: { xs: 2, sm: 3 }, borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                              <Tooltip title="Delete Record" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteAccountEntry(rowId)}
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
                          )}
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

      {/* View 4: Particular Details View */}
      {activeSubTab === 'Particular Details' && (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#0B4DB7',
              px: { xs: 2, sm: 3 },
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              minHeight: '52px',
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Particular Details {isCustomer ? `- ${initialCustomerName || currentCustomerName || filterCustomer || 'My Bills'}` : (filterCustomer && filterCustomer !== 'ALL' ? `- ${filterCustomer}` : (currentCustomerName ? `- ${currentCustomerName}` : '(All Bills)'))}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {!isCustomer && (
                <Autocomplete
                  size="small"
                  openOnFocus
                  autoHighlight
                  options={[{ id: 'ALL', name: 'All Customers' }, ...customerOptions]}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.name === val.name}
                  value={
                    filterCustomer && filterCustomer !== 'ALL'
                      ? customerOptions.find((c) => c.name === filterCustomer) || { id: filterCustomer, name: filterCustomer }
                      : (currentCustomerName && currentCustomerName !== 'ALL' ? customerOptions.find((c) => c.name === currentCustomerName) || { id: 'ALL', name: 'All Customers' } : { id: 'ALL', name: 'All Customers' })
                  }
                  inputValue={particularCustomerInput}
                  onInputChange={(_, newInputValue, reason) => {
                    if (reason === 'input') {
                      setParticularCustomerInput(newInputValue);
                    } else if (reason === 'reset') {
                      const curName = filterCustomer && filterCustomer !== 'ALL'
                        ? filterCustomer
                        : (currentCustomerName && currentCustomerName !== 'ALL' ? currentCustomerName : 'All Customers');
                      setParticularCustomerInput(newInputValue || curName);
                    } else if (reason === 'clear') {
                      setParticularCustomerInput('');
                    }
                  }}
                  filterOptions={(options, state) => {
                    if (!state.inputValue || state.inputValue === 'All Customers') {
                      return options;
                    }
                    const query = state.inputValue.toLowerCase().trim();
                    return options.filter((o) => {
                      const name = typeof o === 'string' ? o : o.name;
                      return name && name.toLowerCase().includes(query);
                    });
                  }}
                  onChange={(_, val) => {
                    const selectedName = val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL';
                    setFilterCustomer(selectedName);
                    if (val && val.id !== 'ALL') {
                      setCurrentCustomerName(val.name);
                      setSelectedCustomerId(val.id);
                      localStorage.setItem('gpk_active_customer', val.name);
                    }
                    fetchParticulars(selectedName);
                  }}
                  sx={{ width: 220 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Filter Customer..."
                      onClick={() => {
                        if (particularCustomerInput === 'All Customers') {
                          setParticularCustomerInput('');
                        }
                      }}
                      onFocus={(e) => {
                        if (particularCustomerInput === 'All Customers') {
                          setParticularCustomerInput('');
                        } else {
                          (e.target as HTMLInputElement)?.select?.();
                        }
                      }}
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '34px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          py: 0,
                        },
                      }}
                    />
                  )}
                />
              )}

              {!isCustomer && (
                <Autocomplete
                  size="small"
                  autoHighlight
                  options={[{ id: 'ALL', name: 'All Companies' }, ...companyOptions]}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.name === val.name}
                  value={
                    filterParticularCompany && filterParticularCompany !== 'ALL'
                      ? companyOptions.find((c) => c.name === filterParticularCompany) || { id: filterParticularCompany, name: filterParticularCompany }
                      : { id: 'ALL', name: 'All Companies' }
                  }
                  onChange={(_, val) => {
                    setFilterParticularCompany(val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL');
                  }}
                  sx={{ width: 180 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Filter Company..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '34px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          py: 0,
                        },
                      }}
                    />
                  )}
                />
              )}
              <Chip
                label={`${filteredParticularRows.length} Bills`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              />
              <Button
                variant="contained"
                disableElevation
                onClick={handleShareParticularsListWhatsApp}
                startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
                sx={{
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 2,
                  py: 0.6,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: '#1EBE5D',
                  },
                }}
              >
                Share on WhatsApp
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={() => setOpenParticularDateModal(true)}
                startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
                sx={{
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 2,
                  py: 0.6,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: '#F8FAFC',
                  },
                }}
              >
                Print Bills List
              </Button>
            </Box>
          </Box>

          {/* Cases Calculation Summary Ribbon */}
          <Box
            sx={{
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              px: { xs: 2, sm: 3 },
              py: 1.2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cases Calculation:
              </Typography>
              <Chip
                label={`Total Booked: ${particularCasesSummary.totalBooked} Cases`}
                size="small"
                sx={{
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  fontWeight: 800,
                  fontSize: '12px',
                  height: '26px',
                }}
              />
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#64748B' }}>-</Typography>
              <Chip
                label={`Out Cases: ${particularCasesSummary.totalOut} Cases`}
                size="small"
                sx={{
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #BBF7D0',
                  fontWeight: 800,
                  fontSize: '12px',
                  height: '26px',
                }}
              />
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#64748B' }}>=</Typography>
              <Chip
                label={`Balance Pending: ${particularCasesSummary.totalPending} Cases`}
                size="small"
                sx={{
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  fontWeight: 800,
                  fontSize: '12px',
                  height: '26px',
                }}
              />
            </Box>

            <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
              {filterCustomer && filterCustomer !== 'ALL'
                ? `Customer balance: ${particularCasesSummary.totalBooked} Booked - ${particularCasesSummary.totalOut} Out = ${particularCasesSummary.totalPending} Pending`
                : `${particularCasesSummary.totalBills} bill(s) listed`}
            </Typography>
          </Box>

          <TableContainer>
            <Table sx={{ width: '100%', borderCollapse: 'collapse' }} aria-label="particular details table">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    BILL.NO
                  </TableCell>
                  {!isSingleCustomer && (
                    <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '130px' }}>
                      CUSTOMER
                    </TableCell>
                  )}
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '140px' }}>
                    COMPANY NAME
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '95px' }}>
                    DATE
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1D4ED8', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '105px' }}>
                    TOTAL CASES
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#16A34A', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '105px' }}>
                    OUT CASES
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#B45309', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '115px' }}>
                    PENDING CASES
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '100px' }}>
                    SUBTOTAL
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    DISCOUNT
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    PACKING
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '75px' }}>
                    TAX
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '110px' }}>
                    NET TOTAL
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '120px' }}>
                    TRANSPORT
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', width: '150px' }}>
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {particularLoading ? (
                  <TableRow>
                    <TableCell colSpan={isSingleCustomer ? 13 : 14} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                    </TableCell>
                  </TableRow>
                ) : filteredParticularRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSingleCustomer ? 13 : 14} align="center" sx={{ py: 6, color: '#64748B' }}>
                      No particular bills found {filterCustomer !== 'ALL' ? `for ${filterCustomer}` : ''}{filterParticularCompany !== 'ALL' ? ` under ${filterParticularCompany}` : ''}.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParticularRows.map((row, index) => {
                    const isLast = index === filteredParticularRows.length - 1;
                    const rowId = row._id || row.id || '';
                    const subtotalNum = parseFloat(String(row.amount || row.total || '0').replace(/,/g, '')) || 0;
                    const totalNum = parseFloat(String(row.total || row.amount || '0').replace(/,/g, '')) || 0;
                    const discStr = row.discount && parseFloat(row.discount) > 0 ? (parseFloat(row.discount) <= 100 ? `${row.discount}%` : `₹${row.discount}`) : '-';
                    const packStr = row.packing && parseFloat(row.packing) > 0 ? (parseFloat(row.packing) <= 100 ? `${row.packing}%` : `₹${row.packing}`) : '-';
                    const taxStr = row.tax && parseFloat(row.tax) > 0 ? `₹${parseFloat(row.tax).toLocaleString('en-IN')}` : '-';
                    const totalCustCasesVal = Number(row.totalCustomerCases) || 0;
                    const outCasesVal = Number(row.caseCount) || (row.products ? row.products.reduce((acc: number, p: any) => acc + (parseFloat(p.quantity) || 0), 0) : 0);
                    const totalOutVal = Number(row.deliveredCaseCount) || outCasesVal;
                    const pendingCasesVal = totalCustCasesVal > 0
                      ? Math.max(0, totalCustCasesVal - totalOutVal)
                      : (Number(row.pendingCaseCount) || 0);

                    return (
                      <TableRow
                        key={rowId || index}
                        sx={{
                          '&:hover': {
                            backgroundColor: '#F8FAFC',
                          },
                        }}
                      >
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 700, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.billNo}
                        </TableCell>
                        {!isSingleCustomer && (
                          <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 700, color: '#0B4DB7', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                            {row.customerName}
                          </TableCell>
                        )}
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 600, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.companyName && row.companyName !== 'General' ? row.companyName : '-'}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '12.5px', fontWeight: 500, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.date}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {totalCustCasesVal > 0 ? (
                            <Tooltip title={`Customer Total Booked Cases: ${totalCustCasesVal}`} arrow>
                              <Chip
                                size="small"
                                label={`${totalCustCasesVal} Cases`}
                                sx={{
                                  backgroundColor: '#EFF6FF',
                                  color: '#1D4ED8',
                                  fontWeight: 800,
                                  fontSize: '11.5px',
                                  height: '22px',
                                  borderRadius: '5px',
                                  border: '1px solid #BFDBFE',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {outCasesVal > 0 ? (
                            <Tooltip title={totalOutVal > outCasesVal ? `Bill Out: ${outCasesVal} Cases • Total Customer Out: ${totalOutVal} Cases` : `${outCasesVal} Cases dispatched in this bill`} arrow>
                              <Chip
                                size="small"
                                label={`${outCasesVal} Cases`}
                                sx={{
                                  backgroundColor: '#DCFCE7',
                                  color: '#15803D',
                                  fontWeight: 800,
                                  fontSize: '11.5px',
                                  height: '22px',
                                  borderRadius: '5px',
                                  border: '1px solid #BBF7D0',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {pendingCasesVal > 0 ? (
                            <Tooltip title={totalCustCasesVal > 0 ? `Formula: ${totalCustCasesVal} Total - ${totalOutVal} Out = ${pendingCasesVal} Pending` : `${pendingCasesVal} Pending Cases`} arrow>
                              <Chip
                                size="small"
                                label={`${pendingCasesVal} Cases`}
                                sx={{
                                  backgroundColor: '#FEF3C7',
                                  color: '#B45309',
                                  fontWeight: 800,
                                  fontSize: '11.5px',
                                  height: '22px',
                                  borderRadius: '5px',
                                  border: '1px solid #FDE68A',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Tooltip title={totalCustCasesVal > 0 ? `All ${totalCustCasesVal} cases fulfilled (${totalCustCasesVal} - ${totalOutVal} = 0)` : 'Nil pending cases'} arrow>
                              <Typography sx={{ fontSize: '12px', color: '#16A34A', fontWeight: 700 }}>
                                0 (Nil)
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          ₹{subtotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: discStr !== '-' ? '#DC2626' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {discStr}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: packStr !== '-' ? '#0F172A' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {packStr}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: taxStr !== '-' ? '#0F172A' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {taxStr}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '13.5px', fontWeight: 800, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          ₹{totalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '12.5px', fontWeight: 500, color: '#334155', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.transport || row.transportName || '-'}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                            {isCustomer ? (
                              <Tooltip title="View Bill" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenBillPrint(row, false)}
                                  sx={{
                                    backgroundColor: '#0B4DB7',
                                    color: '#FFFFFF',
                                    borderRadius: '6px',
                                    width: '32px',
                                    height: '28px',
                                    p: 0,
                                    '&:hover': { backgroundColor: '#083B8D' },
                                  }}
                                >
                                  <VisibilityRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <>
                                <Tooltip title="Share on WhatsApp" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleShareBillWhatsApp(row)}
                                    sx={{
                                      backgroundColor: '#25D366',
                                      color: '#FFFFFF',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '22px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#1EBE5D' },
                                    }}
                                  >
                                    <WhatsAppIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>

                                <Tooltip title="View" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenBillPrint(row, false)}
                                    sx={{
                                      backgroundColor: '#0B4DB7',
                                      color: '#FFFFFF',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '22px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#083B8D' },
                                    }}
                                  >
                                    <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>

                                <Tooltip title="Print" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenBillPrint(row, true)}
                                    sx={{
                                      backgroundColor: '#334155',
                                      color: '#FFFFFF',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '22px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#1E293B' },
                                    }}
                                  >
                                    <PrintOutlinedIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>

                                {/* Edit Particular Bill Button (Admin & Super Admin only) */}
                                <Tooltip title="Edit Bill Details" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenEditParticular(row)}
                                    sx={{
                                      backgroundColor: '#0284C7',
                                      color: '#FFFFFF',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '22px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#0369A1' },
                                    }}
                                  >
                                    <ModeEditOutlineRoundedIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>

                                {/* Delete Button (Admin & Super Admin only) */}
                                <Tooltip title="Delete" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteParticular(rowId)}
                                    sx={{
                                      backgroundColor: '#DC2626',
                                      color: '#FFFFFF',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '22px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#B91C1C' },
                                    }}
                                  >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
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
      )}

      {/* View 5: Add Credit View */}
      {activeSubTab === 'Add Credit' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            py: { xs: 2, sm: 4, md: 5 },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', sm: '680px', md: '780px', lg: '840px' },
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: { xs: 2.5, sm: 3.5 },
                py: 2,
                minHeight: '52px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Add Credit - {currentCustomerName || 'Customer'}
              </Typography>
            </Box>

            <Box
              sx={{
                p: { xs: 3, sm: 5, md: 6 },
                pb: { xs: 4, sm: 6, md: 7 },
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {/* Customer Name */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Customer Name
                </Typography>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.name === (addCreditCustomerName || currentCustomerName)) || null}
                  onChange={(_, val) => setAddCreditCustomerName(val ? val.name : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search Customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0F172A',
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Company Name */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Company Name
                </Typography>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={companyOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={companyOptions.find((c) => c.name === addCreditCompanyName) || null}
                  onChange={(_, val) => setAddCreditCompanyName(val ? val.name : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search Company..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          color: '#0F172A',
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Credit Amount */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Credit Amount
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  inputMode="decimal"
                  placeholder="e.g. 1000000"
                  value={creditAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setCreditAmount(val);
                    }
                  }}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '42px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '& input': {
                          MozAppearance: 'textfield',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#94A3B8',
                        },
                      },
                    },
                  }}
                />
              </Box>


              {/* Date */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Date
                </Typography>
                <DatePickerField
                  value={creditDate}
                  onChange={setCreditDate}
                  placeholder="dd-mm-yyyy"
                  iconSize={18}
                  inputSx={{
                    fontSize: '13.5px',
                    height: '42px',
                  }}
                />
              </Box>

              {/* Notes */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Notes
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Notes / Remarks"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '42px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                      },
                    },
                  }}
                />
              </Box>

              {/* Action Button */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  pl: { xs: 0, sm: '178px' },
                  mt: 1,
                }}
              >
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleAddCreditSubmit}
                  disabled={creditLoading}
                  sx={{
                    backgroundColor: '#0B4DB7',
                    color: '#FFFFFF',
                    height: '42px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 3.5,
                    '&:hover': {
                      backgroundColor: '#083B8D',
                    },
                  }}
                >
                  {creditLoading ? 'Saving...' : 'Click to create'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Bill Print & Preview Modal */}
      <BillPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        bill={selectedBillForPrint}
      />

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: '8px', fontWeight: 600, fontSize: '13px' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Account Statement Date Range Print Modal */}
      <DateRangePrintModal
        open={openAccountDateModal}
        onClose={() => setOpenAccountDateModal(false)}
        title={`Print Account Statement - ${filterCustomer || currentCustomerName || 'All Customers'}`}
        subtitle="Select transaction date range to filter ledger entries for A4 print."
        items={accountDetails}
        getDateFromItem={(a) => a.date || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          printLedgerStatementDirectly(
            filterCustomer || currentCustomerName || 'All Customers',
            itemsToPrint,
            rangeText
          );
        }}
      />

      {/* Particulars Bills Date Range Print Modal */}
      <DateRangePrintModal
        open={openParticularDateModal}
        onClose={() => setOpenParticularDateModal(false)}
        title="Print Particulars Bills Master Report"
        subtitle="Select bill date range to filter bills for A4 print."
        items={particularDetails}
        getDateFromItem={(p) => p.date || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          printParticularsListDirectly(itemsToPrint, rangeText);
        }}
      />

      {/* Edit Particular Bill Dialog */}
      <Dialog
        open={openEditParticularModal && !isCustomer}
        onClose={() => setOpenEditParticularModal(false)}
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
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ModeEditOutlineRoundedIcon sx={{ color: '#0B4DB7', fontSize: 24 }} />
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
              Edit Bill #{editBillForm.billNo} {editBillForm.customerName ? `- ${editBillForm.customerName}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenEditParticularModal(false)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5 }}>
          {/* Bill Info Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1.2fr 1.2fr 1fr' }, gap: 2, mb: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Bill No *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.billNo}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, billNo: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 700, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Customer Name *
              </Typography>
              <Autocomplete
                freeSolo
                options={customerOptions.map((c) => c.name)}
                value={editBillForm.customerName}
                onInputChange={(_e, newVal) => setEditBillForm((prev) => ({ ...prev, customerName: newVal }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Customer Name"
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Company Name
              </Typography>
              <Autocomplete
                freeSolo
                options={companyOptions.map((c) => c.name)}
                value={editBillForm.companyName}
                onInputChange={(_e, newVal) => setEditBillForm((prev) => ({ ...prev, companyName: newVal }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Company Name"
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Date (DD-MM-YYYY)
              </Typography>
              <DatePickerField
                value={editBillForm.date}
                onChange={(val) => setEditBillForm((prev) => ({ ...prev, date: val }))}
                placeholder="DD-MM-YYYY"
                iconSize={16}
                inputSx={{ fontSize: '13px', fontWeight: 600 }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Transport Name
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.transport}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, transport: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                No. of Cases
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.caseCount}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, caseCount: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Discount (% or ₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.discount}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, discount: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Packing (% or ₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.packing}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, packing: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Tax (₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter Tax Amount"
                value={editBillForm.tax}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, tax: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>
          </Box>

          {/* Product Items Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, mt: 1 }}>
            <Typography sx={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
              Product Items ({editBillForm.products.length})
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddEditProductRow}
              startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '6px',
              }}
            >
              Add Item
            </Button>
          </Box>

          {/* Product Items Table */}
          <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '40px' }}>#</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700 }}>Particular / Item</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '90px' }}>Qty</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '90px' }}>Rate (₹)</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '90px' }}>Unit</TableCell>
                  <TableCell align="right" sx={{ fontSize: '11px', fontWeight: 700, width: '110px' }}>Amount (₹)</TableCell>
                  <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 700, width: '50px' }}>Del</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editBillForm.products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#64748B', fontSize: '12.5px' }}>
                      No items. Click "+ Add Item" above to add products.
                    </TableCell>
                  </TableRow>
                ) : (
                  editBillForm.products.map((prod, idx) => (
                    <TableRow key={prod.id || idx}>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>{idx + 1}</TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Item Name"
                          value={prod.particular}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'particular', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', fontWeight: 600, height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Qty"
                          value={prod.quantity}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'quantity', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Rate"
                          value={prod.rate}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'rate', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Pkt/Bag"
                          value={prod.pktUnit}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'pktUnit', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                        ₹{parseFloat(prod.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEditProductRow(idx)}
                          sx={{ color: '#DC2626', p: 0.4 }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Live Summary Calculation Banner */}
          <Box
            sx={{
              p: 2,
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Subtotal: </span>
                <strong style={{ color: '#0F172A' }}>₹ {editSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              {editDiscountVal > 0 && (
                <div>
                  <span style={{ color: '#DC2626' }}>Discount: </span>
                  <strong style={{ color: '#DC2626' }}>- ₹ {editDiscountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              {editPackingVal > 0 && (
                <div>
                  <span style={{ color: '#64748B' }}>Packing: </span>
                  <strong>+ ₹ {editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              {editTaxVal > 0 && (
                <div>
                  <span style={{ color: '#64748B' }}>Tax: </span>
                  <strong>+ ₹ {editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Updated Net Total
              </Typography>
              <Typography sx={{ fontSize: '18px', fontWeight: 900, color: '#0B4DB7' }}>
                ₹ {parseFloat(editFinalTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setOpenEditParticularModal(false)} sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEditParticular}
            disabled={editBillLoading}
            sx={{
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              borderRadius: '6px',
              '&:hover': { backgroundColor: '#083B8D' },
            }}
          >
            {editBillLoading ? 'Saving...' : 'Save Bill Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Additional Product / Exceeded Cases Warning Dialog */}
      <Dialog
        open={warningDialog.open}
        onClose={() => setWarningDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '12px',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: warningDialog.type === 'NEW_PRODUCT' ? '#FEF2F2' : '#FEF3C7',
            borderBottom: warningDialog.type === 'NEW_PRODUCT' ? '1px solid #FEE2E2' : '1px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 2,
          }}
        >
          <Box
            sx={{
              backgroundColor: warningDialog.type === 'NEW_PRODUCT' ? '#DC2626' : '#F59E0B',
              color: '#FFFFFF',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {warningDialog.type === 'NEW_PRODUCT' ? (
              <ErrorOutlineRoundedIcon sx={{ fontSize: 24 }} />
            ) : (
              <WarningAmberRoundedIcon sx={{ fontSize: 24 }} />
            )}
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: '16px',
                fontWeight: 800,
                color: warningDialog.type === 'NEW_PRODUCT' ? '#991B1B' : '#92400E',
              }}
            >
              {warningDialog.type === 'NEW_PRODUCT'
                ? 'Product Not in Performa Quotation'
                : 'Exceeded Performa Cases Warning'}
            </Typography>
            <Typography
              sx={{
                fontSize: '12px',
                color: warningDialog.type === 'NEW_PRODUCT' ? '#B91C1C' : '#B45309',
                fontWeight: 500,
              }}
            >
              Customer: <strong>{currentCustomerName || 'Selected Customer'}</strong> • Active Performa: <strong>{warningDialog.performaNumber}</strong>
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, pt: 3 }}>
          {warningDialog.type === 'NEW_PRODUCT' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert
                severity="error"
                sx={{
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  '& .MuiAlert-icon': { color: '#DC2626' },
                }}
              >
                The product <strong>&quot;{warningDialog.productName}&quot;</strong> is NOT listed in customer&apos;s active Performa quotation (<strong>{warningDialog.performaNumber}</strong>).
              </Alert>

              <Typography sx={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6 }}>
                You cannot add unquoted products directly into this bill. To bill this product, please go to <strong>Performa</strong>, add <strong>&quot;{warningDialog.productName}&quot;</strong> to the customer&apos;s quotation first, and then return here.
              </Typography>

              <Box sx={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', p: 2 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', mb: 1, textTransform: 'uppercase' }}>
                  Attempted Product Details
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, fontSize: '13px' }}>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#64748B' }}>Product Name</Typography>
                    <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>{warningDialog.productName}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#64748B' }}>Cases</Typography>
                    <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>{warningDialog.quantity}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#64748B' }}>Rate / Pkt</Typography>
                    <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>₹{warningDialog.rate}</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="warning" sx={{ borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
                Performa <strong>{warningDialog.performaNumber}</strong> has only <strong>{warningDialog.remainingCases} remaining cases</strong> for &quot;{warningDialog.productName}&quot;, but you entered <strong>{warningDialog.quantity} cases</strong>.
              </Alert>

              <Typography sx={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6 }}>
                The extra <strong>{warningDialog.extraCases} cases</strong> will be billed as additional items beyond the quotation quota.
              </Typography>

              <Box sx={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', p: 2 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748B', mb: 1, textTransform: 'uppercase' }}>
                  Case Allocation Breakdown
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, fontSize: '13px' }}>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#166534' }}>Performa Quota</Typography>
                    <Typography sx={{ fontWeight: 700, color: '#166534' }}>{warningDialog.remainingCases} cases</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#B45309' }}>Extra / Additional</Typography>
                    <Typography sx={{ fontWeight: 700, color: '#B45309' }}>+{warningDialog.extraCases} cases</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '11px', color: '#0F172A' }}>Total Being Added</Typography>
                    <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>{warningDialog.quantity} cases</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: 2.5,
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Button
            onClick={() => setWarningDialog((prev) => ({ ...prev, open: false }))}
            sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}
          >
            Cancel
          </Button>

          {warningDialog.type === 'NEW_PRODUCT' ? (
            <Button
              variant="contained"
              disableElevation
              onClick={handleGoToCustomerPerforma}
              startIcon={<ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                textTransform: 'none',
                fontWeight: 700,
                px: 2.5,
                borderRadius: '6px',
                '&:hover': { backgroundColor: '#083B8D' },
              }}
            >
              Go to Performa to Add Product
            </Button>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleGoToCustomerPerforma}
                startIcon={<ReceiptLongRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderColor: '#CBD5E1',
                  color: '#334155',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  '&:hover': { borderColor: '#94A3B8', backgroundColor: '#F1F5F9' },
                }}
              >
                Go to Performa
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={handleConfirmWarningAdd}
                sx={{
                  backgroundColor: '#D97706',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 2.5,
                  borderRadius: '6px',
                  '&:hover': { backgroundColor: '#B45309' },
                }}
              >
                Proceed &amp; Add Extra Cases
              </Button>
            </Box>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

