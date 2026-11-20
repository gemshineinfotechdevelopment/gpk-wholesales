import { useState, useEffect, type FC, type MouseEvent } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { CustomerPasswordModal } from './CustomerPasswordModal';
import { SettingsApi, type AuthUser } from '../services/api';

export type NavTab = 'Customers' | 'Company' | 'Product' | 'Particulars' | 'All Customers' | 'Performa' | 'All Performa' | 'Pending Cases' | 'Settings';

interface NavbarProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onNavigateCustomers?: () => void;
  onLogout?: () => void;
  user?: AuthUser | null;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab = 'Customers',
  onSelectTab,
  onNavigateCustomers,
  onLogout,
  user,
}) => {
  const isCustomer = user?.role === 'user';
  const isSuperAdmin = user?.role === 'superadmin';

  // Tabs tailored for customer vs admin vs superadmin
  const baseTabs: NavTab[] = ['Customers', 'Company', 'Product', 'Particulars', 'All Customers', 'Performa', 'All Performa', 'Pending Cases'];
  const fullTabs: NavTab[] = isSuperAdmin ? [...baseTabs, 'Settings'] : baseTabs;

  const customerTabs: { label: string; tab: NavTab }[] = [
    { label: 'All Performa', tab: 'All Performa' },
    { label: 'Particulars', tab: 'Particulars' },
  ];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openCustomerPasswordModal, setOpenCustomerPasswordModal] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  const getTabIcon = (tab: NavTab) => {
    switch (tab) {
      case 'Customers':
        return <PeopleAltRoundedIcon sx={{ fontSize: 20 }} />;
      case 'Company':
        return <BusinessRoundedIcon sx={{ fontSize: 20 }} />;
      case 'Product':
        return <Inventory2RoundedIcon sx={{ fontSize: 20 }} />;
      case 'Particulars':
        return <ReceiptLongRoundedIcon sx={{ fontSize: 20 }} />;
      case 'All Customers':
        return <GroupsRoundedIcon sx={{ fontSize: 20 }} />;
      case 'Performa':
        return <DescriptionRoundedIcon sx={{ fontSize: 20 }} />;
      case 'All Performa':
        return <ReceiptRoundedIcon sx={{ fontSize: 20 }} />;
      case 'Pending Cases':
        return <PendingActionsRoundedIcon sx={{ fontSize: 20 }} />;
      case 'Settings':
        return <SettingsRoundedIcon sx={{ fontSize: 20 }} />;
      default:
        return <ReceiptLongRoundedIcon sx={{ fontSize: 20 }} />;
    }
  };

  const [customLogo, setCustomLogo] = useState<string>(() => {
    return localStorage.getItem('gpk_custom_logo') || '';
  });

  useEffect(() => {
    SettingsApi.get()
      .then((res) => {
        if (res?.data?.logoUrl) {
          setCustomLogo(res.data.logoUrl);
          localStorage.setItem('gpk_custom_logo', res.data.logoUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleTabClick = (tab: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (tab === 'Customers' && onNavigateCustomers) {
      onNavigateCustomers();
    }
  };

  const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = () => {
    handleCloseMenu();
    if (onLogout) onLogout();
  };

  return (
    <Box
      component="header"
      sx={{
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #EEF2F6',
        px: { xs: 2, md: 4 },
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        boxSizing: 'border-box',
      }}
    >
      {/* Left Logo Section */}
      <Box
        onClick={() => handleTabClick(isCustomer ? 'Particulars' : 'Customers')}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
      >
        {/* Stylized GPK Firecracker Logo Badge or Custom Uploaded Logo */}
        {customLogo ? (
          <Box
            component="img"
            src={customLogo}
            alt="GPK Logo"
            sx={{
              height: 38,
              maxWidth: 110,
              objectFit: 'contain',
              borderRadius: '6px',
            }}
          />
        ) : (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #CA8A04 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '13px',
              letterSpacing: '0.04em',
            }}
          >
            GPK
          </Box>
        )}

        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: '18px',
              color: '#0F172A',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            GPK Crackers
          </Typography>
          <Typography
            sx={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#DC2626',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Wholesales • Sivakasi
          </Typography>
        </Box>
      </Box>

      {/* Center Navigation Links (Desktop) */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: { md: 2, lg: 3.5 },
          height: '100%',
        }}
      >
        {isCustomer
          ? customerTabs.map(({ label, tab }) => {
              const isActive = activeTab === tab;
              return (
                <Box
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  sx={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    px: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '14.5px',
                      color: isActive ? '#1E40AF' : '#475569',
                      letterSpacing: '-0.01em',
                      transition: 'color 0.15s ease',
                      '&:hover': {
                        color: '#1E40AF',
                      },
                    }}
                  >
                    {label}
                  </Typography>

                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: '#1E40AF',
                        borderTopLeftRadius: '2px',
                        borderTopRightRadius: '2px',
                      }}
                    />
                  )}
                </Box>
              );
            })
          : fullTabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Box
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  sx={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '14px',
                      color: isActive ? '#1E40AF' : '#475569',
                      letterSpacing: '-0.01em',
                      px: 0.5,
                      transition: 'color 0.15s ease',
                      '&:hover': {
                        color: '#1E40AF',
                      },
                    }}
                  >
                    {tab}
                  </Typography>

                  {/* Active indicator underline bar */}
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: '#1E40AF',
                        borderTopLeftRadius: '2px',
                        borderTopRightRadius: '2px',
                      }}
                    />
                  )}
                </Box>
              );
            })}
      </Box>

      {/* Right Action Icons (Role Chip + Profile Menu) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Role Badge Chip */}
        <Chip
          size="small"
          label={
            user?.role === 'superadmin'
              ? 'Super Admin'
              : user?.role === 'admin'
              ? 'Admin'
              : 'Customer'
          }
          sx={{
            fontWeight: 700,
            fontSize: '11px',
            backgroundColor:
              user?.role === 'superadmin'
                ? '#FEF2F2'
                : user?.role === 'admin'
                ? '#EEF2FF'
                : '#F0FDF4',
            color:
              user?.role === 'superadmin'
                ? '#DC2626'
                : user?.role === 'admin'
                ? '#1E40AF'
                : '#16A34A',
            border: `1px solid ${
              user?.role === 'superadmin'
                ? '#FECACA'
                : user?.role === 'admin'
                ? '#C7D2FE'
                : '#BBF7D0'
            }`,
            display: { xs: 'none', sm: 'inline-flex' },
          }}
        />

        <Box
          onClick={handleProfileClick}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor:
              user?.role === 'superadmin'
                ? '#DC2626'
                : user?.role === 'admin'
                ? '#1E40AF'
                : '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          <PersonOutlineRoundedIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
        </Box>

        {/* Mobile Hamburger Button */}
        <IconButton
          onClick={() => setMobileDrawerOpen(true)}
          sx={{
            display: { xs: 'flex', md: 'none' },
            color: '#0F172A',
            p: 0.8,
            borderRadius: '8px',
            backgroundColor: '#F1F5F9',
            '&:hover': {
              backgroundColor: '#E2E8F0',
            },
          }}
          aria-label="Open navigation menu"
        >
          <MenuRoundedIcon sx={{ fontSize: 22 }} />
        </IconButton>

        {/* Profile / Logout Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseMenu}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              sx: {
                borderRadius: '12px',
                minWidth: '200px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                border: '1px solid #E2E8F0',
                mt: 1,
                p: 0.5,
              },
            },
          }}
        >
          <MenuItem disabled sx={{ opacity: '1 !important', py: 1.2 }}>
            <ListItemIcon>
              {user?.role === 'superadmin' ? (
                <ShieldRoundedIcon sx={{ fontSize: 22, color: '#DC2626' }} />
              ) : user?.role === 'admin' ? (
                <AdminPanelSettingsRoundedIcon sx={{ fontSize: 22, color: '#1E40AF' }} />
              ) : (
                <AccountCircleRoundedIcon sx={{ fontSize: 22, color: '#16A34A' }} />
              )}
            </ListItemIcon>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                {user?.role === 'superadmin'
                  ? 'Super Administrator'
                  : user?.role === 'admin'
                  ? 'Store Administrator'
                  : user?.customerName || user?.username || 'Customer'}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                {user?.role === 'user' ? 'Customer Account' : user?.username}
              </Typography>
            </Box>
          </MenuItem>

          {user?.role === 'user' && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem
                onClick={() => {
                  handleCloseMenu();
                  setOpenCustomerPasswordModal(true);
                }}
                sx={{ py: 1 }}
              >
                <ListItemIcon>
                  <LockResetRoundedIcon sx={{ fontSize: 18, color: '#1E40AF' }} />
                </ListItemIcon>
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    Set / Change Password
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                    Set a personal portal password
                  </Typography>
                </Box>
              </MenuItem>
            </>
          )}

          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleLogoutClick} sx={{ color: '#DC2626', py: 1 }}>
            <ListItemIcon>
              <LogoutRoundedIcon sx={{ fontSize: 18, color: '#DC2626' }} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
              Logout
            </Typography>
          </MenuItem>
        </Menu>

        {/* Customer Dialog for Setting / Changing Password */}
        {user?.role === 'user' && (
          <CustomerPasswordModal
            open={openCustomerPasswordModal}
            onClose={() => setOpenCustomerPasswordModal(false)}
            customerId={user?.customerId}
            customerName={user?.customerName}
            mobile={user?.mobile || user?.username}
          />
        )}
      </Box>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: 280,
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Drawer Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2.5,
              pb: 1.5,
              borderBottom: '1px solid #EEF2F6',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              {customLogo ? (
                <Box
                  component="img"
                  src={customLogo}
                  alt="GPK Logo"
                  sx={{ height: 32, maxWidth: 90, objectFit: 'contain', borderRadius: '4px' }}
                />
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #CA8A04 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '11px',
                  }}
                >
                  GPK
                </Box>
              )}
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#0F172A', lineHeight: 1.1 }}>
                  GPK Crackers
                </Typography>
                <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
                  Wholesales • Sivakasi
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setMobileDrawerOpen(false)} size="small" sx={{ color: '#64748B' }}>
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* User Profile Card inside Drawer */}
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor:
                  user?.role === 'superadmin' ? '#DC2626' : user?.role === 'admin' ? '#1E40AF' : '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '15px',
                flexShrink: 0,
              }}
            >
              {(user?.customerName || user?.username || 'U').charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#0F172A',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {user?.customerName || user?.username || 'User'}
              </Typography>
              <Chip
                size="small"
                label={user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Store Admin' : 'Customer'}
                sx={{
                  height: '18px',
                  fontSize: '10px',
                  fontWeight: 700,
                  mt: 0.3,
                  backgroundColor: user?.role === 'superadmin' ? '#FEF2F2' : user?.role === 'admin' ? '#EFF6FF' : '#F0FDF4',
                  color: user?.role === 'superadmin' ? '#DC2626' : user?.role === 'admin' ? '#1E40AF' : '#16A34A',
                }}
              />
            </Box>
          </Box>

          {/* Navigation Links */}
          <List sx={{ p: 0 }}>
            {(isCustomer ? customerTabs.map((ct) => ct.tab) : fullTabs).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <ListItem key={tab} disablePadding sx={{ mb: 0.6 }}>
                  <ListItemButton
                    onClick={() => {
                      handleTabClick(tab);
                      setMobileDrawerOpen(false);
                    }}
                    sx={{
                      borderRadius: '8px',
                      py: 1,
                      px: 1.5,
                      backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                      color: isActive ? '#1E40AF' : '#334155',
                      '&:hover': {
                        backgroundColor: isActive ? '#EFF6FF' : '#F8FAFC',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: isActive ? '#1E40AF' : '#64748B' }}>
                      {getTabIcon(tab)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          sx={{
                            fontSize: '13.5px',
                            fontWeight: isActive ? 800 : 600,
                            letterSpacing: '-0.01em',
                            color: isActive ? '#1E40AF' : '#334155',
                          }}
                        >
                          {tab}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Drawer Footer Actions */}
        <Box sx={{ p: 2, borderTop: '1px solid #EEF2F6' }}>
          {user?.role === 'user' && (
            <ListItemButton
              onClick={() => {
                setMobileDrawerOpen(false);
                setOpenCustomerPasswordModal(true);
              }}
              sx={{ borderRadius: '8px', py: 1, px: 1.5, mb: 0.8 }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: '#1E40AF' }}>
                <LockResetRoundedIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                    Change Password
                  </Typography>
                }
              />
            </ListItemButton>
          )}

          <ListItemButton
            onClick={() => {
              setMobileDrawerOpen(false);
              handleLogoutClick();
            }}
            sx={{
              borderRadius: '8px',
              py: 1,
              px: 1.5,
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              '&:hover': {
                backgroundColor: '#FEE2E2',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: '#DC2626' }}>
              <LogoutRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>
                  Logout
                </Typography>
              }
            />
          </ListItemButton>
        </Box>
      </Drawer>
    </Box>
  );
};
