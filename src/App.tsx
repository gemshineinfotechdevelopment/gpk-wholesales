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
    ];
    if (isCustomer) {
      return saved === 'All Performa' ? 'All Performa' : 'Particulars';
    }
    return validTabs.includes(saved) ? saved : 'Customers';
  });

  const [companySubView, setCompanySubView] = useState<'list' | 'add'>(() => {
    return (localStorage.getItem('gpk_company_subview') as 'list' | 'add') || 'list';
  });

  const [customerSubView, setCustomerSubView] = useState<'list' | 'add'>(() => {
    return (localStorage.getItem('gpk_customer_subview') as 'list' | 'add') || 'list';
  });

  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(() => {
    if (currentUser?.role === 'user' && currentUser.customerName) {
      return currentUser.customerName;
    }
    return localStorage.getItem('gpk_active_customer') || localStorage.getItem('dheeksha_active_customer') || '';
  });

  const [particularInitialSubTab, setParticularInitialSubTab] = useState<ParticularSubTab>(() => {
    if (currentUser?.role === 'user') {
      return 'Account Details';
    }
    return (localStorage.getItem('gpk_particular_subtab') as ParticularSubTab) || 'Select Customer';
  });

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (user.role === 'user') {
      const custName = user.customerName || user.username;
      setSelectedCustomerName(custName);
      localStorage.setItem('gpk_active_customer', custName);
      setActiveTab('Particulars');
      localStorage.setItem('gpk_active_tab', 'Particulars');
      setParticularInitialSubTab('Account Details');
    } else {
      setActiveTab('Customers');
      localStorage.setItem('gpk_active_tab', 'Customers');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gpk_auth_token');
    localStorage.removeItem('gpk_auth_user');
    localStorage.removeItem('gpk_active_tab');
    localStorage.removeItem('gpk_company_subview');
    localStorage.removeItem('gpk_customer_subview');
    localStorage.removeItem('gpk_particular_subtab');
    localStorage.removeItem('gpk_active_customer');
    localStorage.removeItem('dheeksha_auth_token');
    localStorage.removeItem('dheeksha_auth_user');
    localStorage.removeItem('dheeksha_active_tab');
    localStorage.removeItem('dheeksha_active_customer');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleSelectTab = (tab: NavTab) => {
    if (currentUser?.role === 'user' && tab !== 'Particulars' && tab !== 'All Performa') {
      return;
    }
    setActiveTab(tab);
    localStorage.setItem('gpk_active_tab', tab);
    if (tab === 'Performa' && currentUser?.role !== 'user') {
      setSelectedCustomerName('');
      localStorage.removeItem('gpk_active_customer');
    }
    if (tab === 'Particulars') {
      if (currentUser?.role === 'user') {
        const custName = currentUser.customerName || currentUser.username;
        setSelectedCustomerName(custName);
        setParticularInitialSubTab('Account Details');
      } else {
        setSelectedCustomerName('');
        localStorage.removeItem('gpk_active_customer');
        setParticularInitialSubTab('Select Customer');
        localStorage.setItem('gpk_particular_subtab', 'Select Customer');
      }
    }
    if (tab === 'Company') {
      setCompanySubView('list');
      localStorage.setItem('gpk_company_subview', 'list');
    }
    if (tab === 'Customers') {
      setCustomerSubView('list');
      localStorage.setItem('gpk_customer_subview', 'list');
    }
  };

  const handleSetCompanySubView = (view: 'list' | 'add') => {
    setCompanySubView(view);
    localStorage.setItem('gpk_company_subview', view);
  };

  const handleSetCustomerSubView = (view: 'list' | 'add') => {
    setCustomerSubView(view);
    localStorage.setItem('gpk_customer_subview', view);
  };

  const handleCustomerSelectedForParticular = (customerName: string, subTab?: ParticularSubTab) => {
    setSelectedCustomerName(customerName);
    localStorage.setItem('gpk_active_customer', customerName);
    const targetSubTab = subTab || 'Account Details';
    setParticularInitialSubTab(targetSubTab);
    localStorage.setItem('gpk_particular_subtab', targetSubTab);
    setActiveTab('Particulars');
    localStorage.setItem('gpk_active_tab', 'Particulars');
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
          backgroundColor: '#F8F9FD',
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
          {activeTab === 'Performa' && currentUser?.role !== 'user' && (
            <PerformaPage
              initialCustomerName={effectiveCustomerName}
              onNavigateAllPerforma={() => handleSelectTab('All Performa')}
              onSelectCustomerForBill={handleCustomerSelectedForParticular}
            />
          )}

          {/* All Performa Tab (Customers see only their own performas) */}
          {activeTab === 'All Performa' && (
            <AllPerformaPage
              onAddNewPerforma={() => handleSelectTab('Performa')}
              onSelectCustomerForBill={handleCustomerSelectedForParticular}
              customerFilter={currentUser?.role === 'user' ? effectiveCustomerName : undefined}
              userRole={currentUser?.role}
            />
          )}

          {/* Pending Cases Tab (Admin & Super Admin only) */}
          {activeTab === 'Pending Cases' && currentUser?.role !== 'user' && (
            <PendingCasesPage
              onSelectCustomerForBill={handleCustomerSelectedForParticular}
            />
          )}

          {/* Particulars Tab (Customer views only their own ledger) */}
          {activeTab === 'Particulars' && (
            <ParticularsPage
              initialCustomerName={effectiveCustomerName}
              initialSubTab={currentUser?.role === 'user' ? 'Account Details' : particularInitialSubTab}
              userRole={currentUser?.role}
            />
          )}

          {/* Product Tab (Admin & Superadmin only) */}
          {activeTab === 'Product' && currentUser?.role !== 'user' && <ProductsPage />}

          {/* Company Tab (Admin & Superadmin only) */}
          {activeTab === 'Company' && currentUser?.role !== 'user' && (
            <>
              {companySubView === 'add' ? (
                <AddCompanyPage
                  onCancel={() => handleSetCompanySubView('list')}
                  onSubmitSuccess={() => handleSetCompanySubView('list')}
                  onNavigateCompanies={() => handleSetCompanySubView('list')}
                />
              ) : (
                <CompaniesPage onAddCompany={() => handleSetCompanySubView('add')} />
              )}
            </>
          )}

          {/* All Customers Tab (Super Admin sees all metrics, Admin has revenue cards hidden) */}
          {activeTab === 'All Customers' && currentUser?.role !== 'user' && (
            <AllCustomersPage
              onAddNewCustomer={() => {
                handleSelectTab('Customers');
                handleSetCustomerSubView('add');
              }}
              onSelectCustomerForParticular={handleCustomerSelectedForParticular}
              userRole={currentUser?.role}
            />
          )}

          {/* Customers Tab (Admin & Super Admin only) */}
          {activeTab === 'Customers' && currentUser?.role !== 'user' && (
            <>
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
            </>
          )}
          {/* Other Tabs */}
          {activeTab !== 'Particulars' &&
            activeTab !== 'Product' &&
            activeTab !== 'Company' &&
            activeTab !== 'All Customers' &&
            activeTab !== 'Customers' &&
            activeTab !== 'Performa' &&
            activeTab !== 'All Performa' &&
            activeTab !== 'Pending Cases' && (
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
