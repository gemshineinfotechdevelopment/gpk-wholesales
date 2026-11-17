import { useState, type FC, type MouseEvent } from 'react';
import { Box, Typography, Menu, MenuItem, ListItemIcon, Divider, Chip } from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import { AdminAccountModal } from './AdminAccountModal';
import { CustomerPasswordModal } from './CustomerPasswordModal';
import type { AuthUser } from '../services/api';

export type NavTab = 'Customers' | 'Company' | 'Product' | 'Particulars' | 'All Customers' | 'Performa' | 'All Performa';

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

  // Tabs tailored for customer vs admin/superadmin
  const fullTabs: NavTab[] = ['Customers', 'Company', 'Product', 'Particulars', 'All Customers', 'Performa', 'All Performa'];
  const customerTabs: { label: string; tab: NavTab }[] = [
    { label: 'All Performa', tab: 'All Performa' },
    { label: 'Particulars', tab: 'Particulars' },
  ];

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openAdminModal, setOpenAdminModal] = useState<boolean>(false);
  const [openCustomerPasswordModal, setOpenCustomerPasswordModal] = useState<boolean>(false);

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
        {/* Stylized GPK Firecracker Logo Badge */}
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

      {/* Center Navigation Links */}
      <Box
        component="nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, md: 3.5 },
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
                      color: isActive ? '#0B4DB7' : '#475569',
                      letterSpacing: '-0.01em',
                      transition: 'color 0.15s ease',
                      '&:hover': {
                        color: '#0B4DB7',
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
                        backgroundColor: '#0B4DB7',
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
                      color: isActive ? '#0B4DB7' : '#475569',
                      letterSpacing: '-0.01em',
                      px: 0.5,
                      transition: 'color 0.15s ease',
                      '&:hover': {
                        color: '#0B4DB7',
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
                ? '#0B4DB7'
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
                ? '#0B4DB7'
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
                <AdminPanelSettingsRoundedIcon sx={{ fontSize: 22, color: '#0B4DB7' }} />
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
          {user?.role === 'superadmin' && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem
                onClick={() => {
                  handleCloseMenu();
                  setOpenAdminModal(true);
                }}
                sx={{ py: 1 }}
              >
                <ListItemIcon>
                  <VpnKeyRoundedIcon sx={{ fontSize: 18, color: '#0B4DB7' }} />
                </ListItemIcon>
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    Change Admin Credentials
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                    Manage store admin username/pass
                  </Typography>
                </Box>
              </MenuItem>
            </>
          )}

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
                  <LockResetRoundedIcon sx={{ fontSize: 18, color: '#0B4DB7' }} />
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

        {/* Super Admin Dialog for Changing Admin Credentials */}
        {user?.role === 'superadmin' && (
          <AdminAccountModal
            open={openAdminModal}
            onClose={() => setOpenAdminModal(false)}
          />
        )}

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
    </Box>
  );
};
