import { useState } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme/theme';
import { Navbar, type NavTab } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { CustomersPage } from './components/CustomersPage';
import { AllCustomersPage } from './components/AllCustomersPage';
import { AddCustomerPage } from './components/AddCustomerPage';
import { CompaniesPage } from './components/CompaniesPage';
import { AddCompanyPage } from './components/AddCompanyPage';
import { ProductsPage } from './components/ProductsPage';
import { ParticularsPage, type ParticularSubTab } from './components/ParticularsPage';
import { PerformaPage } from './components/PerformaPage';
import { AllPerformaPage } from './components/AllPerformaPage';
import { PendingCasesPage } from './components/PendingCasesPage';
import { SettingsPage } from './components/SettingsPage';
import type { AuthUser } from './services/api';

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('gpk_auth_user') || localStorage.getItem('dheeksha_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('gpk_auth_token') || localStorage.getItem('dheeksha_auth_token'));
  });

  const isCustomer = currentUser?.role === 'user';

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const saved = (localStorage.getItem('gpk_active_tab') || localStorage.getItem('dheeksha_active_tab')) as NavTab;
    const validTabs: NavTab[] = [
      'Performa',
      'All Performa',
      'Pending Cases',
      'Particulars',
      'Product',
      'Company',
      'All Customers',
      'Customers',
      'Settings',
    ];
    if (isCustomer) {
      return saved === 'All Performa' ? 'All Performa' : 'Particulars';
    }
    if (saved === 'Settings' && currentUser?.role !== 'superadmin') {
      return 'Customers';
    }
    return validTabs.includes(saved) ? saved : 'Customers';
  });

  const [companySubView, setCompanySubView] = useState<'list' | 'add'>('list');

  const [customerSubView, setCustomerSubView] = useState<'list' | 'add'>('list');

  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(() => {
    if (currentUser?.role === 'user' && currentUser.customerName) {
      return currentUser.customerName;
    }
    return '';
  });

  const [particularInitialSubTab, setParticularInitialSubTab] = useState<ParticularSubTab>(() => {
    if (currentUser?.role === 'user') {
      return 'Account Details';
    }
    return 'Select Customer';
  });

  const [performaInitialSubTab, setPerformaInitialSubTab] = useState<'Create Performa' | 'Customer Performa List'>('Create Performa');
  const [particularNavKey, setParticularNavKey] = useState(0);
  const [performaNavKey, setPerformaNavKey] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>(() => ({
    [activeTab]: true,
  }));

  const activateTab = (tab: NavTab) => {
    setActiveTab(tab);
    localStorage.setItem('gpk_active_tab', tab);
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setCompanySubView('list');
    setCustomerSubView('list');
    if (user.role === 'user') {
      const custName = user.customerName || user.username;
      setSelectedCustomerName(custName);
      setParticularInitialSubTab('Account Details');
      setVisitedTabs({ Particulars: true });
      activateTab('Particulars');
    } else {
      setSelectedCustomerName('');
      setParticularInitialSubTab('Select Customer');
      setVisitedTabs({ Customers: true });
      activateTab('Customers');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gpk_auth_token');
    localStorage.removeItem('gpk_auth_user');
    localStorage.removeItem('gpk_active_tab');
    localStorage.removeItem('gpk_company_subview');
    localStorage.removeItem('gpk_customer_subview');
    localStorage.removeItem('gpk_particular_subtab');
    localStorage.removeItem('gpk_performa_subtab');
    localStorage.removeItem('gpk_active_customer');
    localStorage.removeItem('dheeksha_auth_token');
    localStorage.removeItem('dheeksha_auth_user');
    localStorage.removeItem('dheeksha_active_tab');
    localStorage.removeItem('dheeksha_active_customer');
    setVisitedTabs({});
    setSelectedCustomerName('');
    setCompanySubView('list');
    setCustomerSubView('list');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleSelectTab = (tab: NavTab) => {
    if (currentUser?.role === 'user' && tab !== 'Particulars' && tab !== 'All Performa') {
      return;
    }
    if (tab === 'Settings' && currentUser?.role !== 'superadmin') {
      return;
    }
    activateTab(tab);
  };

  const handleSetCompanySubView = (view: 'list' | 'add') => {
    setCompanySubView(view);
  };

  const handleSetCustomerSubView = (view: 'list' | 'add') => {
    setCustomerSubView(view);
  };

  const handleCustomerSelectedForParticular = (customerName: string, subTab?: ParticularSubTab) => {
    setSelectedCustomerName(customerName);
    const targetSubTab = subTab || 'Account Details';
    setParticularInitialSubTab(targetSubTab);
    setParticularNavKey((k) => k + 1);
    activateTab('Particulars');
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  const effectiveCustomerName = currentUser?.role === 'user'
    ? (currentUser.customerName || currentUser.username)
    : selectedCustomerName;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onNavigateCustomers={() => {
            handleSelectTab('Customers');
            handleSetCustomerSubView('list');
          }}
          onLogout={handleLogout}
          user={currentUser}
        />

        <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>
          {/* Performa Tab (Admin & Super Admin only) */}
          {visitedTabs['Performa'] && currentUser?.role !== 'user' && (
            <Box sx={{ display: activeTab === 'Performa' ? 'block' : 'none' }}>
              <PerformaPage
                initialCustomerName={effectiveCustomerName}
                initialSubTab={performaInitialSubTab}
                navigationKey={performaNavKey}
                isActive={activeTab === 'Performa'}
                onNavigateAllPerforma={() => handleSelectTab('All Performa')}
                onSelectCustomerForBill={handleCustomerSelectedForParticular}
              />
            </Box>
          )}

          {/* All Performa Tab (Customers see only their own performas) */}
          {visitedTabs['All Performa'] && (
            <Box sx={{ display: activeTab === 'All Performa' ? 'block' : 'none' }}>
              <AllPerformaPage
                onAddNewPerforma={() => {
                  setPerformaInitialSubTab('Create Performa');
                  setPerformaNavKey((k) => k + 1);
                  activateTab('Performa');
                }}
                onSelectCustomerForBill={handleCustomerSelectedForParticular}
                customerFilter={currentUser?.role === 'user' ? effectiveCustomerName : undefined}
                userRole={currentUser?.role}
              />
            </Box>
          )}

          {/* Pending Cases Tab (Admin & Super Admin only) */}
          {visitedTabs['Pending Cases'] && currentUser?.role !== 'user' && (
            <Box sx={{ display: activeTab === 'Pending Cases' ? 'block' : 'none' }}>
              <PendingCasesPage
                onSelectCustomerForBill={handleCustomerSelectedForParticular}
                onNavigateToCustomerPerforma={(custName) => {
                  setSelectedCustomerName(custName);
                  setPerformaInitialSubTab('Customer Performa List');
                  setPerformaNavKey((k) => k + 1);
                  activateTab('Performa');
                }}
                userRole={currentUser?.role}
              />
            </Box>
          )}

          {/* Particulars Tab (Customer views only their own ledger) */}
          {visitedTabs['Particulars'] && (
            <Box sx={{ display: activeTab === 'Particulars' ? 'block' : 'none' }}>
              <ParticularsPage
                initialCustomerName={effectiveCustomerName}
                initialSubTab={currentUser?.role === 'user' ? 'Account Details' : particularInitialSubTab}
                navigationKey={particularNavKey}
                isActive={activeTab === 'Particulars'}
                userRole={currentUser?.role}
                onNavigateToPerforma={(custName) => {
                  if (custName) {
                    setSelectedCustomerName(custName);
                  }
                  setPerformaInitialSubTab('Customer Performa List');
                  setPerformaNavKey((k) => k + 1);
                  activateTab('Performa');
                }}
              />
            </Box>
          )}

          {/* Product Tab (Admin & Superadmin only) */}
          {visitedTabs['Product'] && currentUser?.role !== 'user' && (
            <Box sx={{ display: activeTab === 'Product' ? 'block' : 'none' }}>
              <ProductsPage />
            </Box>
          )}

          {/* Company Tab (Admin & Superadmin only) */}
          {visitedTabs['Company'] && currentUser?.role !== 'user' && (
            <Box sx={{ display: activeTab === 'Company' ? 'block' : 'none' }}>
              {companySubView === 'add' ? (
                <AddCompanyPage
                  onCancel={() => handleSetCompanySubView('list')}
                  onSubmitSuccess={() => handleSetCompanySubView('list')}
                  onNavigateCompanies={() => handleSetCompanySubView('list')}
                />
              ) : (
                <CompaniesPage onAddCompany={() => handleSetCompanySubView('add')} />
              )}
            </Box>
          )}

          {/* All Customers Tab (Super Admin sees all metrics, Admin has revenue cards hidden) */}
          {visitedTabs['All Customers'] && currentUser?.role !== 'user' && (
            <Box sx={{ display: activeTab === 'All Customers' ? 'block' : 'none' }}>
              <AllCustomersPage
                onAddNewCustomer={() => {
                  handleSetCustomerSubView('add');
                  activateTab('Customers');
                }}
                onSelectCustomerForParticular={handleCustomerSelectedForParticular}
                userRole={currentUser?.role}
              />
            </Box>
          )}

          {/* Customers Tab (Admin & Super Admin only) */}
          {visitedTabs['Customers'] && currentUser?.role !== 'user' && (
            <Box sx={{ display: activeTab === 'Customers' ? 'block' : 'none' }}>
              {customerSubView === 'add' ? (
                <AddCustomerPage
                  onCancel={() => handleSetCustomerSubView('list')}
                  onSubmitSuccess={() => handleSetCustomerSubView('list')}
                />
              ) : (
                <CustomersPage
                  onAddNew={() => handleSetCustomerSubView('add')}
                  onSelectCustomerForParticular={handleCustomerSelectedForParticular}
                  userRole={currentUser?.role}
                />
              )}
            </Box>
          )}

          {/* Settings Tab (Super Admin only) */}
          {visitedTabs['Settings'] && currentUser?.role === 'superadmin' && (
            <Box sx={{ display: activeTab === 'Settings' ? 'block' : 'none' }}>
              <SettingsPage currentUser={currentUser} />
            </Box>
          )}

          {/* Other Tabs */}
          {activeTab !== 'Particulars' &&
            activeTab !== 'Product' &&
            activeTab !== 'Company' &&
            activeTab !== 'All Customers' &&
            activeTab !== 'Customers' &&
            activeTab !== 'Performa' &&
            activeTab !== 'All Performa' &&
            activeTab !== 'Pending Cases' &&
            activeTab !== 'Settings' && (
              <Box sx={{ p: 4, textAlign: 'center', color: '#64748B' }}>
                {activeTab} content coming soon.
              </Box>
            )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
